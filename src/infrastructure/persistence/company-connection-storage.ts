import {
  hydrateCrmConnection,
  hydrateGoogleConnection,
  hydrateSiteCmsConnection,
  hydrateSocialConnection,
  hydrateTrackingCredential
} from "@/infrastructure/persistence/company-vault-hydration";
import {
  readCompanyVaultPayload,
  writeCompanyVaultPayload
} from "@/infrastructure/persistence/company-vault-payload-store";
import {
  upsertStoredCompanyCrmConnectionSecret,
  upsertStoredCompanySiteCmsSecret,
  upsertStoredCompanyTrackingSecret,
  upsertStoredGoogleCompanyConnectionSecret,
  upsertStoredSocialCompanyConnectionSecret
} from "@/infrastructure/secrets/tenant-secrets-store";
import type { PlatformId, SocialPlatformId } from "@/lib/domain";

export type GoogleConnectionMetadata = {
  companySlug: string;
  platform: PlatformId;
  accountEmail: string;
  accountName: string;
  googleSub: string;
  scopes: string[];
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
  hasRefreshToken: boolean;
};

export type GoogleConnectionRecord = Omit<GoogleConnectionMetadata, "hasRefreshToken"> & {
  accessToken: string;
  refreshToken?: string;
};

export type SocialConnectionMetadata = {
  companySlug: string;
  platform: SocialPlatformId;
  provider: "meta" | "linkedin" | "tiktok";
  accountLabel: string;
  externalUserId?: string;
  scopes: string[];
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
  hasRefreshToken: boolean;
};

export type SocialConnectionRecord = Omit<SocialConnectionMetadata, "hasRefreshToken"> & {
  accessToken: string;
  refreshToken?: string;
};

export type CrmConnectionMetadata = {
  companySlug: string;
  provider: "hubspot";
  accountLabel?: string;
  portalId?: string;
  scopes: string[];
  createdAt: string;
  updatedAt: string;
};

export type CrmConnectionRecord = CrmConnectionMetadata & {
  accessToken: string;
};

export type SiteCmsConnectionMetadata = {
  companySlug: string;
  provider: "wordpress";
  siteUrl: string;
  username: string;
  createdAt: string;
  updatedAt: string;
};

export type SiteCmsConnectionRecord = SiteCmsConnectionMetadata & {
  appPassword: string;
};

export type TrackingCredentialMetadata = {
  companySlug: string;
  createdAt: string;
  updatedAt: string;
  hasGa4ApiSecret: boolean;
  hasMetaAccessToken: boolean;
};

export type TrackingCredentialRecord = {
  companySlug: string;
  ga4ApiSecret?: string;
  metaAccessToken?: string;
  createdAt: string;
  updatedAt: string;
};

type ConnectionVaultPayload = {
  googleConnections: GoogleConnectionMetadata[];
  socialConnections: SocialConnectionMetadata[];
  crmConnections: CrmConnectionMetadata[];
  siteCmsConnections: SiteCmsConnectionMetadata[];
  trackingCredentials: TrackingCredentialMetadata[];
};

type WriteConnectionPayload<TPayload extends ConnectionVaultPayload> = (payload: TPayload) => void;

export function getStoredGoogleConnectionsFromPayload(payload: ConnectionVaultPayload) {
  return listHydratedGoogleConnections(payload.googleConnections);
}

export function getPersistedGoogleCompanyConnections() {
  return getStoredGoogleConnectionsFromPayload(readCompanyVaultPayload());
}

export function getStoredGoogleConnectionFromPayload(
  payload: ConnectionVaultPayload,
  companySlug: string,
  platform: PlatformId
) {
  return findHydratedGoogleConnection(payload.googleConnections, companySlug, platform);
}

export function getPersistedGoogleCompanyConnection(
  companySlug: string,
  platform: PlatformId
) {
  return getStoredGoogleConnectionFromPayload(readCompanyVaultPayload(), companySlug, platform);
}

