<?php
/**
 * Workshop Sessions API
 *
 * Stores encrypted Dynamic-Link envelopes behind a random ID so that a stable
 * link can point to the latest version. Legacy plaintext sessions remain
 * readable for compatibility.
 *
 * Endpoints
 * ---------
 *  GET  ?id=<id>               → 200 { data } | 404 { error }
 *  POST                        → 201 { key, version }
 *  PUT  ?id=<id>&version=<n>   + Bearer editor capability → 200 { success, version }
 *  DELETE ?id=<id>             + Bearer editor capability → 200 { success }
 *
 * Storage: one JSON file per session outside the webroot.
 */

declare(strict_types=1);

// ── CORS ─────────────────────────────────────────────────────────────────────

$allowedOrigins = [
    'https://sessionplan.de',
];

// Allow localhost and 127.0.0.1 on any port for local development
// Only enabled when SP_ENV=development (set in server config or .env)
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$isLocalhost = (getenv('SP_ENV') === 'development')
    && (bool) preg_match('#^https?://(localhost|127\.0\.0\.1)(:\d+)?$#', $origin);

// Self-hosters can add a single additional origin (e.g. a staging deployment).
// Exact-match only — no wildcards — so it cannot be turned into a wildcard
// CORS policy by accident.
$extraOrigin = getenv('SP_ALLOWED_ORIGIN');
if (is_string($extraOrigin) && $extraOrigin !== '') {
    $allowedOrigins[] = $extraOrigin;
}

if (in_array($origin, $allowedOrigins, true) || $isLocalhost) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
} else {
    header('Access-Control-Allow-Origin: https://sessionplan.de');
    header('Vary: Origin');
}

header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

// ── Constants ─────────────────────────────────────────────────────────────────

require_once __DIR__ . '/_shared/paths.php';

// Sessions are stored OUTSIDE the webroot so deployments never overwrite them.
// Local dev default: {repo}/sessions_data/.
// Self-hosting: point SP_SESSIONS_DIR at a writable directory outside the webroot
// (see the deployment documentation).
define('SESSIONS_DIR', backend_sessions_dir());
define('TRASH_DIR', SESSIONS_DIR . '/trash');
// Shared inventory counter helpers (lock + decrement). Loaded after
// SESSIONS_DIR is defined so the file can derive INVENTORY_COUNT_FILE and
// PER_IP_DIR from it. Self-hosters who add their own external writers
// (admin scripts, restore tooling, bulk purges) must require this file
// after defining their own SESSIONS_DIR for the same reason.
require_once __DIR__ . '/_shared/inventory.php';
define('RATE_LIMIT_DIR', SESSIONS_DIR . '/.rate-limit');
define('MAX_BODY_BYTES', 2 * 1024 * 1024); // 2 MB
define('KEY_PATTERN', '/^(?:[a-f0-9]{12}|[A-Za-z0-9_-]{22})$/');
define('MAX_TOTAL_SESSIONS', 50000);        // Hard cap — refuse new sessions above this
// Per-IP cap. A single client must not be able to push the service toward
// MAX_TOTAL_SESSIONS. 200 sessions per IP is wide enough for legitimate workshop
// organisers (who often create a handful at a time) while bounding the impact
// of an abusive client. Conservative; adjust alongside MAX_TOTAL_SESSIONS if
// capacity is ever raised.
define('MAX_SESSIONS_PER_IP', 200);
define('RATE_LIMIT_MAX', 10);               // Max POST/DELETE requests per IP per window
define('RATE_LIMIT_PUT_MAX', 120);          // Max PUT requests per IP per window (autosave)
define('RATE_LIMIT_GET_MAX', 300);          // Max GET requests per IP per window
define('RATE_LIMIT_WINDOW', 60);            // Window in seconds
define('RATE_LIMIT_CLEANUP_PROB', 2);       // % chance of opportunistic cleanup per call
define('PER_IP_WINDOW_MAX_AGE', 30 * 24 * 3600); // 30 days — drop stale per-IP ledgers

