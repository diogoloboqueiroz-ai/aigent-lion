import assert from "node:assert/strict";
import test from "node:test";
import { buildCampaignRuntimeExperimentOutcomes } from "@/core/learning/campaign-runtime-outcomes";
import type { CompanyProfile, CompanyWorkspace, SocialExecutionLog } from "@/lib/domain";

const company: CompanyProfile = {
  id: "company-acme",
  slug: "acme",
  name: "Acme",
  sector: "SaaS",
  region: "BR",
  timezone: "America/Sao_Paulo",
  primaryGoal: "crescer receita"
};

test("campaign runtime outcomes promote completed campaign logs with performance signal", () => {
  const outcomes = buildCampaignRuntimeExperimentOutcomes({
    workspace: buildWorkspace([
      buildLog({
        id: "log-1",
        status: "completed",
        platform: "instagram",
        kind: "publish_post",
        summary: "Post publicado e ja com cliques.",
        sourceCampaignBriefId: "brief-1",
        sourceCampaignBriefVersion: 2,
        variantLabel: "Variante A",
        metrics: [{ label: "Cliques", value: "42" }]
      })
    ])
  });

  assert.equal(outcomes.length, 1);
  assert.equal(outcomes[0].status, "won");
  assert.equal(outcomes[0].channel, "meta");
  assert.equal(outcomes[0].targetMetric, "clicks");
  assert.equal(outcomes[0].observedValue, 42);
  assert.equal(outcomes[0].winningVariant, "Variante A");
  assert.equal(outcomes[0].sourceCampaignBriefId, "brief-1");
  assert.equal(outcomes[0].sourceCampaignBriefVersion, 2);
});

test("campaign runtime outcomes turn blocked sourced executions into losses", () => {
  const outcomes = buildCampaignRuntimeExperimentOutcomes({
    workspace: buildWorkspace([
      buildLog({
        id: "log-2",
        status: "blocked",
        platform: "google-ads",
        kind: "launch_ad",
        summary: "Lancamento bloqueado.",
        detail: "Conta Google Ads sem binding pago pronto.",
        sourceExperimentId: "experiment-google-cpa"
      })
    ])
  });

  assert.equal(outcomes.length, 1);
  assert.equal(outcomes[0].status, "lost");
  assert.equal(outcomes[0].channel, "google-ads");
  assert.equal(outcomes[0].experimentId, "experiment-google-cpa");
  assert.match(outcomes[0].failureNote ?? "", /binding pago pronto/);
});

test("campaign runtime outcomes keep completed executions without performance as observing", () => {
  const outcomes = buildCampaignRuntimeExperimentOutcomes({
    workspace: buildWorkspace([
      buildLog({
        id: "log-3",
        status: "completed",
        platform: "linkedin",
        kind: "publish_post",
        summary: "Post publicado.",
        sourceCampaignBriefId: "brief-2"
      })
    ])
  });

  assert.equal(outcomes.length, 1);
  assert.equal(outcomes[0].status, "observing");
  assert.equal(outcomes[0].targetMetric, "runtime_delivery");
  assert.equal(outcomes[0].observedValue, 1);
});

function buildWorkspace(socialExecutionLogs: SocialExecutionLog[]): Pick<CompanyWorkspace, "company" | "socialExecutionLogs"> {
  return {
    company,
    socialExecutionLogs
  };
}

function buildLog(input: Partial<SocialExecutionLog> & Pick<SocialExecutionLog, "id" | "status" | "platform" | "kind" | "summary">): SocialExecutionLog {
  return {
    id: input.id,
    companySlug: "acme",
    taskId: input.taskId ?? `task-${input.id}`,
    platform: input.platform,
    kind: input.kind,
    status: input.status,
    summary: input.summary,
    detail: input.detail ?? input.summary,
    startedAt: input.startedAt ?? "2026-05-03T10:00:00.000Z",
    finishedAt: input.finishedAt ?? "2026-05-03T10:05:00.000Z",
    actor: input.actor ?? "tester@example.com",
    externalRef: input.externalRef,
    sourceExperimentId: input.sourceExperimentId,
    sourceCampaignBriefId: input.sourceCampaignBriefId,
    sourceCampaignBriefVersion: input.sourceCampaignBriefVersion,
    variantLabel: input.variantLabel,
    metrics: input.metrics ?? []
  };
}
