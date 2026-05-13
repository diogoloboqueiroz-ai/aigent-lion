const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
const missing = ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"].filter(
  (key) => !process.env[key]?.trim()
);

const redirectUris = appUrl
  ? {
      login: `${appUrl}/api/auth/google/callback`,
      companyConnection: `${appUrl}/api/auth/google/connect/callback`
    }
  : null;

console.log(
  JSON.stringify(
    {
      ok: missing.length === 0,
      checkedAt: new Date().toISOString(),
      missing,
      redirectUris,
      notes: redirectUris
        ? [
            "Cadastre exatamente estes redirect URIs no Google Cloud OAuth Client.",
            "Depois configure GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no ambiente da Vercel."
          ]
        : [
            "NEXT_PUBLIC_APP_URL ausente; defina a URL publica do ambiente para listar os redirect URIs esperados.",
            "GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET continuam obrigatorios para login real."
          ]
    },
    null,
    2
  )
);

if (missing.length > 0) {
  process.exitCode = 1;
}