// Canonical public base URL used when reconstructing a tracked dynamic-link URL
// for analytics. Avoids depending on the request Host header so an upstream
// proxy or X-Forwarded-Host misroute can never feed into the tracking call.
// Override via SP_PUBLIC_BASE_URL env for self-hosted deployments — the value
// is consulted at use-site so an updated env (e.g. after a config reload) is
// picked up immediately.
function sp_public_base_url(): string
{
    $value = getenv('SP_PUBLIC_BASE_URL');
    return (is_string($value) && $value !== '') ? rtrim($value, '/') : 'https://sessionplan.de';
}

// Optional header (e.g. CF-Connecting-IP, X-Real-IP) used to determine the
// client IP behind a trusted front-end. Only honoured when set via env and the
// header name is restricted to safe characters — the server trusts whatever
// this header says, so leaving it unset by default is the safe choice for
// direct-internet deployments.
function sp_trusted_client_ip_header(): string
{
    $value = getenv('SP_TRUSTED_CLIENT_IP_HEADER');
    return is_string($value) ? $value : '';
}


// ── Helpers ───────────────────────────────────────────────────────────────────

function json_error(int $code, string $message): never
{
    http_response_code($code);
    echo json_encode(['error' => $message], JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_UNICODE);
    exit;
}

function json_success(array $payload, int $code = 200): never
{
    http_response_code($code);
    echo json_encode($payload, JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_UNICODE);
    exit;
}

function validate_key(string $key): void
{
    if (!preg_match(KEY_PATTERN, $key)) {
        json_error(400, 'Invalid key format.');
    }
}

function session_path(string $key): string
{
    // Safe because validate_key() rejects anything that isn't
    // KEY_PATTERN = /(?:[a-f0-9]{12}|[A-Za-z0-9_-]{22})/ — either a 12-hex
    // legacy session ID or a 22-char base64url encrypted-session ID.
    return SESSIONS_DIR . '/' . $key . '.json';
}

function trashed_path(string $key): string
{
    return TRASH_DIR . '/' . $key . '.json';
}

function legacy_trashed_path(string $key): string
{
    return SESSIONS_DIR . '/_' . $key . '.json';
}

function session_lock_path(string $key): string
{
    return SESSIONS_DIR . '/.' . $key . '.lock';
}

function key_is_available(string $key): bool
{
    return !file_exists(session_path($key)) && !file_exists(trashed_path($key)) && !file_exists(legacy_trashed_path($key));
}

function read_body(): array
{
    $raw = file_get_contents('php://input', false, null, 0, MAX_BODY_BYTES + 1);

    if ($raw === false) {
        json_error(500, 'Could not read request body.');
    }

    if (strlen($raw) > MAX_BODY_BYTES) {
        json_error(413, 'Payload too large. Maximum size is 2 MB.');
    }

    $decoded = json_decode($raw, true);

    if (!is_array($decoded)) {
        json_error(400, 'Request body must be a JSON object.');
    }

    return $decoded;
}

function validate_workshop_data(array $data): void
{
    if (($data['format'] ?? null) === 'encrypted-v1') {
        foreach (['title', 'ciphertext', 'iv'] as $field) {
            if (!isset($data[$field]) || !is_string($data[$field]) || ($field !== 'title' && $data[$field] === '')) {
                json_error(422, 'Invalid encrypted session envelope.');
            }
        }
        if (!preg_match('/^[A-Za-z0-9_-]{22,}$/', $data['ciphertext']) || !preg_match('/^[A-Za-z0-9_-]{16}$/', $data['iv'])) {
            json_error(422, 'Invalid encrypted session encoding.');
        }
        return;
    }
    // Lightweight structural check — full validation happens on the client
    if (!isset($data['items']) || !is_array($data['items'])) {
        json_error(422, 'Invalid workshop data structure.');
    }
}

/**
 * The encrypted format is intentionally allowlisted. This stays after the
 * temporary escrow removal so request-only fields can never reach session JSON.
 *
 * @return array<string, mixed>
 */
function encrypted_session_payload(array $data, ?string $writeCapabilityHash = null): array
{
    $payload = [
        'format' => $data['format'],
        'title' => $data['title'],
        'ciphertext' => $data['ciphertext'],
        'iv' => $data['iv'],
    ];
    if ($writeCapabilityHash !== null) {
        $payload['writeCapabilityHash'] = $writeCapabilityHash;
    }
    return $payload;
}

