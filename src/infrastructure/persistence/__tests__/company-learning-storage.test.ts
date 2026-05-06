import assert from "node:assert/strict";
import test from "node:test";
import {
  listStoredCompanyAgentLearnings,
  replaceStoredCompanyAgentLearningsInCollection
} from "@/infrastructure/persistence/company-learning-storage";
import type { CompanyAgentLearning } from "@/lib/domain";

test("company learning storage scopes and replaces tenant learnings", () => {
  const existing = [
    buildLearning("a-1", "tenant-a"),
    buildLearning("b-1", "tenant-b")
  ];
  const next = replaceStoredCompanyAgentLearningsInCollection({
    existing,
    companySlug: "tenant-a",
    learnings: [buildLearning("a-2", "tenant-a")]
  });

  assert.deepEqual(
    listStoredCompanyAgentLearnings(next, "tenant-a").map((learning) => learning.id),
    ["a-2"]
  );
  assert.deepEqual(
    listStoredCompanyAgentLearnings(next, "tenant-b").map((learning) => learning.id),
    ["b-1"]
  );
});

function buildLearning(id: string, companySlug: string): CompanyAgentLearning {
  return {
    id,
    companySlug,
    learningBoundary: "tenant_private",
    shareability: "restricted",
    kind: "opportunity",
    status: "fresh",
    priority: "medium",
    confidence: 0.72,
    title: id,
    summary: "summary",
    recommendedAction: "act",
    evidence: ["evidence"],
    sourceType: "playbook",
    sourcePath: `/empresas/${companySlug}`,
    sourceLabel: "source",
    generatedAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z"
  };
}
