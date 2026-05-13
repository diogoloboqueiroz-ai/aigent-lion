import test from "node:test";
import assert from "node:assert/strict";
import {
  redactSensitiveText,
  sanitizeAuditText,
  sanitizeStructuredPayload
} from "@/core/observability/redaction";

test("redacts query params and auth headers", () => {
  const input =
    "POST /callback?access_token=abc123&refresh_token=xyz789 Authorization: Bearer secret-token-value";
  const sanitized = redactSensitiveText(input);

  assert.equal(sanitized.includes("abc123"), false);
  assert.equal(sanitized.includes("xyz789"), false);
  assert.equal(sanitized.includes("secret-token-value"), false);
  assert.ok(sanitized.includes("[REDACTED]"));
});

test("sanitizes structured payloads by key", () => {
  const payload = {
    accessToken: "plain-token",
    nested: {
      clientSecret: "super-secret",
      note: "ok"
    }
  };

  const sanitized = sanitizeStructuredPayload(payload);

  assert.equal(sanitized.accessToken, "[REDACTED]");
  assert.equal(sanitized.nested.clientSecret, "[REDACTED]");
  assert.equal(sanitized.nested.note, "ok");
});

test("audit text truncates large payloads after redaction", () => {
  const input = `authorization=Bearer giant-secret ${"x".repeat(800)}`;
  const sanitized = sanitizeAuditText(input, 80);

  assert.equal(sanitized.includes("giant-secret"), false);
  assert.ok(sanitized.endsWith("[TRUNCATED]"));
});