export function upsertStoredGoogleConnectionInPayload<TPayload extends ConnectionVaultPayload>(
  input: {
    payload: TPayload;
    writePayload: WriteConnectionPayload<TPayload>;
    connection: GoogleConnectionRecord;
  }
) {
  const nextConnections = upsertGoogleConnectionMetadata(
    input.payload.googleConnections,
    input.connection
  );

  upsertStoredGoogleCompanyConnectionSecret({
    companySlug: input.connection.companySlug,
    platform: input.connection.platform,
    accessToken: input.connection.accessToken,
    refreshToken: input.connection.refreshToken,
    updatedAt: input.connection.updatedAt
  });

  input.writePayload({
    ...input.payload,
    googleConnections: nextConnections
  });
}

export function upsertPersistedGoogleCompanyConnection(connection: GoogleConnectionRecord) {
  upsertStoredGoogleConnectionInPayload({
    payload: readCompanyVaultPayload(),
    writePayload: writeCompanyVaultPayload,
    connection
  });
}

export function getStoredSocialConnectionsFromPayload(
  payload: ConnectionVaultPayload,
  companySlug?: string
) {
  const connections = listHydratedSocialConnections(payload.socialConnections);
  return companySlug
    ? connections.filter((connection) => connection.companySlug === companySlug)
    : connections;
}

export function getPersistedSocialCompanyConnections(companySlug?: string) {
  return getStoredSocialConnectionsFromPayload(readCompanyVaultPayload(), companySlug);
}

export function getStoredSocialConnectionFromPayload(
  payload: ConnectionVaultPayload,
  companySlug: string,
  platform: SocialPlatformId
) {
  return findHydratedSocialConnection(payload.socialConnections, companySlug, platform);
}

export function getPersistedSocialCompanyConnection(
  companySlug: string,
  platform: SocialPlatformId
) {
  return getStoredSocialConnectionFromPayload(readCompanyVaultPayload(), companySlug, platform);
}

export function upsertStoredSocialConnectionInPayload<TPayload extends ConnectionVaultPayload>(
  input: {
    payload: TPayload;
    writePayload: WriteConnectionPayload<TPayload>;
    connection: SocialConnectionRecord;
  }
) {
  const nextConnections = upsertSocialConnectionMetadata(
    input.payload.socialConnections,
    input.connection
  );

  upsertStoredSocialCompanyConnectionSecret({
    companySlug: input.connection.companySlug,
    platform: input.connection.platform,
    accessToken: input.connection.accessToken,
    refreshToken: input.connection.refreshToken,
    updatedAt: input.connection.updatedAt
  });

  input.writePayload({
    ...input.payload,
    socialConnections: nextConnections
  });
}

export function upsertPersistedSocialCompanyConnection(connection: SocialConnectionRecord) {
  upsertStoredSocialConnectionInPayload({
    payload: readCompanyVaultPayload(),
    writePayload: writeCompanyVaultPayload,
    connection
  });
}

export function getStoredCrmConnectionsFromPayload(
  payload: ConnectionVaultPayload,
  companySlug?: string
) {
  const connections = listHydratedCrmConnections(payload.crmConnections);
  return companySlug
    ? connections.filter((connection) => connection.companySlug === companySlug)
    : connections;
}

export function getPersistedCompanyCrmConnections(companySlug?: string) {
  return getStoredCrmConnectionsFromPayload(readCompanyVaultPayload(), companySlug);
}

export function getStoredCrmConnectionFromPayload(
  payload: ConnectionVaultPayload,
  companySlug: string,
  provider: "hubspot"
) {
  return findHydratedCrmConnection(payload.crmConnections, companySlug, provider);
}

export function getPersistedCompanyCrmConnection(
  companySlug: string,
  provider: "hubspot"
) {
  return getStoredCrmConnectionFromPayload(readCompanyVaultPayload(), companySlug, provider);
}

