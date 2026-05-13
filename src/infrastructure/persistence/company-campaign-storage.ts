import type { CampaignIntelligenceBriefRecord } from "@/core/marketing/campaign-intelligence";
import {
  readCompanyVaultPayload,
  writeCompanyVaultPayload
} from "@/infrastructure/persistence/company-vault-payload-store";

export function listStoredCampaignIntelligenceBriefs(
  briefs: CampaignIntelligenceBriefRecord[],
  companySlug?: string
) {
  const scopedBriefs = companySlug
    ? briefs.filter((brief) => brief.companySlug === companySlug)
    : briefs;

  return scopedBriefs.sort((left, right) => right.savedAt.localeCompare(left.savedAt));
}

export function getPersistedCampaignIntelligenceBriefs(companySlug?: string) {
  return listStoredCampaignIntelligenceBriefs(
    readCompanyVaultPayload().campaignIntelligenceBriefs,
    companySlug
  );
}

export function getLatestStoredCampaignIntelligenceBrief(
  briefs: CampaignIntelligenceBriefRecord[],
  companySlug: string
) {
  return listStoredCampaignIntelligenceBriefs(briefs, companySlug)[0];
}

export function getLatestPersistedCampaignIntelligenceBrief(companySlug: string) {
  return getLatestStoredCampaignIntelligenceBrief(
    readCompanyVaultPayload().campaignIntelligenceBriefs,
    companySlug
  );
}

export function upsertStoredCampaignIntelligenceBriefInCollection(
  briefs: CampaignIntelligenceBriefRecord[],
  brief: CampaignIntelligenceBriefRecord
) {
  return [
    brief,
    ...briefs.filter((entry) => !(entry.companySlug === brief.companySlug && entry.id === brief.id))
  ]
    .sort((left, right) => right.savedAt.localeCompare(left.savedAt))
    .slice(0, 160);
}

export function upsertPersistedCampaignIntelligenceBrief(
  brief: CampaignIntelligenceBriefRecord
) {
  const payload = readCompanyVaultPayload();
  writeCompanyVaultPayload({
    ...payload,
    campaignIntelligenceBriefs: upsertStoredCampaignIntelligenceBriefInCollection(
      payload.campaignIntelligenceBriefs,
      brief
    )
  });
}
