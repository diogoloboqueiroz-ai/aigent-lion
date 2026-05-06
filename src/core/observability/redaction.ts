const REDACTED = "[REDACTED]";
const TRUNCATED_SUFFIX = " [TRUNCATED]";
const SENSITIVE_KEY_PATTERN =
  /(token|secret|password|authorization|cookie|session|api[_-]?key|appPassword|access[_-]?token|refresh[_-]?token|client[_-]?secret|metaAccessToken|ga4ApiSecret)/i;

const QUERY_PARAM_PATTERN =
  /([?&](?:access_token|refresh_token|client_secret|api_key|token|code_verifier|password|secret)=)([^&#\s]+)/gi;
const AUTH_HEADER_PATTERN = /\b(Bearer|Basic)\s+[A-Za-z0-9._~+\/=-]+/gi;
const JSON_STRING_PATTERN =
  /(["']?(?:accessToken|refreshToken|clientSecret|apiSecret|metaAccessToken|ga4ApiSecret|token|password|appPassword|authorization|cookie|session|developer-token|x-api-key)["']?\s*[:=]\s*["'])([^"']+)(["'])/gi;
const KEY_VALUE_PATTERN =
  /\b((?:accessToken|refreshToken|clientSecret|apiSecret|metaAccessToken|ga4ApiSecret|token|password|appPassword|authorization|cookie|session|developer-token|x-api-key)\s*[=:]\s*)([^\s,;]+)/gi;

export function redactSensitiveText(input: string | null | undefined) {
  const text = String(input ?? "");
  if (!text) {
    return "";
  }

  return text
    .replace(QUERY_PARAM_PATTERN, `$1${REDACTED}`)
    .replace(AUTH_HEADER_PATTERN, (_, scheme: string) => `${scheme} ${REDACTED}`)
    .replace(JSON_STRING_PATTERN, `$1${REDACTED}$3`)
    .replace(KEY_VALUE_PATTERN, `$1${REDACTED}`);
}

export function sanitizeAuditText(input: string | null | undefined, maxLength = 600) {
  const sanitized = redactSensitiveText(input).trim();
  if (!sanitized) {
    return "";
  }

  if (sanitized.length <= maxLength) {
    return sanitized;
  }

  return `${sanitized.slice(0, Math.max(0, maxLength - TRUNCATED_SUFFIX.length)).trimEnd()}${TRUNCATED_SUFFIX}`;
}

export function sanitizeErrorMessage(error: unknown, fallback?: string) {
  const safeFallback = fallback?.trim() || "Erro inesperado.";

  if (error instanceof Error) {
    const message = sanitizeAuditText(error.message, 400);
    return message || safeFallback;
  }

  if (typeof error === "string") {
    const message = sanitizeAuditText(error, 400);
    return message || safeFallback;
  }

  return safeFallback;
}

export async function readSanitizedResponseText(
  response: Pick<Response, "text">,
  fallback: string
) {
  try {
    const text = await response.text();
    const sanitized = sanitizeAuditText(text, 500);
    return sanitized || fallback;
  } catch {
    return fallback;
  }
}

export function sanitizeStructuredPayload<T>(value: T, depth = 0): T {
  if (depth > 6) {
    return value;
  }

  if (typeof value === "string") {
    return redactSensitiveText(value) as T;
  }

  if (Array.isArray(value)) {
    return value.map((entry) => sanitizeStructuredPayload(entry, depth + 1)) as T;
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const entries = Object.entries(value as Record<string, unknown>).map(([key, entryValue]) => {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      return [key, REDACTED];
    }

    return [key, sanitizeStructuredPayload(entryValue, depth + 1)];
  });

  return Object.fromEntries(entries) as T;
}
