import assert from "node:assert/strict";
import test from "node:test";
import { buildCrossTenantLearningPlaybooks } from "@/core/learning/cross-tenant-learning";
import type { CompanyLearningPlaybook } from "@/lib/domain";

test("cross-tenant learning promotes only anonymizable recurring playbooks", () => {
  const playbooks: CompanyLearningPlaybook[] = [
    {
      id: "playbook-acme-meta",
      companySlug: "acme",
      learningBoundary: "tenant_private",
      shareability: "anonymizable",
      version: 2,
      confidenceState: "validated",
      validFrom: "2026-04-22T10:00:00.000Z",
      validUntil: "2026-05-20T10:00:00.000Z",
      validityScope: {
        channel: "meta",
        targetMetric: "CPA",
        observedWindow: "7d",
        tenantOnly: true
      },
      failureMemory: {
        count: 0
      },
      channel: "meta",
      title: "Playbook de Meta",
      summary: "Padrao vencedor em https://acme.com/lp com prova social forte.",
      status: "active",
      confidence: 0.84,
      winCount: 3,
      lossCount: 0,
      recommendedAction: "Repetir angulo vencedor e revisar /empresas/acme/operacao antes de escalar.",
      reuseGuidance: ["Repetir angulo vencedor."],
      evidence: ["CPA caiu"],
      createdAt: "2026-04-22T10:00:00.000Z",
      updatedAt: "2026-04-22T11:00:00.000Z",
      lastValidatedAt: "2026-04-22T11:00:00.000Z"
    },
    {
      id: "playbook-bravo-meta",
      companySlug: "bravo",
      learningBoundary: "tenant_private",
      shareability: "anonymizable",
      version: 2,
      confidenceState: "validated",
      validFrom: "2026-04-22T12:00:00.000Z",
      validUntil: "2026-05-20T12:00:00.000Z",
      validityScope: {
        channel: "meta",
        targetMetric: "CPA",
        observedWindow: "7d",
        tenantOnly: true
      },
      failureMemory: {
        count: 0
      },
      channel: "meta",
      title: "Playbook de Meta",
      summary: "Padrao vencedor em https://bravo.com/lp com prova social forte.",
      status: "active",
      confidence: 0.82,
      winCount: 2,
      lossCount: 0,
      recommendedAction: "Repetir angulo vencedor e revisar /empresas/bravo/operacao antes de escalar.",
      reuseGuidance: ["Repetir angulo vencedor."],
      evidence: ["CTR subiu"],
      createdAt: "2026-04-22T12:00:00.000Z",
      updatedAt: "2026-04-22T13:00:00.000Z",
      lastValidatedAt: "2026-04-22T13:00:00.000Z"
    },
    {
      id: "playbook-secret",
      companySlug: "charlie",
      learningBoundary: "tenant_private",
      shareability: "restricted",
      version: 1,
      confidenceState: "validated",
      validFrom: "2026-04-22T10:00:00.000Z",
      validUntil: "2026-05-20T10:00:00.000Z",
      validityScope: {
        channel: "google-ads",
        targetMetric: "CPA",
        observedWindow: "7d",
        tenantOnly: true
      },
      failureMemory: {
        count: 0
      },
      channel: "google-ads",
      title: "Playbook privado",
      summary: "Nao compartilhar",
      status: "active",
      confidence: 0.92,
      winCount: 5,
      lossCount: 0,
      recommendedAction: "Privado",
      reuseGuidance: ["Privado"],
      evidence: [],
      createdAt: "2026-04-22T10:00:00.000Z",
      updatedAt: "2026-04-22T10:00:00.000Z"
    }
  ];

  const shared = buildCrossTenantLearningPlaybooks({ playbooks });

  assert.equal(shared.length, 1);
  assert.equal(shared[0]?.channel, "meta");
  assert.equal(shared[0]?.status, "active");
  assert.equal(shared[0]?.sourceTenantCount, 2);
  assert.equal(shared[0]?.shareability, "shared");
  assert.equal(shared[0]?.version, 1);
  assert.equal(shared[0]?.confidenceState, "validated");
  assert.ok(!shared[0]?.summary.includes("acme.com"));
  assert.ok(!shared[0]?.recommendedAction.includes("/empresas/acme"));
  assert.ok(shared[0]?.recommendedAction.includes("[tenant]"));
});
