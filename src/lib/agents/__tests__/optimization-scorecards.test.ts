import test from "node:test";
import assert from "node:assert/strict";
import { buildOptimizationScorecards } from "../../execution";
import type { CompanyWorkspace } from "@/lib/domain";

function createWorkspace(input: {
  platform: "google-ads" | "meta";
  spend: number;
  conversions: number;
  cpa?: number;
  ctr?: number;
  winnerSignals?: number;
  loserSignals?: number;
}) {
  const winnerLearnings = Array.from({ length: input.winnerSignals ?? 0 }, (_, index) => ({
    id: `winner-${index}`,
    companySlug: "acme",
    kind: "playbook" as const,
    status: "active" as const,
    priority: "high" as const,
    confidence: 0.9,
    title: `Canal vencedor: ${input.platform}`,
    summary: "Canal performando bem",
    recommendedAction: "Escalar",
    evidence: [],
    sourceType: "execution_plan" as const,
    sourcePath: "/empresas/acme/operacao",
    sourceLabel: "Operacao",
    generatedAt: "2026-04-22T10:00:00.000Z",
    updatedAt: "2026-04-22T10:00:00.000Z"
  }));
  const loserLearnings = Array.from({ length: input.loserSignals ?? 0 }, (_, index) => ({
    id: `loser-${index}`,
    companySlug: "acme",
    kind: "risk" as const,
    status: "active" as const,
    priority: "high" as const,
    confidence: 0.9,
    title: `Canal em risco: ${input.platform}`,
    summary: "Canal em risco",
    recommendedAction: "Segurar",
    evidence: [],
    sourceType: "execution_plan" as const,
    sourcePath: "/empresas/acme/operacao",
    sourceLabel: "Operacao",
    generatedAt: "2026-04-22T10:00:00.000Z",
    updatedAt: "2026-04-22T10:00:00.000Z"
  }));

  return {
    company: {
      slug: "acme",
      name: "Acme"
    },
    strategyPlan: {
      priorityChannels: [input.platform],
      cpaTarget: "R$ 50,00"
    },
    snapshots: [
      {
        platform: input.platform,
        window: "7d",
        spend: input.spend,
        conversions: input.conversions,
        cpa: input.cpa,
        ctr: input.ctr
      }
    ],
    conversionEvents: [],
    agentLearnings: [...winnerLearnings, ...loserLearnings]
  } as unknown as CompanyWorkspace;
}

test("winner memory can promote a learning channel to scale", () => {
  const scorecards = buildOptimizationScorecards(
    createWorkspace({
      platform: "google-ads",
      spend: 120,
      conversions: 3,
      cpa: 40,
      ctr: 0.03,
      winnerSignals: 2
    })
  );

  assert.equal(scorecards[0]?.decision, "scale");
});

test("loser memory can force a risky learning channel into pause", () => {
  const scorecards = buildOptimizationScorecards(
    createWorkspace({
      platform: "meta",
      spend: 150,
      conversions: 2,
      cpa: 70,
      ctr: 0.02,
      loserSignals: 2
    })
  );

  assert.equal(scorecards[0]?.decision, "pause");
});
