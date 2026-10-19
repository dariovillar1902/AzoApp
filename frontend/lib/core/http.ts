const DEFAULT_TIMEOUT_MS = 8000;

/**
 * Same as `fetch`, but aborts after `timeoutMs` instead of hanging
 * indefinitely. One slow/unresponsive site shouldn't eat the whole
 * request's budget on a serverless function with a hard time limit.
 */
export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
