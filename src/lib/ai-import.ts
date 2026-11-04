/**
 * ai-import — constants and helpers for the AI-assisted session import dialog.
 *
 * Role: Central place for the external URLs the AI import paths reference
 *       (MCP docs, Claude plugin install snippets, OpenAPI spec, ChatGPT app),
 *       the agent-briefing template the "Code Agent" tab copies to the
 *       clipboard, and the shared clipboard helper. Keeps
 *       AiImportPathConnect/Manual/Agent pure presentation components.
 * Used by: src/modules/sidebar/AiImport{PathConnect,PathManual,PathAgent}.tsx
 */

// Public documentation links
export const SCHEMA_URL = 'https://sessionplan.de/import-schema.md';
export const MCP_DOCS_URL = 'https://sessionplan.de/mcp.md';
export const API_SKILL_URL = 'https://sessionplan.de/data/sessionplan-api.md';
export const OPENAPI_URL = 'https://sessionplan.de/data/openapi.yaml';

// Claude plugin install snippets (two-line copy block)
export const CLAUDE_MARKETPLACE_ADD = '/plugin marketplace add tim-peters/sessionplan-claude-plugin';
export const CLAUDE_PLUGIN_INSTALL = '/plugin install sessionplan@sessionplan';
export const CLAUDE_PLUGIN_REPO_URL = 'https://github.com/tim-peters/sessionplan-claude-plugin';

// Example prompt placeholder shown beneath the install snippet. i18n-loaded
// by the tab component (see settings.aiConnectClaudePromptExample) — this
// module stays free of localized copy.
export const CLAUDE_EXAMPLE_PROMPT_PLACEHOLDER = '[example-prompt]';

// Hardcoded default URL for the Sessionplan ChatGPT app. Ensures the
// ChatGPT section on the "Connect" tab is always reachable in production
// AND in local/dev builds where neither env var is set. Env vars override
// this default — see getChatgptAppUrl().
export const SESSIONPLAN_CHATGPT_APP_URL =
  'https://chatgpt.com/plugins/plugin_asdk_app_6a85ce1d322881919f2f89fa715f0739';

/**
 * Build the Claude install snippet used as the read-only copy block on the
 * "Weg A — Connect" tab. Kept here so both the snippet and the per-line
 * constants share a single source of truth.
 */
export const buildClaudeInstallSnippet = (): string =>
  `${CLAUDE_MARKETPLACE_ADD}\n${CLAUDE_PLUGIN_INSTALL}`;

/**
 * Resolve the ChatGPT app URL.
 *
 * Resolution order (highest priority first):
 *   1. VITE_SESSIONPLAN_CHATGPT_APP_URL — operator-supplied override
 *   2. VITE_SESSIONPLAN_CUSTOM_GPT_URL — legacy Custom-GPT override
 *   3. SESSIONPLAN_CHATGPT_APP_URL     — hardcoded public default, so the
 *                                        section stays visible even without
 *                                        any build-time configuration.
 *
 * Always returns a non-empty string, so the ChatGPT section on the connect
 * tab is guaranteed to render.
 */
export const getChatgptAppUrl = (): string => {
  const chatgptApp = import.meta.env.VITE_SESSIONPLAN_CHATGPT_APP_URL as string | undefined;
  if (chatgptApp && chatgptApp.trim().length > 0) return chatgptApp;
  const customGpt = import.meta.env.VITE_SESSIONPLAN_CUSTOM_GPT_URL as string | undefined;
  if (customGpt && customGpt.trim().length > 0) return customGpt;
  return SESSIONPLAN_CHATGPT_APP_URL;
};

/**
 * Copy `text` to the clipboard. Resolves to true on success.
 *
 * Tries the modern Clipboard API first, then falls back to a hidden
 * `<textarea>` + `document.execCommand('copy')` for environments where the
 * async API is unavailable or blocked (insecure contexts, older browsers,
 * strict permissions). Kept here so the three path components don't repeat
 * the same try/catch dance.
 */
export const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  }
};

/**
 * Build the briefing template copied from the "Code Agent" tab.
 *
 * The agent is told to copy the finished link straight from the API
 * response — never to assemble it themselves — so that the link the user
 * actually receives matches the one stored in the snapshot endpoint byte-for-
 * byte (no hand-rolled reconstruction, which would risk drift).
 *
 * The full localized sentence is passed in via `briefingText` so this module
 * remains i18n-free. The function only injects the API docs URL where the
 * template needs it.
 */
export const AGENT_BRIEFING_TEMPLATE = (
  apiDocsUrl: string,
  briefingText: string,
  descriptionPlaceholder: string
): string =>
  briefingText
    .replace('{apiDocsUrl}', apiDocsUrl)
    .replace('{description}', descriptionPlaceholder);

