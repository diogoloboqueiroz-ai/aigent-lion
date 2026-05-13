import type {
  CompanyAgentLearning,
  CompanyExperimentOutcome,
  CompanyLearningPlaybook,
  CrossTenantLearningPlaybook
} from "@/lib/domain";
import {
  readCompanyVaultPayload,
  writeCompanyVaultPayload
} from "@/infrastructure/persistence/company-vault-payload-store";

export function listStoredCompanyAgentLearnings(
  learnings: CompanyAgentLearning[],
  companySlug?: string
) {
  return companySlug ? learnings.filter((learning) => learning.companySlug === companySlug) : learnings;
}

export function getPersistedCompanyAgentLearnings(companySlug?: string) {
  return listStoredCompanyAgentLearnings(
    readCompanyVaultPayload().companyAgentLearnings,
    companySlug
  );
}

export function replaceStoredCompanyAgentLearningsInCollection(input: {
  existing: CompanyAgentLearning[];
  companySlug: string;
  learnings: CompanyAgentLearning[];
  limit?: number;
}) {
  return [
    ...input.learnings,
    ...input.existing.filter((entry) => entry.companySlug !== input.companySlug)
  ].slice(0, input.limit ?? 240);
}

export function replacePersistedCompanyAgentLearnings(
  companySlug: string,
  learnings: CompanyAgentLearning[]
) {
  const payload = readCompanyVaultPayload();
  writeCompanyVaultPayload({
    ...payload,
    companyAgentLearnings: replaceStoredCompanyAgentLearningsInCollection({
      existing: payload.companyAgentLearnings,
      companySlug,
      learnings
    })
  });
}

export function listStoredCompanyExperimentOutcomes(
  outcomes: CompanyExperimentOutcome[],
  companySlug?: string
) {
  return companySlug ? outcomes.filter((outcome) => outcome.companySlug === companySlug) : outcomes;
}

export function getPersistedCompanyExperimentOutcomes(companySlug?: string) {
  return listStoredCompanyExperimentOutcomes(
    readCompanyVaultPayload().companyExperimentOutcomes,
    companySlug
  );
}

export function replaceStoredCompanyExperimentOutcomesInCollection(input: {
  existing: CompanyExperimentOutcome[];
  companySlug: string;
  outcomes: CompanyExperimentOutcome[];
  limit?: number;
}) {
  return [
    ...input.outcomes,
    ...input.existing.filter((entry) => entry.companySlug !== input.companySlug)
  ].slice(0, input.limit ?? 240);
}

export function replacePersistedCompanyExperimentOutcomes(
  companySlug: string,
  outcomes: CompanyExperimentOutcome[]
) {
  const payload = readCompanyVaultPayload();
  writeCompanyVaultPayload({
    ...payload,
    companyExperimentOutcomes: replaceStoredCompanyExperimentOutcomesInCollection({
      existing: payload.companyExperimentOutcomes,
      companySlug,
      outcomes
    })
  });
}

export function listStoredCompanyLearningPlaybooks(
  playbooks: CompanyLearningPlaybook[],
  companySlug?: string
) {
  return companySlug ? playbooks.filter((playbook) => playbook.companySlug === companySlug) : playbooks;
}

export function getPersistedCompanyLearningPlaybooks(companySlug?: string) {
  return listStoredCompanyLearningPlaybooks(
    readCompanyVaultPayload().companyLearningPlaybooks,
    companySlug
  );
}

export function replaceStoredCompanyLearningPlaybooksInCollection(input: {
  existing: CompanyLearningPlaybook[];
  companySlug: string;
  playbooks: CompanyLearningPlaybook[];
  limit?: number;
}) {
  return [
    ...input.playbooks,
    ...input.existing.filter((entry) => entry.companySlug !== input.companySlug)
  ].slice(0, input.limit ?? 180);
}

export function replacePersistedCompanyLearningPlaybooks(
  companySlug: string,
  playbooks: CompanyLearningPlaybook[]
) {
  const payload = readCompanyVaultPayload();
  writeCompanyVaultPayload({
    ...payload,
    companyLearningPlaybooks: replaceStoredCompanyLearningPlaybooksInCollection({
      existing: payload.companyLearningPlaybooks,
      companySlug,
      playbooks
    })
  });
}

export function replaceStoredCrossTenantLearningPlaybooksInCollection(
  playbooks: CrossTenantLearningPlaybook[],
  limit = 240
) {
  return [...playbooks]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, limit);
}

export function getPersistedCrossTenantLearningPlaybooks() {
  return readCompanyVaultPayload().crossTenantLearningPlaybooks;
}

export function replacePersistedCrossTenantLearningPlaybooks(
  playbooks: CrossTenantLearningPlaybook[]
) {
  const payload = readCompanyVaultPayload();
  writeCompanyVaultPayload({
    ...payload,
    crossTenantLearningPlaybooks: replaceStoredCrossTenantLearningPlaybooksInCollection(playbooks)
  });
}
