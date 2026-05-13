import type {
  CompanySocialOpsProfile,
  ScheduledSocialPost,
  SocialAdDraft,
  SocialExecutionLog,
  SocialInsightSnapshot,
  SocialPlatformBinding,
  SocialPlatformId,
  SocialRuntimeTask
} from "@/lib/domain";
import {
  readCompanyVaultPayload,
  writeCompanyVaultPayload
} from "@/infrastructure/persistence/company-vault-payload-store";

export function listStoredCompanySocialProfiles(profiles: CompanySocialOpsProfile[]) {
  return profiles;
}

export function getStoredCompanySocialProfileFromCollection(
  profiles: CompanySocialOpsProfile[],
  companySlug: string
) {
  return profiles.find((profile) => profile.companySlug === companySlug);
}

export function upsertStoredCompanySocialProfileInCollection(
  profiles: CompanySocialOpsProfile[],
  profile: CompanySocialOpsProfile
) {
  return upsertByCompanySlug(profiles, profile);
}

export function listStoredSocialPlatformBindings(
  bindings: SocialPlatformBinding[],
  companySlug?: string
) {
  return filterByCompany(bindings, companySlug);
}

export function getStoredSocialPlatformBindingFromCollection(
  bindings: SocialPlatformBinding[],
  companySlug: string,
  platform: SocialPlatformId
) {
  return listStoredSocialPlatformBindings(bindings, companySlug).find(
    (binding) => binding.platform === platform
  );
}

export function upsertStoredSocialPlatformBindingInCollection(
  bindings: SocialPlatformBinding[],
  binding: SocialPlatformBinding
) {
  return upsertByComposite(
    bindings,
    binding,
    (entry) => entry.companySlug === binding.companySlug && entry.platform === binding.platform
  );
}

export function listStoredScheduledSocialPosts(
  posts: ScheduledSocialPost[],
  companySlug?: string
) {
  return filterByCompany(posts, companySlug);
}

export function upsertStoredScheduledSocialPostInCollection(
  posts: ScheduledSocialPost[],
  post: ScheduledSocialPost
) {
  const nextPosts = posts.filter(
    (entry) =>
      entry.id !== post.id &&
      !(
        post.sourceApprovalRequestId &&
        entry.companySlug === post.companySlug &&
        entry.sourceApprovalRequestId === post.sourceApprovalRequestId
      ) &&
      !(
        post.sourceAssetVersionId &&
        entry.companySlug === post.companySlug &&
        entry.platform === post.platform &&
        entry.sourceAssetVersionId === post.sourceAssetVersionId &&
        entry.status !== "rejected"
      )
  );

  nextPosts.push(post);
  return nextPosts;
}

export function listStoredSocialAdDrafts(
  drafts: SocialAdDraft[],
  companySlug?: string
) {
  return filterByCompany(drafts, companySlug);
}

export function upsertStoredSocialAdDraftInCollection(
  drafts: SocialAdDraft[],
  draft: SocialAdDraft
) {
  const nextDrafts = drafts.filter(
    (entry) =>
      entry.id !== draft.id &&
      !(
        draft.sourceAssetVersionId &&
        entry.companySlug === draft.companySlug &&
        entry.platform === draft.platform &&
        entry.sourceAssetVersionId === draft.sourceAssetVersionId &&
        entry.status !== "rejected"
      )
  );

  nextDrafts.push(draft);
  return nextDrafts;
}

export function listStoredSocialInsights(
  insights: SocialInsightSnapshot[],
  companySlug?: string
) {
  return filterByCompany(insights, companySlug);
}

export function upsertStoredSocialInsightInCollection(
  insights: SocialInsightSnapshot[],
  snapshot: SocialInsightSnapshot
) {
  return upsertByComposite(
    insights,
    snapshot,
    (entry) =>
      entry.companySlug === snapshot.companySlug &&
      entry.platform === snapshot.platform &&
      entry.window === snapshot.window
  );
}

export function listStoredSocialExecutionLogs(
  logs: SocialExecutionLog[],
  companySlug?: string
) {
  return filterByCompany(logs, companySlug);
}

export function appendStoredSocialExecutionLogToCollection(
  logs: SocialExecutionLog[],
  log: SocialExecutionLog
) {
  return [log, ...logs].slice(0, 500);
}

export function listStoredSocialRuntimeTasks(
  tasks: SocialRuntimeTask[],
  companySlug?: string
) {
  return filterByCompany(tasks, companySlug);
}

export function getPersistedSocialRuntimeTasks(companySlug?: string) {
  return listStoredSocialRuntimeTasks(readCompanyVaultPayload().socialRuntimeTasks, companySlug);
}

export function upsertStoredSocialRuntimeTaskInCollection(
  tasks: SocialRuntimeTask[],
  task: SocialRuntimeTask
) {
  const nextTasks = tasks.filter(
    (entry) =>
      entry.id !== task.id &&
      !(
        entry.companySlug === task.companySlug &&
        entry.kind === task.kind &&
        entry.platform === task.platform &&
        entry.sourceItemId === task.sourceItemId &&
        entry.status !== "completed"
      )
  );

  nextTasks.unshift(task);
  return nextTasks.slice(0, 400);
}

export function upsertPersistedSocialRuntimeTask(task: SocialRuntimeTask) {
  const payload = readCompanyVaultPayload();
  writeCompanyVaultPayload({
    ...payload,
    socialRuntimeTasks: upsertStoredSocialRuntimeTaskInCollection(
      payload.socialRuntimeTasks,
      task
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

function upsertByComposite<T>(items: T[], item: T, isSame: (entry: T) => boolean) {
  return [...items.filter((entry) => !isSame(entry)), item];
}
