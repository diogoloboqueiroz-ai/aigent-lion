import assert from "node:assert/strict";
import test from "node:test";
import {
  listStoredSocialRuntimeTasks,
  upsertStoredScheduledSocialPostInCollection,
  upsertStoredSocialRuntimeTaskInCollection
} from "@/infrastructure/persistence/company-social-storage";
import type { ScheduledSocialPost, SocialRuntimeTask } from "@/lib/domain";

test("social storage deduplicates scheduled posts by approval request", () => {
  const existing = buildPost("post-1", "tenant-a", {
    sourceApprovalRequestId: "approval-1",
    status: "pending_approval"
  });
  const next = buildPost("post-2", "tenant-a", {
    sourceApprovalRequestId: "approval-1",
    status: "scheduled"
  });

  const posts = upsertStoredScheduledSocialPostInCollection([existing], next);

  assert.equal(posts.length, 1);
  assert.equal(posts[0].id, "post-2");
});

test("social storage deduplicates unfinished runtime tasks by source item", () => {
  const existing = buildTask("task-1", "tenant-a", "queued");
  const replacement = buildTask("task-2", "tenant-a", "running");
  const completed = buildTask("task-3", "tenant-a", "completed");

  const tasks = upsertStoredSocialRuntimeTaskInCollection(
    [existing, completed],
    replacement
  );

  assert.deepEqual(
    listStoredSocialRuntimeTasks(tasks, "tenant-a").map((task) => task.id),
    ["task-2", "task-3"]
  );
});

function buildPost(
  id: string,
  companySlug: string,
  overrides: Partial<ScheduledSocialPost> = {}
): ScheduledSocialPost {
  return {
    id,
    companySlug,
    platform: "instagram",
    title: "Post",
    format: "image",
    scheduledFor: "2026-05-03T12:00:00.000Z",
    createdWith: "canva",
    summary: "Post",
    caption: "Caption",
    status: "draft",
    requestedBy: "test",
    requiresApproval: true,
    ...overrides
  };
}

function buildTask(
  id: string,
  companySlug: string,
  status: SocialRuntimeTask["status"]
): SocialRuntimeTask {
  return {
    id,
    companySlug,
    kind: "sync_analytics",
    platform: "instagram",
    sourceItemId: "post-1",
    status,
    title: "Sync",
    reason: "Sync",
    requestedBy: "test",
    createdAt: "2026-05-03T10:00:00.000Z",
    attemptCount: 0
  };
}
