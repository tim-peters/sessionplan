<?php
/**
 * Filesystem boundary. URL paths and the session protocol are independent of
 * storage paths.
 *
 * Relative SP_* env values are anchored at the tree root via dirname(__DIR__,
 * N) so PHP's built-in dev server chdir()s (which use the requested script's
 * directory on every request) cannot change the resolved path.
 * Self-hosting: pass absolute paths through the server environment. See the
 * deployment documentation for the recommended layout.
 */
function backend_content_dir(string $relative = ''): string
{
    $configured = getenv('SP_CONTENT_DIR');
    $default = dirname(__DIR__);
    if ($configured === false || $configured === '') {
        $root = $default;
    } elseif ($configured === '/' || $configured[0] === '/') {
        $root = $configured;
    } else {
        $root = dirname(__DIR__, 3) . '/' . $configured;
    }
    return rtrim($root, '/') . ($relative === '' ? '' : '/' . ltrim($relative, '/'));
}

function backend_sessions_dir(): string
{
    $configured = getenv('SP_SESSIONS_DIR');
    $default = dirname(__DIR__, 3) . '/sessions_data';
    if ($configured === false || $configured === '') {
        return rtrim($default, '/');
    }
    if ($configured !== '/' && $configured[0] === '/') {
        return rtrim($configured, '/');
    }
    // Sessions were already anchored here before the tree root moved; keep the
    // same anchor for relative overrides so dev and CLI resolve identically.
    return rtrim(dirname(__DIR__, 3) . '/' . $configured, '/');
}
