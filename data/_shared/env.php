<?php
/**
 * Minimal .env loader without external dependencies for the data endpoints.
 *
 * Search order, the first file found wins:
 *   1. dirname(__DIR__, 3)/.env   repository root (local) or the operator's
 *                                 .env above the webroot. See the deployment
 *                                 documentation for the recommended path.
 *   2. __DIR__/.env               data/_shared/.env (local, gitignored). Only
 *                                 a fallback when no root .env exists.
 *
 * Real environment variables (getenv) always take precedence over .env values
 * and are not overwritten. The loader reads only files the operator provides:
 * no secret in the source code, no sensitive defaults.
 */

declare(strict_types=1);

if (!function_exists('backend_env_load')) {
    /**
     * Lädt Umgebungsvariablen aus einer .env-Datei. Idempotent: nach dem
     * ersten Aufruf in einem Request ist die Datei geladen und wird
     * nicht erneut gelesen, auch wenn mehrere Endpunkte die Funktion
     * aufrufen.
     *
     * @param array<int,string>|null $searchPaths  Optionale Override-Liste der
     *                                              zu prüfenden Pfade. Default:
     *                                              siehe Datei-File-Kopfbereich.
     */
    function backend_env_load(?array $searchPaths = null): void
    {
        static $loaded = false;
        if ($loaded) {
            return;
        }
        $loaded = true;

        if ($searchPaths === null) {
            $searchPaths = [
                dirname(__DIR__, 3) . '/.env',
                __DIR__ . '/.env',
            ];
        }

        foreach ($searchPaths as $file) {
            if (!is_file($file) || !is_readable($file)) {
                continue;
            }

            $lines = file($file, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
            if (!is_array($lines)) {
                continue;
            }

            foreach ($lines as $line) {
                $line = trim($line);
                if ($line === '' || $line[0] === '#') {
                    continue;
                }
                if (strpos($line, 'export ') === 0) {
                    $line = ltrim(substr($line, 7));
                }
                $eq = strpos($line, '=');
                if ($eq === false) {
                    continue;
                }
                $key = trim(substr($line, 0, $eq));
                $value = trim(substr($line, $eq + 1));

                // Umgebende Quotes entfernen
                if (strlen($value) >= 2 && ($value[0] === '"' || $value[0] === "'") && substr($value, -1) === $value[0]) {
                    $value = substr($value, 1, -1);
                }

                if ($key === '' || getenv($key) !== false) {
                    continue;
                }
                putenv($key . '=' . $value);
                $_ENV[$key] = $value;
            }

            // Nur die erste gefundene .env wird geladen
            break;
        }
    }
}