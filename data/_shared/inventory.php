<?php
/**
 * Inventory counter helpers — shared between the Sessions API
 * (data/sessions.php) and any other writer that acts on the same session
 * storage outside the API's request/response cycle.
 *
 * Both sides keep a global session counter and a per-IP ledger alongside
 * SESSIONS_DIR. The API reserves a slot before writing the session file and
 * rolls the reservation back on failure; other writers (operator tooling,
 * restore from trash, bulk purge) act only on sessions that already exist
 * and need the matching decrement helpers. External writers intentionally
 * have no reservation surface — they cannot reject a delete on capacity
 * grounds.
 *
 * The constants and helpers in here are intentionally small and idempotent
 * so the public distribution can ship them without leaking operator
 * identifiers or escrow markers. All on-disk values are sha256(ip|ns) hashed
 * where applicable so no raw IP ever touches disk.
 */

declare(strict_types=1);

/**
 * Path to the global session-counter file. Defined as a constant so a
 * subsequent require_once() does not redefine it.
 */
if (!defined('INVENTORY_COUNT_FILE')) {
    define('INVENTORY_COUNT_FILE', SESSIONS_DIR . '/.inventory-count');
}

/**
 * Directory holding per-IP ledger files, named <sha256(ip)>.json. Same
 * pattern: defined as a constant so multiple require_once()s stay idempotent.
 */
if (!defined('PER_IP_DIR')) {
    define('PER_IP_DIR', SESSIONS_DIR . '/.per-ip');
}

/**
 * Atomic counter file helper. Opens the file in c+ mode, takes an exclusive
 * lock and returns the locked file pointer plus the existing entry as
 * decoded JSON. Callers MUST release with inventory_unlock(). The file is
 * created if it does not yet exist.
 *
 * @return array{0: resource, 1: array<string, mixed>}|null  null on IO failure
 */
function inventory_lock(string $file): ?array
{
    $fp = @fopen($file, 'c+');
    if ($fp === false) return null;
    if (!flock($fp, LOCK_EX)) { fclose($fp); return null; }
    $content = stream_get_contents($fp);
    $entry = $content === '' || $content === false ? [] : json_decode($content, true);
    if (!is_array($entry)) $entry = [];
    return [$fp, $entry];
}

/**
 * Write the in-memory entry back to the counter file and release the lock.
 */
function inventory_unlock($fp, array $entry): void
{
    rewind($fp);
    ftruncate($fp, 0);
    fwrite($fp, json_encode($entry));
    flock($fp, LOCK_UN);
    fclose($fp);
}

/**
 * Per-IP ledger entry path. Keyed by sha256(ip) so the raw IP never hits
 * disk; the directory layout mirrors the existing rate-limit pattern.
 */
function per_ip_path(string $ip): string
{
    return PER_IP_DIR . '/' . hash('sha256', $ip) . '.json';
}

/**
 * Atomic decrement of the global session counter. Used after a session is
 * moved to trash or permanently deleted by either the API or another writer.
 * Floored at zero — a counter that would otherwise go negative indicates a
 * missing increment somewhere upstream (the API's reservation flow guards
 * against this on its side; external writers are best-effort).
 *
 * Returns the post-update count or null on IO failure (which the caller
 * must NOT treat as a hard error for external bulk actions — a missing
 * write is recoverable on the next cold-start glob() bootstrap).
 */
function inventory_decrement(): ?int
{
    $locked = inventory_lock(INVENTORY_COUNT_FILE);
    if ($locked === null) return null;
    [$fp, $entry] = $locked;
    $entry['count'] = max(0, ($entry['count'] ?? 0) - 1);
    inventory_unlock($fp, $entry);
    return $entry['count'];
}

/**
 * Atomic increment of the global session counter. Used by restore flows to
 * undo a prior decrement when a trashed session is brought back into the
 * active directory. The API uses its own reservation-based path; this
 * function is for external writers where the active session file already
 * exists and we need to bring the counter back in step.
 *
 * Returns the post-update count or null on IO failure.
 */
function inventory_increment(): ?int
{
    $locked = inventory_lock(INVENTORY_COUNT_FILE);
    if ($locked === null) return null;
    [$fp, $entry] = $locked;
    $entry['count'] = ($entry['count'] ?? 0) + 1;
    inventory_unlock($fp, $entry);
    return $entry['count'];
}

/**
 * Atomic decrement of the per-IP ledger. Best-effort: a missing ledger
 * entry (e.g. an external writer deleting a session whose per-IP record was
 * already swept) is silently floored at zero.
 */
function per_ip_decrement(string $ip): ?int
{
    $locked = inventory_lock(per_ip_path($ip));
    if ($locked === null) return null;
    [$fp, $entry] = $locked;
    $entry['count'] = max(0, ($entry['count'] ?? 0) - 1);
    $entry['ts'] = time();
    inventory_unlock($fp, $entry);
    return $entry['count'];
}

/**
 * Atomic increment of the per-IP ledger. Symmetric counterpart to
 * per_ip_decrement for restore flows.
 */
function per_ip_increment(string $ip): ?int
{
    $locked = inventory_lock(per_ip_path($ip));
    if ($locked === null) return null;
    [$fp, $entry] = $locked;
    $entry['count'] = ($entry['count'] ?? 0) + 1;
    $entry['ts'] = time();
    inventory_unlock($fp, $entry);
    return $entry['count'];
}

/**
 * Record that an existing session vanished — either because the API moved it
 * to trash, or because another writer deleted/purged it. Decrements the
 * global counter and (if supplied) the per-IP ledger. The IP is optional
 * because external bulk actions do not have an attribution IP; in that case
 * only the global counter is touched.
 */
function inventory_record_deleted(?string $ip = null): void
{
    inventory_decrement();
    if (is_string($ip) && $ip !== '') {
        per_ip_decrement($ip);
    }
}

/**
 * Record that a previously-trashed session is restored into the live
 * directory. Symmetric counterpart to inventory_record_deleted — increments
 * the global counter and (if supplied) the per-IP ledger so the post-restore
 * state matches the post-create state. The API does not call this; its own
 * POST path uses the reservation machinery instead.
 */
function inventory_record_created(?string $ip = null): void
{
    inventory_increment();
    if (is_string($ip) && $ip !== '') {
        per_ip_increment($ip);
    }
}