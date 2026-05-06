import type {
  CompanyLearningPlaybook,
  CrossTenantLearningPlaybook,
  LearningEvidenceStrength,
  LearningPlaybookStatus
} from "@/lib/domain";
import {
  buildFailureMemory,
  buildLearningValidityScope,
  buildPlaybookFingerprint,
  buildReuseGuidance,
  computeLearningValidUntil,
  computeLearningStatisticalSummary,
  computeNextLearningVersion,
  inferLearningConfidenceState
} from "@/core/learning/versioned-learning";

type BuildCrossTenantLearningPlaybooksInput = {
  playbooks: CompanyLearningPlaybook[];
  previousPlaybooks?: CrossTenantLearningPlaybook[];
  generatedAt?: string;
};

type AggregatedPlaybook = {
  id: string;
  channel: string;
  title: string;
  summary: string;
  recommendedAction: string;
  confidenceValues: number[];
  winCount: number;
  lossCount: number;
  sourcePlaybookCount: number;
  sourceTenants: Set<string>;
  targetMetrics: string[];
  observedWindows: Array<"7d" | "28d">;
  previous?: CrossTenantLearningPlaybook;
  createdAt: string;
  updatedAt: string;
  lastValidatedAt?: string;
};

export function buildCrossTenantLearningPlaybooks(
  input: BuildCrossTenantLearningPlaybooksInput
): CrossTenantLearningPlaybook[] {
  const aggregated = new Map<string, AggregatedPlaybook>();
  const previousById = new Map((input.previousPlaybooks ?? []).map((playbook) => [playbook.id, playbook]));

  for (const playbook of input.playbooks) {
    if (playbook.shareability === "restricted") {
      continue;
    }

    const summary = sanitizeCrossTenantText(playbook.summary);
    const recommendedAction = sanitizeCrossTenantText(playbook.recommendedAction);
    const title = sanitizeCrossTenantText(playbook.title);
    const fingerprint = buildFingerprint(playbook.channel, summary, recommendedAction);
    const sharedId = `shared-playbook-${fingerprint}`;
    const current = aggregated.get(fingerprint) ?? {
      id: sharedId,
      channel: playbook.channel,
      title,
      summary,
      recommendedAction,
      confidenceValues: [],
      winCount: 0,
      lossCount: 0,
      sourcePlaybookCount: 0,
      sourceTenants: new Set<string>(),
      targetMetrics: [],
      observedWindows: [],
      previous: previousById.get(sharedId),
      createdAt: playbook.createdAt,
      updatedAt: playbook.updatedAt,
      lastValidatedAt: playbook.lastValidatedAt
    };

    current.confidenceValues.push(playbook.confidence);
    current.winCount += playbook.winCount;
    current.lossCount += playbook.lossCount;
    current.sourcePlaybookCount += 1;
    current.sourceTenants.add(playbook.companySlug);
    current.targetMetrics.push(playbook.validityScope.targetMetric);
    current.observedWindows.push(playbook.validityScope.observedWindow);
    current.createdAt = current.createdAt < playbook.createdAt ? current.createdAt : playbook.createdAt;
    current.updatedAt = current.updatedAt > playbook.updatedAt ? current.updatedAt : playbook.updatedAt;
    current.lastValidatedAt =
      !current.lastValidatedAt || (playbook.lastValidatedAt && playbook.lastValidatedAt > current.lastValidatedAt)
        ? playbook.lastValidatedAt
        : current.lastValidatedAt;

    aggregated.set(fingerprint, current);
  }

  return Array.from(aggregated.values())
    .map((entry) => {
      const sourceTenantCount = entry.sourceTenants.size;
      const statisticalSummary = computeLearningStatisticalSummary({
        wins: entry.winCount,
        losses: entry.lossCount,
        minimumSampleSize: Math.max(2, sourceTenantCount)
      });
      const confidence = Number(
        (average(entry.confidenceValues) * 0.35 + statisticalSummary.posteriorMean * 0.65).toFixed(2)
      );
      const status = inferSharedPlaybookStatus({
        sourceTenantCount,
        confidence,
        winCount: entry.winCount,
        lossCount: entry.lossCount,
        evidenceStrength: statisticalSummary.evidenceStrength
      });
      const validityScope = buildLearningValidityScope({
        channel: entry.channel,
        targetMetric: mostCommonString(entry.targetMetrics) ?? "primary_metric",
        observedWindow: mostCommonObservedWindow(entry.observedWindows),
        tenantOnly: false
      });
      const updatedAt = input.generatedAt ?? entry.updatedAt;
      const validUntil = computeLearningValidUntil({
        observedWindow: validityScope.observedWindow,
        updatedAt,
        status
      });
      const confidenceState = inferLearningConfidenceState({
        confidence,
        lossCount: entry.lossCount,
        winCount: entry.winCount,
        status,
        validUntil
      });
      const failureMemory = buildFailureMemory({
        previous: entry.previous?.failureMemory,
        latestStatus: status,
        latestFailureAt:
          entry.lossCount > entry.winCount ? updatedAt : entry.previous?.failureMemory.lastFailureAt,
        latestFailureReason:
          entry.lossCount > entry.winCount
            ? "Playbook cross-tenant perdeu confianca agregada."
            : entry.previous?.failureMemory.lastFailureReason,
        lossCount: entry.lossCount
      });
      const draftPlaybook = {
        id: entry.id,
        learningBoundary: "cross_tenant_safe",
        shareability: "shared",
        version: 1,
        confidenceState,
        validFrom: updatedAt,
        validUntil,
        validityScope,
        failureMemory,
        channel: entry.channel,
        title: entry.title,
        summary: entry.summary,
        status,
        confidence,
        statisticalSummary,
        sourceTenantCount,
        sourcePlaybookCount: entry.sourcePlaybookCount,
        winCount: entry.winCount,
        lossCount: entry.lossCount,
        recommendedAction: entry.recommendedAction,
        reuseGuidance: buildReuseGuidance({
          recommendedAction: entry.recommendedAction,
          channel: entry.channel,
          confidenceState,
          tenantOnly: false
        }),
        evidence: buildSharedEvidence(entry.channel, sourceTenantCount, entry.winCount, entry.lossCount),
        createdAt: entry.createdAt,
        updatedAt,
        lastValidatedAt: entry.lastValidatedAt
      } satisfies CrossTenantLearningPlaybook;
      const nextFingerprint = buildPlaybookFingerprint(draftPlaybook);
      const previousFingerprint = entry.previous ? buildPlaybookFingerprint(entry.previous) : undefined;
      const version = computeNextLearningVersion({
        previous: entry.previous,
        previousFingerprint,
        nextFingerprint
      });

      return {
        ...draftPlaybook,
        version,
        validFrom:
          entry.previous && previousFingerprint === nextFingerprint ? entry.previous.validFrom : draftPlaybook.validFrom
      } satisfies CrossTenantLearningPlaybook;
    })
    .sort(sortSharedPlaybooks);
}

