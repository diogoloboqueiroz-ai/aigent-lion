import assert from "node:assert/strict";
import test from "node:test";
import {
  buildObservabilityPayloadSignature,
  isObservabilityCollectorAuthorized
} from "@/core/observability/collector-auth";

const payload = JSON.stringify({
  companySlug: "acme",
  generatedAt: "2026-04-23T10:00:00.000Z",
  metrics: []
});

test("collector auth accepts valid bearer token and signature", () => {
  const signature = buildObservabilityPayloadSignature(payload, "signing-secret");

  const allowed = isObservabilityCollectorAuthorized({
    authorizationHeader: "Bearer collector-token",
    expectedBearerToken: "collector-token",
    signatureHeader: signature,
    signingSecret: "signing-secret",
    payload
  });

  assert.equal(allowed, true);
});

test("collector auth rejects invalid signature", () => {
  const allowed = isObservabilityCollectorAuthorized({
    authorizationHeader: "Bearer collector-token",
    expectedBearerToken: "collector-token",
    signatureHeader: "wrong-signature",
    signingSecret: "signing-secret",
    payload
  });

  assert.equal(allowed, false);
});
