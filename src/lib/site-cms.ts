import {
  getStoredCompanySiteCmsConnection,
  upsertStoredCompanySiteCmsConnection,
  upsertStoredCompanySiteOpsProfile
} from "@/lib/company-vault";
import { readSanitizedResponseText } from "@/core/observability/redaction";
import type { CompanySiteOpsProfile } from "@/lib/domain";

type WordPressUserResponse = {
  id: number;
  name?: string;
  slug?: string;
};

type WordPressPageResponse = {
  id: number;
  link?: string;
  status?: string;
};

type PublishWordPressLandingInput = {
  companySlug: string;
  profile: CompanySiteOpsProfile;
  title: string;
  slug: string;
  summary: string;
  bulletPoints: string[];
  ctaLabel: string;
  ctaUrl: string;
  status: "draft" | "publish" | "pending" | "private";
};

export async function connectWordPressSite(input: {
  companySlug: string;
  profile: CompanySiteOpsProfile;
  siteUrl: string;
  username: string;
  appPassword: string;
}) {
  const siteUrl = normalizeSiteUrl(input.siteUrl || input.profile.cmsSiteUrl);
  const username = input.username.trim();
  const appPassword = normalizeAppPassword(input.appPassword);

  if (!siteUrl || !username || !appPassword) {
    throw new Error("Para conectar o WordPress, informe URL do site, usuario e application password.");
  }

  const user = await fetchWordPressCurrentUser(siteUrl, username, appPassword);
  const now = new Date().toISOString();

  upsertStoredCompanySiteCmsConnection({
    companySlug: input.companySlug,
    provider: "wordpress",
    siteUrl,
    username,
    appPassword,
    createdAt: now,
    updatedAt: now
  });

  const nextProfile = {
    ...input.profile,
    cmsProvider: "wordpress" as const,
    cmsSiteUrl: siteUrl,
    cmsUsername: username,
    cmsConnectionStatus: "connected" as const,
    cmsLastSyncAt: now,
    cmsLastSyncSummary: `WordPress conectado como ${user.name || user.slug || username}.`,
    updatedAt: now
  };

  upsertStoredCompanySiteOpsProfile(nextProfile);
  return nextProfile;
}

export async function publishLandingPageToWordPress(input: PublishWordPressLandingInput) {
  const connection = getStoredCompanySiteCmsConnection(input.companySlug, "wordpress");
  if (!connection) {
    throw new Error("Conexao WordPress nao encontrada para esta empresa.");
  }

  const response = await fetch(`${stripTrailingSlash(connection.siteUrl)}/wp-json/wp/v2/pages`, {
    method: "POST",
    headers: {
      Authorization: buildWordPressAuthHeader(connection.username, connection.appPassword),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      title: input.title,
      slug: input.slug,
      status: input.status,
      excerpt: input.summary,
      content: renderLandingHtml(input)
    })
  });

  if (!response.ok) {
    throw new Error(
      await readSanitizedResponseText(response, "Falha ao publicar landing page no WordPress.")
    );
  }

  const payload = (await response.json()) as WordPressPageResponse;
  const now = new Date().toISOString();
  const nextProfile = {
    ...input.profile,
    cmsProvider: "wordpress" as const,
    cmsSiteUrl: connection.siteUrl,
    cmsUsername: connection.username,
    cmsConnectionStatus: "connected" as const,
    cmsLastSyncAt: now,
    cmsLastSyncSummary: `Landing "${input.title}" enviada para o WordPress com status ${payload.status || input.status}.`,
    lastPublishedLandingTitle: input.title,
    lastPublishedLandingUrl: payload.link,
    updatedAt: now
  };

  upsertStoredCompanySiteOpsProfile(nextProfile);

  return {
    pageId: payload.id,
    pageUrl: payload.link,
    status: payload.status || input.status,
    profile: nextProfile
  };
}

async function fetchWordPressCurrentUser(siteUrl: string, username: string, appPassword: string) {
  const response = await fetch(`${stripTrailingSlash(siteUrl)}/wp-json/wp/v2/users/me?context=edit`, {
    headers: {
      Authorization: buildWordPressAuthHeader(username, appPassword)
    }
  });

  if (!response.ok) {
    throw new Error(
      await readSanitizedResponseText(response, "Falha ao validar credenciais WordPress.")
    );
  }

  return (await response.json()) as WordPressUserResponse;
}

function renderLandingHtml(input: PublishWordPressLandingInput) {
  const bullets = input.bulletPoints
    .filter(Boolean)
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");

  return [
    "<section class=\"agent-lion-landing\">",
    `  <h1>${escapeHtml(input.title)}</h1>`,
    `  <p>${escapeHtml(input.summary)}</p>`,
    bullets ? `  <ul>${bullets}</ul>` : "",
    `  <p><a href=\"${escapeAttribute(input.ctaUrl)}\">${escapeHtml(input.ctaLabel)}</a></p>`,
    "</section>"
  ]
    .filter(Boolean)
    .join("\n");
}

function buildWordPressAuthHeader(username: string, appPassword: string) {
  const token = Buffer.from(`${username}:${normalizeAppPassword(appPassword)}`).toString("base64");
  return `Basic ${token}`;
}

function normalizeSiteUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    return stripTrailingSlash(trimmed);
  }

  return stripTrailingSlash(`https://${trimmed}`);
}

function normalizeAppPassword(value: string) {
  return value.replace(/\s+/g, "").trim();
}

function stripTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value: string) {
  return escapeHtml(value);
}