export function sanitizeCrossTenantText(value: string) {
  return value
    .replace(/https?:\/\/\S+/gi, "[url]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email]")
    .replace(/\/empresas\/[^\s/]+/gi, "/empresas/[tenant]")
    .replace(/\b[a-z0-9-]{8,}\b/gi, (token) => (token.includes("-") ? "[id]" : token))
    .replace(/\s+/g, " ")
    .trim();
}

function buildFingerprint(channel: string, summary: string, recommendedAction: string) {
  return normalizeFingerprint([channel, summary, recommendedAction].join("::"));
}

function normalizeFingerprint(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120);
}

function inferSharedPlaybookStatus(input: {
  sourceTenantCount: number;
  confidence: number;
  winCount: number;
  lossCount: number;
  evidenceStrength: LearningEvidenceStrength;
}): LearningPlaybookStatus {
  if (input.lossCount >= input.winCount && input.lossCount >= 2) {
    return "retired";
  }

  if (
    input.sourceTenantCount >= 2 &&
    input.winCount >= input.lossCount + 2 &&
    (
      input.evidenceStrength === "directional" ||
      input.evidenceStrength === "moderate" ||
      input.evidenceStrength === "strong"
    )
  ) {
    return "active";
  }

  return "candidate";
}

function buildSharedEvidence(
  channel: string,
  sourceTenantCount: number,
  winCount: number,
  lossCount: number
) {
  return [
    `Canal consolidado: ${channel}.`,
    `Padrao anonimizado observado em ${sourceTenantCount} tenants.`,
    `Wins/Losses agregados: ${winCount}/${lossCount}.`
  ];
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return Number((values.reduce((total, value) => total + value, 0) / values.length).toFixed(2));
}

function mostCommonString(values: string[]) {
  if (values.length === 0) {
    return undefined;
  }

  const counts = new Map<string, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return Array.from(counts.entries()).sort((left, right) => right[1] - left[1])[0]?.[0];
}

function mostCommonObservedWindow(values: Array<"7d" | "28d">) {
  if (values.length === 0) {
    return "7d" as const;
  }

  const count28d = values.filter((value) => value === "28d").length;
  return count28d > values.length / 2 ? "28d" : "7d";
}

function sortSharedPlaybooks(left: CrossTenantLearningPlaybook, right: CrossTenantLearningPlaybook) {
  return (
    getStatusScore(right.status) - getStatusScore(left.status) ||
    right.sourceTenantCount - left.sourceTenantCount ||
    right.confidence - left.confidence ||
    right.updatedAt.localeCompare(left.updatedAt)
  );
}

function getStatusScore(status: CrossTenantLearningPlaybook["status"]) {
  switch (status) {
    case "active":
      return 3;
    case "candidate":
      return 2;
    default:
      return 1;
  }
}
