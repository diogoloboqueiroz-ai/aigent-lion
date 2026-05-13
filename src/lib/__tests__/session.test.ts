import assert from "node:assert/strict";
import test from "node:test";
import {
  createSessionToken,
  isSessionSecretExplicitlyConfigured,
  readSessionToken
} from "@/lib/session";

const mutableEnv = process.env as Record<string, string | undefined>;

function withSessionEnv<T>(input: {
  nodeEnv?: string;
  sessionSecret?: string;
  run: () => T;
}) {
  const previousNodeEnv = process.env.NODE_ENV;
  const previousSessionSecret = process.env.AUTH_SESSION_SECRET;

  if (input.nodeEnv === undefined) {
    delete mutableEnv.NODE_ENV;
  } else {
    mutableEnv.NODE_ENV = input.nodeEnv;
  }

  if (input.sessionSecret === undefined) {
    delete mutableEnv.AUTH_SESSION_SECRET;
  } else {
    mutableEnv.AUTH_SESSION_SECRET = input.sessionSecret;
  }

  try {
    return input.run();
  } finally {
    if (previousNodeEnv === undefined) {
      delete mutableEnv.NODE_ENV;
    } else {
      mutableEnv.NODE_ENV = previousNodeEnv;
    }

    if (previousSessionSecret === undefined) {
      delete mutableEnv.AUTH_SESSION_SECRET;
    } else {
      mutableEnv.AUTH_SESSION_SECRET = previousSessionSecret;
    }
  }
}

test("session tokens roundtrip with an explicit secret", () => {
  const token = withSessionEnv({
    nodeEnv: "production",
    sessionSecret: "session-secret-for-tests",
    run: () =>
      createSessionToken({
        provider: "google",
        sub: "sub-1",
        email: "user@example.com",
        name: "User"
      })
  });

  const session = withSessionEnv({
    nodeEnv: "production",
    sessionSecret: "session-secret-for-tests",
    run: () => readSessionToken(token)
  });

  assert.equal(session?.email, "user@example.com");
  assert.equal(isSessionSecretExplicitlyConfigured(), false);
});

test("session issuance fails closed in production without AUTH_SESSION_SECRET", () => {
  assert.throws(
    () =>
      withSessionEnv({
        nodeEnv: "production",
        run: () =>
          createSessionToken({
            provider: "google",
            sub: "sub-2",
            email: "blocked@example.com",
            name: "Blocked"
          })
      }),
    /AUTH_SESSION_SECRET ausente/
  );
});

test("session verification returns null in production without AUTH_SESSION_SECRET", () => {
  const token = withSessionEnv({
    nodeEnv: "production",
    sessionSecret: "session-secret-for-tests",
    run: () =>
      createSessionToken({
        provider: "google",
        sub: "sub-3",
        email: "verify@example.com",
        name: "Verify"
      })
  });

  const session = withSessionEnv({
    nodeEnv: "production",
    run: () => readSessionToken(token)
  });

  assert.equal(session, null);
});
