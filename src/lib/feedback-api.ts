/**
 * feedback-api — Thin client for POSTing anonymous feedback to an optional,
 * operator-provided endpoint. Returns a discriminated union so the UI never has
 * to deal with thrown errors for the common 4xx/5xx cases.
 */

export type ReceivedVia = 'exit' | 'card' | 'menu';

export interface FeedbackPayload {
  rating: number; // 1..5
  text?: string; // ≤ 2000 chars (server-enforced)
  email?: string; // optional reply address, ≤ 254 chars (server-validated)
  receivedVia: ReceivedVia;
  website?: string; // honeypot — must be empty for the request to be accepted
}

export type FeedbackResult = { ok: true } | { ok: false; reason?: 'network' | 'http' };

/** Resolved at build time via Vite. Undefined ⇒ the UI renders nothing. */
export const FEEDBACK_API_URL: string | null =
  (import.meta.env.VITE_FEEDBACK_API as string | undefined) || null;

const REQUEST_TIMEOUT_MS = 8_000;
const DEV = import.meta.env.DEV;


/**
 * POST the feedback payload. Never throws — network / non-2xx responses are
 * folded into `{ ok: false }` so the UI can show an error state without
 * surrounding try/catch boilerplate.
 */
export const submitFeedback = async (payload: FeedbackPayload): Promise<FeedbackResult> => {
  if (!FEEDBACK_API_URL) return { ok: false, reason: 'network' };

  // Only include the allowed fields — the server rejects unknown keys with 422.
  const body: Record<string, unknown> = {
    rating: payload.rating,
    receivedVia: payload.receivedVia,
  };
  if (typeof payload.text === 'string' && payload.text.length > 0) {
    body.text = payload.text;
  }
  if (typeof payload.email === 'string' && payload.email.length > 0) {
    body.email = payload.email;
  }
  if (typeof payload.website === 'string' && payload.website.length > 0) {
    // Honeypot is sent only when filled (bots fill it, humans don't).
    body.website = payload.website;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(FEEDBACK_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (response.status === 201) {
      if (DEV) console.debug('[Feedback] submit ok', { receivedVia: payload.receivedVia });
      return { ok: true };
    }
    if (DEV) console.debug('[Feedback] submit failed', { status: response.status });
    return { ok: false, reason: 'http' };
  } catch (error) {
    if (DEV) console.debug('[Feedback] submit error', error);
    return { ok: false, reason: 'network' };
  } finally {
    clearTimeout(timeoutId);
  }
};