export function upsertStoredCrmConnectionInPayload<TPayload extends ConnectionVaultPayload>(
  input: {
    payload: TPayload;
    writePayload: WriteConnectionPayload<TPayload>;
    connection: CrmConnectionRecord;
  }
) {
  const nextConnections = upsertCrmConnectionMetadata(
    input.payload.crmConnections,
    input.connection
  );

  upsertStoredCompanyCrmConnectionSecret({
    companySlug: input.connection.companySlug,
    provider: input.connection.provider,
    accessToken: input.connection.accessToken,
    updatedAt: input.connection.updatedAt
  });

  input.writePayload({
    ...input.payload,
    crmConnections: nextConnections
  });
}

export function upsertPersistedCompanyCrmConnection(connection: CrmConnectionRecord) {
  upsertStoredCrmConnectionInPayload({
    payload: readCompanyVaultPayload(),
    writePayload: writeCompanyVaultPayload,
    connection
  });
}

export function getStoredSiteCmsConnectionsFromPayload(
  payload: ConnectionVaultPayload,
  companySlug?: string
) {
  const connections = listHydratedSiteCmsConnections(payload.siteCmsConnections);
  return companySlug
    ? connections.filter((connection) => connection.companySlug === companySlug)
    : connections;
}

export function getPersistedCompanySiteCmsConnections(companySlug?: string) {
  return getStoredSiteCmsConnectionsFromPayload(readCompanyVaultPayload(), companySlug);
}

export function getStoredSiteCmsConnectionFromPayload(
  payload: ConnectionVaultPayload,
  companySlug: string,
  provider: "wordpress"
) {
  return findHydratedSiteCmsConnection(payload.siteCmsConnections, companySlug, provider);
}

export function getPersistedCompanySiteCmsConnection(
  companySlug: string,
  provider: "wordpress"
) {
  return getStoredSiteCmsConnectionFromPayload(readCompanyVaultPayload(), companySlug, provider);
}

export function upsertStoredSiteCmsConnectionInPayload<TPayload extends ConnectionVaultPayload>(
  input: {
    payload: TPayload;
    writePayload: WriteConnectionPayload<TPayload>;
    connection: SiteCmsConnectionRecord;
  }
) {
  const nextConnections = upsertSiteCmsConnectionMetadata(
    input.payload.siteCmsConnections,
    input.connection
  );

  upsertStoredCompanySiteCmsSecret({
    companySlug: input.connection.companySlug,
    provider: input.connection.provider,
    appPassword: input.connection.appPassword,
    updatedAt: input.connection.updatedAt
  });

  input.writePayload({
    ...input.payload,
    siteCmsConnections: nextConnections
  });
}

export function upsertPersistedCompanySiteCmsConnection(connection: SiteCmsConnectionRecord) {
  upsertStoredSiteCmsConnectionInPayload({
    payload: readCompanyVaultPayload(),
    writePayload: writeCompanyVaultPayload,
    connection
  });
}

export function getStoredTrackingCredentialFromPayload(
  payload: ConnectionVaultPayload,
  companySlug: string
) {
  return findHydratedTrackingCredential(payload.trackingCredentials, companySlug);
}

export function getPersistedCompanyTrackingCredential(companySlug: string) {
  return getStoredTrackingCredentialFromPayload(readCompanyVaultPayload(), companySlug);
}

export function upsertStoredTrackingCredentialInPayload<
  TPayload extends ConnectionVaultPayload
>(input: {
  payload: TPayload;
  writePayload: WriteConnectionPayload<TPayload>;
  credential: TrackingCredentialRecord;
}) {
  const nextCredentials = upsertTrackingCredentialMetadata(
    input.payload.trackingCredentials,
    input.credential
  );

  upsertStoredCompanyTrackingSecret({
    companySlug: input.credential.companySlug,
    ga4ApiSecret: input.credential.ga4ApiSecret,
    metaAccessToken: input.credential.metaAccessToken,
    updatedAt: input.credential.updatedAt
  });

  input.writePayload({
    ...input.payload,
    trackingCredentials: nextCredentials
  });
}

