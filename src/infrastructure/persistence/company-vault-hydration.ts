import {
  getStoredCompanyCrmConnectionSecret,
  getStoredCompanySiteCmsSecret,
  getStoredCompanyTrackingSecret,
  getStoredGoogleCompanyConnectionSecret,
  getStoredSocialCompanyConnectionSecret
} from "@/infrastructure/secrets/tenant-secrets-store";
import type { PlatformId, SocialPlatformId } from "@/lib/domain";

export function hydrateGoogleConnection<
  T extends {
    companySlug: string;
    platform: PlatformId;
    accountEmail: string;
    accountName: string;
    googleSub: string;
    scopes: string[];
    expiresAt?: string;
    createdAt: string;
    updatedAt: string;
  }
>(metadata: T) {
  const secret = getStoredGoogleCompanyConnectionSecret(metadata.companySlug, metadata.platform);
  if (!secret?.accessToken) {
    return null;
  }

  return {
    ...metadata,
    accessToken: secret.accessToken,
    refreshToken: secret.refreshToken
  };
}

export function hydrateSocialConnection<
  T extends {
    companySlug: string;
    platform: SocialPlatformId;
    provider: string;
    accountLabel: string;
    externalUserId?: string;
    scopes: string[];
    expiresAt?: string;
    createdAt: string;
    updatedAt: string;
  }
>(metadata: T) {
  const secret = getStoredSocialCompanyConnectionSecret(metadata.companySlug, metadata.platform);
  if (!secret?.accessToken) {
    return null;
  }

  return {
    ...metadata,
    accessToken: secret.accessToken,
    refreshToken: secret.refreshToken
  };
}

export function hydrateCrmConnection<
  T extends {
    companySlug: string;
    provider: "hubspot";
  }
>(metadata: T) {
  const secret = getStoredCompanyCrmConnectionSecret(metadata.companySlug, metadata.provider);
  if (!secret?.accessToken) {
    return null;
  }

  return {
    ...metadata,
    accessToken: secret.accessToken
  };
}

export function hydrateSiteCmsConnection<
  T extends {
    companySlug: string;
    provider: "wordpress";
  }
>(metadata: T) {
  const secret = getStoredCompanySiteCmsSecret(metadata.companySlug, metadata.provider);
  if (!secret?.appPassword) {
    return null;
  }

  return {
    ...metadata,
    appPassword: secret.appPassword
  };
}

export function hydrateTrackingCredential<
  T extends {
    companySlug: string;
    createdAt: string;
    updatedAt: string;
  }
>(metadata: T) {
  const secret = getStoredCompanyTrackingSecret(metadata.companySlug);
  if (!secret) {
    return null;
  }

  return {
    ...metadata,
    ga4ApiSecret: secret.ga4ApiSecret,
    metaAccessToken: secret.metaAccessToken
  };
}
