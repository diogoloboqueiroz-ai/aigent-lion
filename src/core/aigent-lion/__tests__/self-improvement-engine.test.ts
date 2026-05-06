import assert from "node:assert/strict";
import test from "node:test";
import { generateCodexImplementationTask } from "@/core/aigent-lion/codex-task-generator";
import { analyzeAigentReleaseRisk } from "@/core/aigent-lion/release-risk-analyzer";
import { runSelfImprovementEngine } from "@/core/aigent-lion/self-improvement-engine";
import type { AigentLionIntelligenceContext } from "@/core/aigent-lion/types";

test("codex task generator creates an actionable implementation prompt", () => {
  const task = generateCodexImplementationTask({
    companySlug: "acme",
    area: "runtime",
    title: "Endurecer worker separado",
    objective: "Garantir worker com retry, dead-letter e status claro.",
    priority: "p1",
    rationale: "O agente precisa executar fora do request lifecycle.",
    evidence: ["Worker stale", "Dead letters > 0"],
    filesToInspect: ["src/lib/agents/worker.ts"],
    suggestedFilesToChange: ["src/lib/agents/worker.ts"],
    acceptanceCriteria: ["Teste cobre dead-letter", "Build passa"],
    expectedImpact: "Mais confianca operacional.",
    riskLevel: "high",
    tags: ["runtime", "external_execution"]
  });

  assert.equal(task.requiresApproval, true);
  assert.match(task.prompt, /Arquivos para inspecionar primeiro/);
  assert.match(task.prompt, /Teste cobre dead-letter/);
});

test("release risk analyzer requires approval for high-risk Codex tasks", () => {
  const task = generateCodexImplementationTask({
    companySlug: "acme",
    area: "policy",
    title: "Alterar policy enterprise",
    objective: "Refinar approvals por risco.",
    priority: "p1",
    rationale: "Policy governa autonomia.",
    evidence: ["High risk policy review"],
    filesToInspect: ["src/core/policy/policy-engine.ts"],
    suggestedFilesToChange: ["src/core/policy/policy-engine.ts"],
    acceptanceCriteria: ["High risk nao autoexecuta"],
    expectedImpact: "Autonomia segura.",
    riskLevel: "high",
    tags: ["policy", "compliance"]
  });
  const risk = analyzeAigentReleaseRisk({
    companySlug: "acme",
    tasks: [task],
    generatedAt: "2026-05-04T00:00:00.000Z"
  });

  assert.equal(risk.requiresApproval, true);
  assert.ok(risk.level === "high" || risk.level === "critical");
  assert.ok(risk.requiredApprovers.includes("governance-reviewer"));
});

test("self-improvement engine turns weak operating signals into real Codex tasks", () => {
  const context = {
    trigger: {
      id: "trigger-1"
    },
    workspace: {
      company: {
        slug: "acme",
        name: "Acme"
      },
      automationRuns: [{ id: "run-1" }],
      agentLearnings: [],
      learningPlaybooks: [],
      experimentOutcomes: []
    },
    diagnosticFindings: [
      {
        id: "finding-1",
        severity: "high",
        summary: "Runtime bloqueado",
        suspectedRootCause: "Worker externo ausente",
        evidence: ["Fila parada"]
      }
    ],
    policyDecisions: [
      {
        action: {
          title: "Propor budget shift"
        },
        policy: {
          status: "REQUIRE_POLICY_REVIEW",
          rationale: "Spend mutation requires policy review."
        }
      }
    ],
    campaignOS: {
      launchReadiness: {
        score: 61,
        blockers: ["Meta Ads sem conector pronto."],
        warnings: ["Creative QA precisa revisar claims."]
      },
      creativeQaScore: 64,
      risks: ["Claim sensivel detectado."]
    },
    controlTower: {
      totals: {
        deadLetters: 2,
        queuedItems: 3
      },
      health: {
        trustScore: 58
      },
      workerHealth: {
        status: "critical"
      },
      observabilityChannel: {
        health: "warning",
        targetHost: undefined
      }
    },
    strategicMemory: {
      confidence: 0.42
    }
  } as unknown as AigentLionIntelligenceContext;

  const report = runSelfImprovementEngine(context, "2026-05-04T00:00:00.000Z");

  assert.ok(report.codexTasks.length > 0);
  assert.equal(report.releaseRisk.requiresApproval, true);
  assert.ok(report.recommendations.some((recommendation) => recommendation.task.prompt.includes("Criterios de aceite")));
});
