import type {
  CompanyAgentProfile,
  CompanyCodeWorkspace,
  CompanyDataOpsProfile,
  CompanyPaymentProfile,
  CompanySchedulerJob,
  CompanySchedulerProfile,
  DesktopAgentProfile,
  InternetIntelligenceProfile,
  UserProfessionalProfile
} from "@/lib/domain";

export function listStoredUserProfessionalProfiles(
  profiles: UserProfessionalProfile[]
) {
  return profiles;
}

export function getStoredUserProfessionalProfileFromCollection(
  profiles: UserProfessionalProfile[],
  userKey: string
) {
  return profiles.find((profile) => profile.userKey === userKey);
}

export function upsertStoredUserProfessionalProfileInCollection(
  profiles: UserProfessionalProfile[],
  profile: UserProfessionalProfile
) {
  return [...profiles.filter((entry) => entry.userKey !== profile.userKey), profile];
}

export function listStoredCompanyProfiles(profiles: CompanyAgentProfile[]) {
  return profiles;
}

export function getStoredCompanyProfileFromCollection(
  profiles: CompanyAgentProfile[],
  companySlug: string
) {
  return profiles.find((profile) => profile.companySlug === companySlug);
}

export function upsertStoredCompanyProfileInCollection(
  profiles: CompanyAgentProfile[],
  profile: CompanyAgentProfile
) {
  return upsertByCompanySlug(profiles, profile);
}

export function listStoredCompanyCodeWorkspaces(
  workspaces: CompanyCodeWorkspace[],
  companySlug?: string
) {
  return filterByCompany(workspaces, companySlug);
}

export function upsertStoredCompanyCodeWorkspaceInCollection(
  workspaces: CompanyCodeWorkspace[],
  workspace: CompanyCodeWorkspace
) {
  return upsertById(workspaces, workspace);
}

export function listStoredCompanyDataOpsProfiles(
  profiles: CompanyDataOpsProfile[]
) {
  return profiles;
}

export function getStoredCompanyDataOpsProfileFromCollection(
  profiles: CompanyDataOpsProfile[],
  companySlug: string
) {
  return profiles.find((profile) => profile.companySlug === companySlug);
}

export function upsertStoredCompanyDataOpsProfileInCollection(
  profiles: CompanyDataOpsProfile[],
  profile: CompanyDataOpsProfile
) {
  return upsertByCompanySlug(profiles, profile);
}

export function listStoredCompanySchedulerProfiles(
  profiles: CompanySchedulerProfile[]
) {
  return profiles;
}

export function getStoredCompanySchedulerProfileFromCollection(
  profiles: CompanySchedulerProfile[],
  companySlug: string
) {
  return profiles.find((profile) => profile.companySlug === companySlug);
}

export function upsertStoredCompanySchedulerProfileInCollection(
  profiles: CompanySchedulerProfile[],
  profile: CompanySchedulerProfile
) {
  return upsertByCompanySlug(profiles, profile);
}

export function listStoredCompanySchedulerJobs(
  jobs: CompanySchedulerJob[],
  companySlug?: string
) {
  return filterByCompany(jobs, companySlug);
}

export function upsertStoredCompanySchedulerJobInCollection(
  jobs: CompanySchedulerJob[],
  job: CompanySchedulerJob
) {
  return upsertById(jobs, job);
}

export function getStoredCompanyPaymentProfileFromCollection(
  profiles: CompanyPaymentProfile[],
  companySlug: string
) {
  return profiles.find((profile) => profile.companySlug === companySlug);
}

export function upsertStoredCompanyPaymentProfileInCollection(
  profiles: CompanyPaymentProfile[],
  profile: CompanyPaymentProfile
) {
  return upsertByCompanySlug(profiles, profile);
}

export function getStoredDesktopAgentProfileFromCollection(
  profile: DesktopAgentProfile | null
) {
  return profile;
}

export function upsertStoredDesktopAgentProfileInCollection(
  profile: DesktopAgentProfile
) {
  return profile;
}

export function getStoredInternetIntelligenceProfileFromCollection(
  profile: InternetIntelligenceProfile | null
) {
  return profile;
}

export function upsertStoredInternetIntelligenceProfileInCollection(
  profile: InternetIntelligenceProfile
) {
  return profile;
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