function generate_key(): string
{
    return bin2hex(random_bytes(6)); // 12 hex chars
}

function bearer_token(): ?string
{
    // Prefer the standard header, fall back to mod-rewrite/CGI relay variants
    // where the Authorization header was mapped to a different server env.
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? ($_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
    return preg_match('/^Bearer ([A-Za-z0-9_-]{43})$/', $header, $matches) ? $matches[1] : null;
}

function require_write_capability(array $stored): void
{
    $expected = $stored['writeCapabilityHash'] ?? null;
    $token = bearer_token();
    if (!is_string($expected) || $token === null) json_error(403, 'Valid write capability required.');
    $actual = rtrim(strtr(base64_encode(hash('sha256', base64_decode(strtr($token, '-_', '+/'), true), true)), '+/', '-_'), '=');
    if (!hash_equals($expected, $actual)) json_error(403, 'Valid write capability required.');
}

function ensure_sessions_dir(): void
{
    if (!is_dir(SESSIONS_DIR) && !mkdir(SESSIONS_DIR, 0750, true)) {
        json_error(500, 'Storage directory could not be created.');
    }
    if (!is_dir(TRASH_DIR) && !mkdir(TRASH_DIR, 0750, true)) {
        json_error(500, 'Trash directory could not be created.');
    }
}

/**
 * Single source of truth for the client IP. Honours an opt-in trusted-proxy
 * header (env SP_TRUSTED_CLIENT_IP_HEADER, e.g. CF-Connecting-IP or
 * X-Real-IP) when the header name is restricted to safe characters; otherwise
 * falls back to REMOTE_ADDR. Trusted mode is intentionally off by default —
 * the server has no way to verify the header, so leaving it unset is the safe
 * choice for direct-internet deployments.
 */
function session_client_ip(): string
{
    $headerName = sp_trusted_client_ip_header();
    if ($headerName !== '' && preg_match('/^[A-Za-z0-9-]+$/', $headerName)) {
        $envKey = 'HTTP_' . strtoupper(str_replace('-', '_', $headerName));
        $value = $_SERVER[$envKey] ?? '';
        if (is_string($value) && $value !== '') {
            // Take the first hop if multiple proxies chained the header.
            $ip = trim(explode(',', $value)[0]);
            if ($ip !== '') return $ip;
        }
    }
    return $_SERVER['REMOTE_ADDR'] ?? 'unknown';
}

// inventory_lock / inventory_unlock / inventory_decrement / per_ip_path /
// per_ip_decrement live in _shared/inventory.php so external writers of
// the same storage can decrement the counters without duplicating the lock
// pattern.

/**
 * Ensures the storage-tree side-directories used by the inventory + rate
 * limiter exist. Fails closed (503) on permission errors — silently skipping
 * the limit check would let an attacker mask traffic behind a broken
 * filesystem.
 */
function ensure_inventory_dirs(): void
{
    if (!is_dir(PER_IP_DIR) && !@mkdir(PER_IP_DIR, 0750, true)) {
        json_error(503, 'Inventory storage unavailable.');
    }
    if (!is_dir(RATE_LIMIT_DIR) && !@mkdir(RATE_LIMIT_DIR, 0750, true)) {
        json_error(503, 'Rate limit storage unavailable.');
    }
}

/**
 * Read the global counter under its exclusive lock, optionally falling back
 * to a one-time glob() bootstrap when the counter file is still empty. The
 * whole read-and-maybe-write happens inside the same flock() so a concurrent
 * increment cannot race with the bootstrap and overwrite an in-flight count.
 *
 * When $reserve is true the post-increment value is written back to disk
 * before returning, so the reservation is durable across a PHP crash. The
 * caller still owns the exclusive lock and must either commit
 * (inventory_reservation_commit) or roll back (inventory_reservation_release)
 * on every exit path.
 *
 * @return array{0: resource, 1: array<string, int>}|null  null on IO failure
 */
function inventory_global_reserve(bool $reserve): ?array
{
    $fp = @fopen(INVENTORY_COUNT_FILE, 'c+');
    if ($fp === false) return null;
    if (!flock($fp, LOCK_EX)) { fclose($fp); return null; }
    $raw = stream_get_contents($fp);
    $entry = $raw === '' || $raw === false ? null : json_decode($raw, true);

    if (!is_array($entry) || !isset($entry['count']) || !is_int($entry['count']) || $entry['count'] < 0) {
        // Cold start — derive from the directory contents. Re-check file
        // size after acquiring the lock; another process may have populated
        // it between fopen() and flock().
        $entry = ['count' => count(glob(SESSIONS_DIR . '/*.json') ?: [])];
    }

    if ($reserve) {
        $entry['count']++;
        // Persist the reservation immediately so it survives a crash. The
        // caller can still roll back via inventory_reservation_release().
        rewind($fp);
        ftruncate($fp, 0);
        fwrite($fp, json_encode($entry));
        @chmod(INVENTORY_COUNT_FILE, 0640);
    }
    return [$fp, $entry];
}

// inventory_decrement / per_ip_path / per_ip_decrement live in
// _shared/inventory.php (loaded above). The reservation flow below is
// API-specific — external writers only need the simple decrement helpers.

// per_ip_increment lives in _shared/inventory.php.

/**
 * Reserve one slot for $ip under the per-IP ledger lock. The check against
 * MAX_SESSIONS_PER_IP and the increment happen in the same critical section
 * so concurrent POSTs from the same IP cannot overshoot the cap. Callers
 * MUST either commit (release without decrement) or roll back
 * (inventory_reservation_release) on every exit path.
 *
 * @return array{0: resource, 1: array<string, int>}|null
 *         null when the cap is reached OR on IO failure. Use
 *         inventory_reservation_release() to unwind any partial reservation
 *         returned by inventory_reserve() on early-fail paths.
 */
function per_ip_reserve(string $ip, int $limit): ?array
{
    $file = per_ip_path($ip);
    $fp = @fopen($file, 'c+');
    if ($fp === false) return null;
    if (!flock($fp, LOCK_EX)) { fclose($fp); return null; }
    $raw = stream_get_contents($fp);
    $entry = $raw === '' || $raw === false ? [] : json_decode($raw, true);
    if (!is_array($entry)) $entry = [];
    $current = (int) ($entry['count'] ?? 0);
    if ($current >= $limit) {
        flock($fp, LOCK_UN);
        fclose($fp);
        return null;
    }
    $entry['count'] = $current + 1;
    $entry['ts'] = time();
    // Write the reserved value back under the lock so the reservation is
    // durable even if the caller crashes before committing.
    rewind($fp);
    ftruncate($fp, 0);
    fwrite($fp, json_encode($entry));
    return [$fp, $entry];
}

/**
 * Drop one previously-reserved slot — release the lock without keeping the
 * increment. Used on POST rollback paths after a successful reservation but
 * before the session JSON made it to disk.
 */
function inventory_reservation_release($fp): void
{
    if (!is_resource($fp)) return;
    // The reservation was written optimistically; restore by reading the
    // current entry, decrementing, and writing back. We hold the lock so
    // no other process can observe the temporary surplus.
    rewind($fp);
    $raw = stream_get_contents($fp);
    $entry = $raw === '' || $raw === false ? [] : json_decode($raw, true);
    if (is_array($entry) && isset($entry['count'])) {
        $entry['count'] = max(0, $entry['count'] - 1);
        $entry['ts'] = time();
        rewind($fp);
        ftruncate($fp, 0);
        fwrite($fp, json_encode($entry));
    }
    flock($fp, LOCK_UN);
    fclose($fp);
}

/**
 * Commit a previously-reserved slot — release the lock without rolling back
 * the increment. No-op on the counter file itself; the reservation already
 * persisted the post-increment value.
 */
function inventory_reservation_commit($fp): void
{
    if (!is_resource($fp)) return;
    flock($fp, LOCK_UN);
    fclose($fp);
}

// per_ip_decrement lives in _shared/inventory.php.

/**
 * File-based rate limiting — no APCu/Redis dependency required.
 * One small file per IP+namespace in a server-blinded sibling directory of
 * SESSIONS_DIR. $namespace isolates counters per method: 'post', 'put',
 * 'delete'. PUT uses RATE_LIMIT_PUT_MAX (autosave-friendly); others use
 * RATE_LIMIT_MAX. Fails closed (503) on IO errors so a broken filesystem
 * never turns into a free-for-all.
 */
function check_rate_limit(string $namespace = 'post'): void
{
    ensure_inventory_dirs();

    $ip    = session_client_ip();
    $hash  = hash('sha256', $ip . $namespace); // never write the raw IP to disk
    // Counter file uses the same `.json` suffix as every other JSON entry in
    // the storage tree so the sweep's glob pattern picks them up uniformly.
    $file  = RATE_LIMIT_DIR . '/' . $hash . '.json';
    $now   = time();
    $limit = ($namespace === 'put')
        ? RATE_LIMIT_PUT_MAX
        : (($namespace === 'get') ? RATE_LIMIT_GET_MAX : RATE_LIMIT_MAX);

    $fp = @fopen($file, 'c+');
    if ($fp === false) {
        json_error(503, 'Rate limit storage unavailable.');
    }

    if (!flock($fp, LOCK_EX)) {
        fclose($fp);
        json_error(503, 'Rate limit storage unavailable.');
    }
    $content = stream_get_contents($fp);
    $entry   = $content ? json_decode($content, true) : null;

    if (!$entry || ($now - $entry['ts']) >= RATE_LIMIT_WINDOW) {
        $entry = ['ts' => $now, 'count' => 1];
    } else {
        $entry['count']++;
    }

    if ($entry['count'] > $limit) {
        flock($fp, LOCK_UN);
        fclose($fp);
        http_response_code(429);
        header('Retry-After: ' . RATE_LIMIT_WINDOW);
        echo json_encode(['error' => 'Too many requests. Please try again later.'], JSON_HEX_TAG | JSON_HEX_AMP);
        exit;
    }

    rewind($fp);
    ftruncate($fp, 0);
    fwrite($fp, json_encode($entry));
    flock($fp, LOCK_UN);
    fclose($fp);

    // Opportunistic GC: ~2% of calls sweep stale rate-limit entries and
    // per-IP ledgers so the directories do not grow without bound. random_int
    // throws on entropy failure; the request then surfaces a 500, which is
    // acceptable since cleanup is hygiene rather than a correctness boundary.
    if (random_int(1, 100) <= RATE_LIMIT_CLEANUP_PROB) {
        inventory_sweep($now);
    }
}

/**
 * Best-effort cleanup pass for rate-limit files and per-IP ledgers older
 * than their respective retention windows. Each file is checked with
 * filemtime() (cheap stat) and @unlink()'d if stale. Errors are silently
 * swallowed — this is hygiene, not a correctness boundary.
 */
function inventory_sweep(int $now): void
{
    $rateCutoff = $now - 2 * RATE_LIMIT_WINDOW;
    if (is_dir(RATE_LIMIT_DIR)) {
        foreach (glob(RATE_LIMIT_DIR . '/*.json') ?: [] as $file) {
            if (@filemtime($file) !== false && @filemtime($file) < $rateCutoff) {
                @unlink($file);
            }
        }
    }
    $perIpCutoff = $now - PER_IP_WINDOW_MAX_AGE;
    if (is_dir(PER_IP_DIR)) {
        foreach (glob(PER_IP_DIR . '/*.json') ?: [] as $file) {
            if (@filemtime($file) !== false && @filemtime($file) < $perIpCutoff) {
                @unlink($file);
            }
        }
    }
}

/**
 * Reserve one global counter slot and one per-IP slot under the corresponding
 * exclusive locks. Both checks-and-increments happen inside their locks so a
 * burst of concurrent POSTs cannot overshoot MAX_TOTAL_SESSIONS or
 * MAX_SESSIONS_PER_IP. The caller receives a tuple of resource handles it MUST
 * either pass to inventory_reservation_commit() on success or to
 * inventory_reservation_release() on every early-fail exit path.
 *
 * @return array{0: resource, 1: resource}|null  null on capacity exceeded
 *         (caller already got the analytics event) or on IO failure.
 */
function inventory_reserve(string $ip): ?array
{
    ensure_inventory_dirs();

    // Global: bootstrap (if empty) and increment under one lock.
    $globalLocked = inventory_global_reserve(true);
    if ($globalLocked === null) {
        json_error(503, 'Inventory storage unavailable.');
    }
    [$globalFp, $globalEntry] = $globalLocked;
    $globalCount = $globalEntry['count'];
    if ($globalCount > MAX_TOTAL_SESSIONS) {
        // Undo the optimistic increment, then release.
        $globalEntry['count'] = $globalCount - 1;
        inventory_unlock($globalFp, $globalEntry);
        json_error(503, 'Service temporarily unavailable. Please try again later.');
    }

    // Per-IP: reserve under the ledger lock. If this fails we MUST undo the
    // global reservation to keep the counters coherent.
    $perIpLocked = per_ip_reserve($ip, MAX_SESSIONS_PER_IP);
    if ($perIpLocked === null) {
        // Could be either IO failure or per-IP cap reached. Roll back the
        // global increment first, then decide which error to surface.
        $globalEntry['count'] = max(0, $globalEntry['count'] - 1);
        inventory_unlock($globalFp, $globalEntry);
        // Distinguish IO failure vs cap by trying to lock the ledger again.
        $probe = inventory_lock(per_ip_path($ip));
        if ($probe === null) {
            json_error(503, 'Inventory storage unavailable.');
        }
        [$probeFp, $probeEntry] = $probe;
        $current = (int) ($probeEntry['count'] ?? 0);
        inventory_unlock($probeFp, $probeEntry);
        json_error(403, 'Session creation limit reached for this client.');
    }

    return [$globalFp, $perIpLocked[0]];
}

/**
 * Hook called from POST after the session JSON has been successfully
 * written. Both locks were acquired during inventory_reserve(); this just
 * commits them so the increments survive the request. No separate
 * inventory_increment / per_ip_increment call — the increments already
 * happened under the locks and the values are already on disk. Pair every
 * successful inventory_reserve() with exactly one of inventory_record_reserved
 * or inventory_record_rolled_back so the invariant
 *   INVENTORY_COUNT_FILE.count == active sessions in SESSIONS_DIR
 *   per_ip(MAX_SESSIONS_PER_IP).json.count == active sessions for that IP
 * stays in lockstep with reality.
 */
function inventory_record_reserved(string $ip, $globalFp, $perIpFp): void
{
    inventory_reservation_commit($globalFp);
    inventory_reservation_commit($perIpFp);
}

/**
 * Roll back a previously-reserved global + per-IP reservation. Called from
 * every POST early-fail path after inventory_reserve() has succeeded.
 */
function inventory_record_rolled_back($globalFp, $perIpFp): void
{
    inventory_reservation_release($globalFp);
    inventory_reservation_release($perIpFp);
}

// inventory_record_deleted / inventory_decrement / per_ip_decrement live in
// _shared/inventory.php. The API DELETE path calls inventory_record_deleted
// with the deleter IP for per-IP attribution; other writers may pass null
// when no IP attribution is meaningful (bulk purge).

// ── Routing ───────────────────────────────────────────────────────────────────

$method = $_SERVER['REQUEST_METHOD'];
$key    = isset($_GET['id']) ? trim($_GET['id']) : null;

// ── Content-Type guard (CSRF protection) ─────────────────────────────────────
// Browsers cannot send cross-origin application/json without a preflight,
// so rejecting other content types effectively blocks CSRF via <form>.
if (in_array($method, ['POST', 'PUT'], true)) {
    $ct = $_SERVER['CONTENT_TYPE'] ?? $_SERVER['HTTP_CONTENT_TYPE'] ?? '';
    if (stripos($ct, 'application/json') === false) {
        json_error(415, 'Content-Type must be application/json.');
    }
}

switch ($method) {

    // ── GET: retrieve a session ───────────────────────────────────────────────
    case 'GET':
        if ($key === null) {
            json_error(400, 'Missing key parameter.');
        }

        check_rate_limit('get');
        validate_key($key);

        $path = session_path($key);

        if (!file_exists($path)) {
            json_error(404, 'Session not found.');
        }

        $content = file_get_contents($path);

        if ($content === false) {
            json_error(500, 'Could not read session.');
        }

        $data = json_decode($content, true);

        if (!is_array($data)) {
            json_error(500, 'Session data is corrupted.');
        }

        unset($data['writeCapabilityHash'], $data['temporaryAdminKey']);
        json_success(['data' => $data]);

    // ── POST: create a new session ────────────────────────────────────────────
    case 'POST':
        if ($key !== null) {
            json_error(400, 'POST must not include an id parameter. Use PUT to update.');
        }

        check_rate_limit('post');
        ensure_sessions_dir();
        // Reserve a global counter slot and a per-IP slot under their
        // respective locks. The reservation is durable on disk from this
        // point on; every early-fail path below MUST call
        // inventory_record_rolled_back() so the counters do not drift above
        // the number of session files actually present.
        $clientIp = session_client_ip();
        $reservation = inventory_reserve($clientIp);
        if ($reservation === null) {
            json_error(503, 'Inventory storage unavailable.');
        }
        [$globalFp, $perIpFp] = $reservation;

        $body = read_body();
        validate_workshop_data($body);
        $encrypted = ($body['format'] ?? null) === 'encrypted-v1';
        $temporaryAdminKey = $body['temporaryAdminKey'] ?? null;
        if ($encrypted && (!isset($body['writeCapabilityHash']) || !is_string($body['writeCapabilityHash']) || !preg_match('/^[A-Za-z0-9_-]{43}$/', $body['writeCapabilityHash']))) {
            json_error(422, 'Invalid write capability hash.');
        }
        if ($encrypted && (!isset($body['id']) || !is_string($body['id']) || !preg_match('/^[A-Za-z0-9_-]{22}$/', $body['id']))) {
            json_error(422, 'Encrypted sessions require a 128-bit ID.');
        }
        if ($encrypted && $temporaryAdminKey !== null && (!is_string($temporaryAdminKey) || !preg_match('/^[A-Za-z0-9_-]{43}$/', $temporaryAdminKey))) {
            json_error(422, 'Invalid temporary admin key.');
        }

        // Generate a collision-free key: check that both the live file and trash
        // file are free, then atomic fopen('x') prevents TOCTOU.
        $newKey = null;
        $attempts = 0;
        while ($attempts < 10) {
            $candidate = $encrypted ? ($body['id'] ?? '') : generate_key();
            if ($encrypted) validate_key((string) $candidate);
            if (!key_is_available($candidate)) {
                $attempts++;
                continue;
            }
            $fp = @fopen(session_path($candidate), 'x');
            if ($fp !== false) {
                $newKey = $candidate;
                break;
            }
            $attempts++;
            if ($encrypted) break;
        }

        if ($newKey === null) {
            json_error(500, 'Could not generate a unique session key. Please try again.');
        }


        // Stamp initial version and retain only the public encrypted envelope.
        $body = $encrypted
            ? encrypted_session_payload($body, $body['writeCapabilityHash'])
            : array_diff_key($body, ['id' => true, 'temporaryAdminKey' => true]);
        $body['_v'] = 1;

        flock($fp, LOCK_EX);
        $written = fwrite($fp, json_encode($body));
        flock($fp, LOCK_UN);
        fclose($fp);

        if ($written === false) {
            @unlink(session_path($newKey));
            inventory_record_rolled_back($globalFp, $perIpFp);
            json_error(500, 'Could not save session.');
        }

        // Session JSON is on disk and immutable from here on out. Commit
        // the reservation so the reserved slot is kept — the counter now
        // matches reality (one file per reservation added under lock).
        inventory_record_reserved($clientIp, $globalFp, $perIpFp);

        // Reconstructed URL for analytics. Built from the env-overridable
        // SP_PUBLIC_BASE_URL instead of HTTP_HOST so a misrouted Host header
        // or X-Forwarded-Host cannot feed into the tracked event.
        $dynamicUrl = sp_public_base_url() . '/?id=' . $newKey;

        json_success(['key' => $newKey, 'version' => 1], 201);

    // ── PUT: update an existing session ──────────────────────────────────────
    case 'PUT':
        if ($key === null) {
            json_error(400, 'Missing key parameter.');
        }

        check_rate_limit('put');
        validate_key($key);

        $body = read_body();
        validate_workshop_data($body);
        $path = session_path($key);
        $lock = @fopen(session_lock_path($key), 'c');
        if ($lock === false || !flock($lock, LOCK_EX)) json_error(500, 'Could not lock session for update.');

        if (!file_exists($path)) {
            flock($lock, LOCK_UN);
            fclose($lock);
            json_error(404, 'Session not found. Use POST to create a new session.');
        }

        $storedRaw = file_get_contents($path);
        $stored = is_string($storedRaw) ? json_decode($storedRaw, true) : null;
        if (!is_array($stored)) {
            flock($lock, LOCK_UN);
            fclose($lock);
            json_error(500, 'Session data is corrupted.');
        }

        $isEncrypted = (($stored['format'] ?? null) === 'encrypted-v1');
        $clientVersion = isset($_GET['version']) && ctype_digit((string) $_GET['version']) ? (int) $_GET['version'] : null;
        if ($isEncrypted) {
            require_write_capability($stored);
            if (($body['format'] ?? null) !== 'encrypted-v1') json_error(422, 'Encrypted sessions require an encrypted envelope.');
            if ($clientVersion === null) json_error(400, 'Encrypted sessions require a version.');
            $body = encrypted_session_payload($body, $stored['writeCapabilityHash']);
        } else {
            unset($body['temporaryAdminKey'], $body['id']);
        }

        $serverVersion = (int) ($stored['_v'] ?? 0);
        if ($clientVersion !== null && $clientVersion !== $serverVersion) {
            flock($lock, LOCK_UN);
            fclose($lock);
            http_response_code(409);
            echo json_encode(
                ['error' => 'Conflict', 'serverVersion' => $serverVersion, 'data' => array_diff_key($stored, ['writeCapabilityHash' => true])],
                JSON_HEX_TAG | JSON_HEX_AMP | JSON_UNESCAPED_UNICODE
            );
            exit;
        }

        $body['_v'] = $serverVersion + 1;
        $serialized = json_encode($body);
        $temporaryPath = tempnam(SESSIONS_DIR, '.session-');
        $written = $temporaryPath !== false && $serialized !== false ? file_put_contents($temporaryPath, $serialized) : false;
        if ($written === false || $written === 0 || !rename($temporaryPath, $path)) {
            if ($temporaryPath !== false && file_exists($temporaryPath)) unlink($temporaryPath);
            flock($lock, LOCK_UN);
            fclose($lock);
            json_error(500, 'Could not update session.');
        }
        flock($lock, LOCK_UN);
        fclose($lock);
        json_success(['success' => true, 'version' => $body['_v']]);

    // ── DELETE: remove a session ──────────────────────────────────────────────
    case 'DELETE':
        if ($key === null) {
            json_error(400, 'Missing key parameter.');
        }

        check_rate_limit('delete');
        validate_key($key);

        ensure_sessions_dir();
        $path = session_path($key);
        $lock = @fopen(session_lock_path($key), 'c');
        if ($lock === false || !flock($lock, LOCK_EX)) json_error(500, 'Could not lock session for deletion.');
        if (!file_exists($path)) {
            flock($lock, LOCK_UN);
            fclose($lock);
            json_error(404, 'Session not found.');
        }

        $stored = json_decode((string) file_get_contents($path), true);
        if (!is_array($stored)) {
            flock($lock, LOCK_UN);
            fclose($lock);
            json_error(500, 'Session data is corrupted.');
        }
        if (($stored['format'] ?? null) === 'encrypted-v1') require_write_capability($stored);

        $trash = trashed_path($key);
        if (file_exists($trash) || !rename($path, $trash)) {
            flock($lock, LOCK_UN);
            fclose($lock);
            json_error(500, 'Could not move session to trash.');
        }
        flock($lock, LOCK_UN);
        fclose($lock);

        // Session is now in trash and invisible to GET. Decrement the global
        // and per-IP counters so the next capacity check reflects reality.
        // Per-IP attribution goes to the deleter, not the original creator —
        // any holder of the write capability can legitimately remove the
        // session, and a sudden drop on an IP that did not create the
        // session is exactly the kind of signal we want to surface.
        $deleterIp = session_client_ip();
        inventory_record_deleted($deleterIp);


        json_success(['success' => true]);

    default:
        json_error(405, 'Method not allowed.');
}