export function upsertPersistedCompanyTrackingCredential(
  credential: TrackingCredentialRecord
) {
  upsertStoredTrackingCredentialInPayload({
    payload: readCompanyVaultPayload(),
    writePayload: writeCompanyVaultPayload,
    credential
  });
}

export function listHydratedGoogleConnections(metadataEntries: GoogleConnectionMetadata[]) {
  return metadataEntries.flatMap((metadata) => {
    const connection = hydrateGoogleConnection(metadata);
    return connection
      ? [
          {
            companySlug: connection.companySlug,
            platform: connection.platform,
            accountEmail: connection.accountEmail,
            accountName: connection.accountName,
            googleSub: connection.googleSub,
            scopes: connection.scopes,
            accessToken: connection.accessToken,
            refreshToken: connection.refreshToken,
            expiresAt: connection.expiresAt,
            createdAt: connection.createdAt,
            updatedAt: connection.updatedAt
          } satisfies GoogleConnectionRecord
        ]
      : [];
  });
}

export function findHydratedGoogleConnection(
  metadataEntries: GoogleConnectionMetadata[],
  companySlug: string,
  platform: PlatformId
) {
  return listHydratedGoogleConnections(metadataEntries).find(
    (connection) => connection.companySlug === companySlug && connection.platform === platform
  );
}

export function upsertGoogleConnectionMetadata(
  entries: GoogleConnectionMetadata[],
  connection: GoogleConnectionRecord
) {
  const existing = entries.find(
    (entry) =>
      entry.companySlug === connection.companySlug && entry.platform === connection.platform
  );
  const nextEntries = entries.filter(
    (entry) =>
      !(entry.companySlug === connection.companySlug && entry.platform === connection.platform)
  );

  nextEntries.push({
    companySlug: connection.companySlug,
    platform: connection.platform,
    accountEmail: connection.accountEmail,
    accountName: connection.accountName,
    googleSub: connection.googleSub,
    scopes: connection.scopes,
    expiresAt: connection.expiresAt,
    hasRefreshToken: Boolean(connection.refreshToken),
    createdAt: existing?.createdAt ?? connection.createdAt,
    updatedAt: connection.updatedAt
  });

  return nextEntries;
}

export function listHydratedSocialConnections(metadataEntries: SocialConnectionMetadata[]) {
  return metadataEntries.flatMap((metadata) => {
    const connection = hydrateSocialConnection(metadata);
    return connection
      ? [
          {
            companySlug: connection.companySlug,
            platform: connection.platform,
            provider: connection.provider,
            accountLabel: connection.accountLabel,
            externalUserId: connection.externalUserId,
            scopes: connection.scopes,
            accessToken: connection.accessToken,
            refreshToken: connection.refreshToken,
            expiresAt: connection.expiresAt,
            createdAt: connection.createdAt,
            updatedAt: connection.updatedAt
          } satisfies SocialConnectionRecord
        ]
      : [];
  });
}

export function findHydratedSocialConnection(
  metadataEntries: SocialConnectionMetadata[],
  companySlug: string,
  platform: SocialPlatformId
) {
  return listHydratedSocialConnections(metadataEntries).find(
    (connection) => connection.companySlug === companySlug && connection.platform === platform
  );
}

export function upsertSocialConnectionMetadata(
  entries: SocialConnectionMetadata[],
  connection: SocialConnectionRecord
) {
  const nextEntries = entries.filter(
    (entry) =>
      !(entry.companySlug === connection.companySlug && entry.platform === connection.platform)
  );

  nextEntries.push({
    companySlug: connection.companySlug,
    platform: connection.platform,
    provider: connection.provider,
    accountLabel: connection.accountLabel,
    externalUserId: connection.externalUserId,
    scopes: connection.scopes,
    expiresAt: connection.expiresAt,
    hasRefreshToken: Boolean(connection.refreshToken),
    createdAt: connection.createdAt,
    updatedAt: connection.updatedAt
  });

  return nextEntries;
}

