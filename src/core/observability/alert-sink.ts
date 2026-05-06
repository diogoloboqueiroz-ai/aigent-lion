import {
  getPersistedCompanyOperationalAlerts,
  replacePersistedCompanyOperationalAlerts
} from "@/infrastructure/persistence/company-strategy-storage";
import { recordCompanyAuditEvent } from "@/lib/governance";
import type {
  CompanyAutomationControlTowerSummary,
  CompanyOperationalAlert,
  CompanyProfile,
  ExecutionTrackPriority
} from "@/lib/domain";

type SyncAutomationObservabilityAlertsInput = {
  company: Pick<CompanyProfile, "slug" | "name">;
  controlTower: CompanyAutomationControlTowerSummary;
  emailReady: boolean;
  schedulerMinimumPriority?: ExecutionTrackPriority;
  emailMinimumPriority?: ExecutionTrackPriority;
};

export const OBSERVABILITY_ALERT_PREFIX = "alert-obs";

export function syncAutomationObservabilityAlerts(
  input: SyncAutomationObservabilityAlertsInput
) {
  const candidates = buildAutomationObservabilityAlertCandidates(input);
  const existingAlerts = getPersistedCompanyOperationalAlerts(input.company.slug);
  const now = new Date().toISOString();
  const activeAlertIds = new Set(candidates.map((candidate) => candidate.id));
  const existingById = new Map(existingAlerts.map((alert) => [alert.id, alert]));
  const schedulerMinimumPriority = input.schedulerMinimumPriority ?? "high";
  const emailMinimumPriority = getStricterPriority(
    input.emailMinimumPriority ?? "critical",
    schedulerMinimumPriority
  );

  const nextAlerts = [
    ...existingAlerts.filter((alert) => !alert.id.startsWith(OBSERVABILITY_ALERT_PREFIX)),
    ...candidates
      .filter((candidate) => isPriorityAtLeast(candidate.priority, schedulerMinimumPriority))
      .map((candidate) => {
        const previous = existingById.get(candidate.id);
        const channels: CompanyOperationalAlert["channels"] = [
          "scheduler",
          ...(input.emailReady && isPriorityAtLeast(candidate.priority, emailMinimumPriority)
            ? (["email_ready"] as const)
            : [])
        ];

        const nextAlert: CompanyOperationalAlert = {
          ...candidate,
          status:
            previous && previous.status !== "resolved"
              ? previous.status
              : "open",
          channels,
          createdAt:
            previous && previous.status !== "resolved"
              ? previous.createdAt
              : now,
          updatedAt: now,
          acknowledgedAt:
            previous && previous.status !== "resolved"
              ? previous.acknowledgedAt
              : undefined,
          emailRecipient:
            previous && previous.status !== "resolved"
              ? previous.emailRecipient
              : undefined,
          emailRecipients:
            previous && previous.status !== "resolved"
              ? previous.emailRecipients
              : undefined,
          emailDeliveredTo:
            previous && previous.status !== "resolved"
              ? previous.emailDeliveredTo
              : undefined,
          emailAttemptedAt:
            previous && previous.status !== "resolved"
              ? previous.emailAttemptedAt
              : undefined,
          emailSentAt:
            previous && previous.status !== "resolved"
              ? previous.emailSentAt
              : undefined,
          emailLastError:
            previous && previous.status !== "resolved"
              ? previous.emailLastError
              : undefined
        };

        if (!previous || previous.message !== nextAlert.message || previous.priority !== nextAlert.priority) {
          recordCompanyAuditEvent({
            companySlug: input.company.slug,
            connector: "system",
            kind: nextAlert.priority === "critical" ? "warning" : "info",
            title: `Observability alert sink: ${nextAlert.title}`,
            details: nextAlert.message
          });
        }

        return nextAlert;
      }),
    ...existingAlerts
      .filter((alert) => alert.id.startsWith(OBSERVABILITY_ALERT_PREFIX) && !activeAlertIds.has(alert.id))
      .map((alert) =>
        alert.status === "resolved"
          ? alert
          : {
              ...alert,
              status: "resolved" as const,
              updatedAt: now,
              resolvedAt: now
            }
      )
  ]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
    .slice(0, 160);

  replacePersistedCompanyOperationalAlerts(input.company.slug, nextAlerts);
  return nextAlerts;
}

