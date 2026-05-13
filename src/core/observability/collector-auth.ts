import { createHmac, timingSafeEqual } from "node:crypto";

export function buildObservabilityPayloadSignature(payload: string, secret: string) {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function isObservabilityCollectorAuthorized(input: {
  authorizationHeader?: string | null;
  expectedBearerToken?: string | null;
  signatureHeader?: string | null;
  signingSecret?: string | null;
  payload: string;
}) {
  const expectedBearerToken = input.expectedBearerToken?.trim();
  if (expectedBearerToken) {
    const receivedToken = normalizeBearerToken(input.authorizationHeader);
    if (!receivedToken || receivedToken !== expectedBearerToken) {
      return false;
    }
  }

  const signingSecret = input.signingSecret?.trim();
  if (signingSecret) {
    const expectedSignature = buildObservabilityPayloadSignature(input.payload, signingSecret);
    const receivedSignature = (input.signatureHeader ?? "").trim();
    if (!receivedSignature) {
      return false;
    }

    const expectedBuffer = Buffer.from(expectedSignature);
    const receivedBuffer = Buffer.from(receivedSignature);
    if (expectedBuffer.length !== receivedBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, receivedBuffer);
  }

  return true;
}

function normalizeBearerToken(authorizationHeader?: string | null) {
  const header = authorizationHeader?.trim();
  if (!header) {
    return null;
  }

  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}