export function listHydratedCrmConnections(metadataEntries: CrmConnectionMetadata[]) {
  return metadataEntries
    .map(hydrateCrmConnection)
    .filter((connection): connection is CrmConnectionRecord => Boolean(connection));
}

export function findHydratedCrmConnection(
  metadataEntries: CrmConnectionMetadata[],
  companySlug: string,
  provider: "hubspot"
) {
  return listHydratedCrmConnections(metadataEntries).find(
    (connection) => connection.companySlug === companySlug && connection.provider === provider
  );
}

export function upsertCrmConnectionMetadata(
  entries: CrmConnectionMetadata[],
  connection: CrmConnectionRecord
) {
  const existing = entries.find(
    (entry) =>
      entry.companySlug === connection.companySlug && entry.provider === connection.provider
  );
  const nextEntries = entries.filter(
    (entry) =>
      !(entry.companySlug === connection.companySlug && entry.provider === connection.provider)
  );

  nextEntries.push({
    companySlug: connection.companySlug,
    provider: connection.provider,
    accountLabel: connection.accountLabel,
    portalId: connection.portalId,
    scopes: connection.scopes,
    createdAt: existing?.createdAt ?? connection.createdAt,
    updatedAt: connection.updatedAt
  });

  return nextEntries;
}

export function listHydratedSiteCmsConnections(metadataEntries: SiteCmsConnectionMetadata[]) {
  return metadataEntries
    .map(hydrateSiteCmsConnection)
    .filter((connection): connection is SiteCmsConnectionRecord => Boolean(connection));
}

export function findHydratedSiteCmsConnection(
  metadataEntries: SiteCmsConnectionMetadata[],
  companySlug: string,
  provider: "wordpress"
) {
  return listHydratedSiteCmsConnections(metadataEntries).find(
    (connection) => connection.companySlug === companySlug && connection.provider === provider
  );
}

export function upsertSiteCmsConnectionMetadata(
  entries: SiteCmsConnectionMetadata[],
  connection: SiteCmsConnectionRecord
) {
  const existing = entries.find(
    (entry) =>
      entry.companySlug === connection.companySlug && entry.provider === connection.provider
  );
  const nextEntries = entries.filter(
    (entry) =>
      !(entry.companySlug === connection.companySlug && entry.provider === connection.provider)
  );

  nextEntries.push({
    companySlug: connection.companySlug,
    provider: connection.provider,
    siteUrl: connection.siteUrl,
    username: connection.username,
    createdAt: existing?.createdAt ?? connection.createdAt,
    updatedAt: connection.updatedAt
  });

  return nextEntries;
}

export function findHydratedTrackingCredential(
  metadataEntries: TrackingCredentialMetadata[],
  companySlug: string
) {
  const metadata = metadataEntries.find((entry) => entry.companySlug === companySlug);
  return metadata ? hydrateTrackingCredential(metadata) : undefined;
}

export function upsertTrackingCredentialMetadata(
  entries: TrackingCredentialMetadata[],
  credential: TrackingCredentialRecord
) {
  const existing = entries.find((entry) => entry.companySlug === credential.companySlug);
  const nextEntries = entries.filter((entry) => entry.companySlug !== credential.companySlug);

  nextEntries.push({
    companySlug: credential.companySlug,
    hasGa4ApiSecret: Boolean(credential.ga4ApiSecret),
    hasMetaAccessToken: Boolean(credential.metaAccessToken),
    createdAt: existing?.createdAt ?? credential.createdAt,
    updatedAt: credential.updatedAt
  });

  return nextEntries;
}