export function buildAutomationObservabilityAlertCandidates(
  input: SyncAutomationObservabilityAlertsInput
) {
  const summary = input.controlTower;
  const candidates: Array<Omit<CompanyOperationalAlert, "status" | "channels" | "createdAt" | "updatedAt">> = [];

  if (summary.health.runtimeStatus === "critical" || summary.health.runtimeHealthScore < 48) {
    candidates.push(
      buildCandidate(input, {
        suffix: "runtime-health",
        priority: "critical",
        alertType: "runtime",
        sourceActionKind: "resolve_runtime_blockers",
        title: "Saude critica do runtime autonomo",
        message: `Runtime health em ${summary.health.runtimeHealthScore}/100 com status ${summary.health.runtimeStatus}. Dead letters: ${summary.totals.deadLetters}.`,
        evidence: [
          `Trust score: ${summary.health.trustScore}.`,
          `Queued items: ${summary.totals.queuedItems}.`,
          `Stalled queue items: ${summary.queuePressure.stalledQueueItems}.`
        ]
      })
    );
  }

  if (
    summary.queuePressure.openCircuitBreakers > 0 ||
    summary.queuePressure.overdueExecutionIntents > 0 ||
    summary.queuePressure.stalledQueueItems > 0
  ) {
    candidates.push(
      buildCandidate(input, {
        suffix: "queue-pressure",
        priority:
          summary.queuePressure.openCircuitBreakers > 0 || summary.queuePressure.stalledQueueItems > 2
            ? "high"
            : "medium",
        alertType: "runtime",
        sourceActionKind: "resolve_runtime_blockers",
        title: "Fila oficial sob pressao operacional",
        message: `Queue pressure detectada com ${summary.queuePressure.stalledQueueItems} stalled items e ${summary.queuePressure.overdueExecutionIntents} intents atrasados.`,
        evidence: [
          `Open breakers: ${summary.queuePressure.openCircuitBreakers}.`,
          `Half-open breakers: ${summary.queuePressure.halfOpenCircuitBreakers}.`,
          `Queued retries: ${summary.queuePressure.queuedRetries}.`
        ]
      })
    );
  }

  if (summary.health.trustScore < 58 || summary.health.failedExecutionRate >= 0.2) {
    candidates.push(
      buildCandidate(input, {
        suffix: "trust-degradation",
        priority: summary.health.trustScore < 45 ? "critical" : "high",
        alertType: "strategy",
        sourceActionKind: "hold_learning_channel",
        title: "Confianca operacional do agente em degradacao",
        message: `Trust score em ${summary.health.trustScore}/100 com failure rate de execucao em ${(summary.health.failedExecutionRate * 100).toFixed(1)}%.`,
        evidence: [
          `Outcome coverage: ${(summary.health.outcomeCoverageRate * 100).toFixed(1)}%.`,
          `Average execution latency: ${Math.round(summary.health.averageExecutionLatencyMs)}ms.`,
          `Dead-letter rate: ${(summary.health.deadLetterRate * 100).toFixed(1)}%.`
        ]
      })
    );
  }

  return candidates;
}

function buildCandidate(
  input: SyncAutomationObservabilityAlertsInput,
  candidate: {
    suffix: string;
    priority: ExecutionTrackPriority;
    alertType: CompanyOperationalAlert["alertType"];
    sourceActionKind: CompanyOperationalAlert["sourceActionKind"];
    title: string;
    message: string;
    evidence: string[];
  }
) {
  return {
    id: `${OBSERVABILITY_ALERT_PREFIX}-${input.company.slug}-${candidate.suffix}`,
    companySlug: input.company.slug,
    sourcePlanId: `control-tower-${input.controlTower.latest.latestRunId ?? "runtime"}`,
    sourceActionId: `control-tower-${candidate.suffix}`,
    sourceActionKind: candidate.sourceActionKind,
    alertType: candidate.alertType,
    title: candidate.title,
    message: candidate.message,
    priority: candidate.priority,
    sourcePath: `/empresas/${input.company.slug}/scheduler`,
    sourceLabel: "Abrir control tower tecnico",
    evidence: candidate.evidence
  };
}

function isPriorityAtLeast(
  priority: ExecutionTrackPriority,
  minimum: ExecutionTrackPriority
) {
  return getPriorityRank(priority) >= getPriorityRank(minimum);
}

function getPriorityRank(priority: ExecutionTrackPriority) {
  switch (priority) {
    case "critical":
      return 4;
    case "high":
      return 3;
    case "medium":
      return 2;
    default:
      return 1;
  }
}

function getStricterPriority(
  left: ExecutionTrackPriority,
  right: ExecutionTrackPriority
) {
  return getPriorityRank(left) >= getPriorityRank(right) ? left : right;
}
