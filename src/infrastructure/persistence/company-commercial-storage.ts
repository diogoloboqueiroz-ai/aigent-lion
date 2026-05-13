import type {
  CompanyConversionEvent,
  CompanyCrmProfile,
  CompanyLead,
  CompanySiteOpsProfile
} from "@/lib/domain";
import {
  readCompanyVaultPayload,
  writeCompanyVaultPayload
} from "@/infrastructure/persistence/company-vault-payload-store";

export function getStoredCompanyCrmProfileFromCollection(
  profiles: CompanyCrmProfile[],
  companySlug: string
) {
  return profiles.find((profile) => profile.companySlug === companySlug);
}

export function getPersistedCompanyCrmProfile(companySlug: string) {
  return getStoredCompanyCrmProfileFromCollection(
    readCompanyVaultPayload().companyCrmProfiles,
    companySlug
  );
}

export function upsertStoredCompanyCrmProfileInCollection(
  profiles: CompanyCrmProfile[],
  profile: CompanyCrmProfile
) {
  return upsertByCompanySlug(profiles, profile);
}

export function upsertPersistedCompanyCrmProfile(profile: CompanyCrmProfile) {
  const payload = readCompanyVaultPayload();
  writeCompanyVaultPayload({
    ...payload,
    companyCrmProfiles: upsertStoredCompanyCrmProfileInCollection(
      payload.companyCrmProfiles,
      profile
    )
  });
}

export function getStoredCompanySiteOpsProfileFromCollection(
  profiles: CompanySiteOpsProfile[],
  companySlug: string
) {
  return profiles.find((profile) => profile.companySlug === companySlug);
}

export function getPersistedCompanySiteOpsProfile(companySlug: string) {
  return getStoredCompanySiteOpsProfileFromCollection(
    readCompanyVaultPayload().companySiteOpsProfiles,
    companySlug
  );
}

export function upsertStoredCompanySiteOpsProfileInCollection(
  profiles: CompanySiteOpsProfile[],
  profile: CompanySiteOpsProfile
) {
  return upsertByCompanySlug(profiles, profile);
}

export function upsertPersistedCompanySiteOpsProfile(profile: CompanySiteOpsProfile) {
  const payload = readCompanyVaultPayload();
  writeCompanyVaultPayload({
    ...payload,
    companySiteOpsProfiles: upsertStoredCompanySiteOpsProfileInCollection(
      payload.companySiteOpsProfiles,
      profile
    )
  });
}

export function listStoredCompanyLeads(
  leads: CompanyLead[],
  companySlug?: string
) {
  return filterByCompany(leads, companySlug);
}

export function getPersistedCompanyLeads(companySlug?: string) {
  return listStoredCompanyLeads(readCompanyVaultPayload().companyLeads, companySlug);
}

export function upsertStoredCompanyLeadInCollection(
  leads: CompanyLead[],
  lead: CompanyLead
) {
  return upsertById(leads, lead)
    .sort((left, right) => right.lastTouchedAt.localeCompare(left.lastTouchedAt))
    .slice(0, 500);
}

export function upsertPersistedCompanyLead(lead: CompanyLead) {
  const payload = readCompanyVaultPayload();
  writeCompanyVaultPayload({
    ...payload,
    companyLeads: upsertStoredCompanyLeadInCollection(payload.companyLeads, lead)
  });
}

export function listStoredCompanyConversionEvents(
  events: CompanyConversionEvent[],
  companySlug?: string
) {
  return filterByCompany(events, companySlug);
}

export function getPersistedCompanyConversionEvents(companySlug?: string) {
  return listStoredCompanyConversionEvents(
    readCompanyVaultPayload().companyConversionEvents,
    companySlug
  );
}

export function upsertStoredCompanyConversionEventInCollection(
  events: CompanyConversionEvent[],
  event: CompanyConversionEvent
) {
  return upsertById(events, event)
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, 800);
}

export function upsertPersistedCompanyConversionEvent(event: CompanyConversionEvent) {
  const payload = readCompanyVaultPayload();
  writeCompanyVaultPayload({
    ...payload,
    companyConversionEvents: upsertStoredCompanyConversionEventInCollection(
      payload.companyConversionEvents,
      event
    )
  });
}

function filterByCompany<T extends { companySlug: string }>(
  items: T[],
  companySlug?: string
) {
  return companySlug ? items.filter((item) => item.companySlug === companySlug) : items;
}

function upsertByCompanySlug<T extends { companySlug: string }>(items: T[], item: T) {
  return [...items.filter((entry) => entry.companySlug !== item.companySlug), item];
}

function upsertById<T extends { id: string }>(items: T[], item: T) {
  return [...items.filter((entry) => entry.id !== item.id), item];
}
