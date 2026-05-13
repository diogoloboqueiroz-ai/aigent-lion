import type {
  CompanyConnectorCircuitBreaker,
  CompanyConnectorCircuitBreakerState,
  CompanyAutomationControlTowerSummary,
  CompanyAutomationObservabilityDeliveryRecord,
  CompanyAutomationObservabilityExport,
  CompanyAutomationWorkerHeartbeat,
  CompanyCmoStrategicDecision,
  CompanyConnection,
  CrossTenantLearningPlaybook,
  CompanyAutomationExperimentResult,
  CompanyAutomationQueueItem,
  CompanyAutomationDeadLetterItem,
  CompanyExperimentOutcome,
  CompanyExecutionIntent,
  CompanyExecutionIntentStatus,
  CompanyExecutionPlan,
  CompanyGeneratedReport,
  CompanyAutomationRunMetrics,
  CompanyAutomationRun,
  CompanyAutomationRuntimeHealth,
  CompanyOperationalAlert,
  CompanyWorkspace,
  ConnectorAuditEvent,
  ExecutionTrackPriority,
  MetricSnapshot,
  PlatformId,
  SocialExecutionLog,
  SocialRuntimeTask
} from "@/lib/domain";
import type {
  DecisionCoreTrace,
  DecisionProvenanceRecord,
  LearningUpdate
} from "@/core/domain/agent-core";

export type AgentState =
  | "ingest_context"
  | "analyze"
  | "diagnose"
  | "prioritize"
  | "propose"
  | "approve_if_needed"
  | "execute"
  | "observe"
  | "evaluate"
  | "learn"
  | "schedule_next_cycle";

export type AgentFindingSeverity = "low" | "medium" | "high" | "critical";
export type OpportunityArea =
  | "acquisition"
  | "conversion"
  | "content"
  | "operations"
  | "retention"
  | "tracking"
  | "governance";
export type ApprovalStatus = "pending" | "approved" | "rejected";
export type ExecutionJobStatus =
  | "planned"
  | "running"
  | "completed"
  | "blocked"
  | "failed"
  | "approval_pending";
export type ExecutionIntentStatus = CompanyExecutionIntentStatus;
export type ConnectorCircuitState = CompanyConnectorCircuitBreakerState;
export type ExperimentStatus = "planned" | "running" | "won" | "lost";
export type LearningRecordKind = "playbook" | "risk" | "warning" | "opportunity";
export type AutonomyMode = "auto_execute" | "requires_approval" | "policy_review" | "blocked";
export type TriggerEventType =
  | "manual_run"
  | "scheduled_cycle"
  | "metric_anomaly"
  | "alert_recheck"
  | "approval_resolution"
  | "api_preview";
export type AgentActionType =
  | "review_approvals"
  | "stabilize_runtime"
  | "queue_social_sync"
  | "stabilize_tracking"
  | "follow_up_leads"
  | "prepare_growth_report"
  | "launch_experiment"
  | "refresh_creatives"
  | "audit_connectors"
  | "propose_budget_shift"
  | "pause_underperforming_channel";

export type RiskScore = {
  score: number;
  level: "low" | "medium" | "high" | "critical";
  factors: string[];
};

export type ExecutionIntent = CompanyExecutionIntent;
export type ConnectorCircuitBreaker = CompanyConnectorCircuitBreaker;

export type ConnectorCapability = {
  connector: PlatformId | `social:${string}` | `crm:${string}` | `site:${string}`;
  label: string;
  status: "ready" | "partial" | "blocked";
  canRead: boolean;
  canWrite: boolean;
  capabilities: string[];
  lastSync?: string;
  note: string;
};

export type GrowthGoal = {
  id: string;
  title: string;
  metric: string;
  target: string;
  horizon: string;
  priority: ExecutionTrackPriority;
  note?: string;
};

export type CompanyKPIState = {
  generatedAt: string;
  spend: number;
  revenue: number;
  conversions: number;
  leadsWon: number;
  approvalBacklog: number;
  runtimeQueued: number;
  runtimeBlocked: number;
  runtimeFailed: number;
  recentReports: number;
  activeLearnings: number;
  connectorCoverage: {
    ready: number;
    partial: number;
    blocked: number;
  };
  summaries: Array<{
    label: string;
    value: string;
    context?: string;
  }>;
};

export type CompanyMemory = {
  companySlug: string;
  patterns: string[];
  sharedPatterns?: CrossTenantLearningPlaybook[];
  learningRecords: LearningRecord[];
  openApprovals: ApprovalRequest[];
  activeExperiments: Experiment[];
  recentRuns: Array<{
    id: string;
    startedAt: string;
    summary: string;
    state: AgentState;
  }>;
};

export type CompanyContext = {
  companySlug: string;
  companyName: string;
  generatedAt: string;
  workspace: CompanyWorkspace;
  trigger: TriggerEvent;
  goals: GrowthGoal[];
  kpis: CompanyKPIState;
  connectorCapabilities: ConnectorCapability[];
  memory: CompanyMemory;
  strategySummary: string[];
  recentReports: CompanyGeneratedReport[];
  recentExecutionPlans: CompanyExecutionPlan[];
  recentAlerts: CompanyOperationalAlert[];
  recentAudit: ConnectorAuditEvent[];
  recentRuntimeTasks: SocialRuntimeTask[];
  recentRuntimeLogs: SocialExecutionLog[];
  metricSnapshots: MetricSnapshot[];
};

export type DiagnosticFinding = {
  id: string;
  companySlug: string;
  area: OpportunityArea;
  summary: string;
  severity: AgentFindingSeverity;
  confidence: number;
  evidence: string[];
  suspectedRootCause: string;
  suggestedNextMoves: string[];
};

export type GrowthOpportunity = {
  id: string;
  companySlug: string;
  findingId: string;
  area: OpportunityArea;
  title: string;
  summary: string;
  hypothesis: string;
  impactScore: number;
  urgencyScore: number;
  effortScore: number;
  confidence: number;
  targetMetric: string;
  evidence: string[];
};

export type PrioritizedAction = {
  id: string;
  companySlug: string;
  opportunityId: string;
  findingId: string;
  type: AgentActionType;
  title: string;
  description: string;
  rationale: string;
  evidence: string[];
  targetMetric: string;
  targetPlatform?: PlatformId;
  impactScore: number;
  urgencyScore: number;
  confidenceScore: number;
  effortScore: number;
  compositeScore: number;
  priority: ExecutionTrackPriority;
  riskScore: RiskScore;
  autonomyMode: AutonomyMode;
  params?: Record<string, unknown>;
};

export type ExecutionJob = {
  id: string;
  companySlug: string;
  actionId: string;
  type: AgentActionType;
  title: string;
  status: ExecutionJobStatus;
  autonomyMode: AutonomyMode;
  riskScore: RiskScore;
  rationale: string;
  evidence: string[];
  targetPlatform?: PlatformId;
  inputs: Record<string, unknown>;
  executionIntentId?: string;
  correlationId?: string;
  idempotencyKey?: string;
  connectorKey?: string;
  executorKey?: string;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  auditReferences: string[];
};

export type ApprovalRequest = {
  id: string;
  companySlug: string;
  jobId: string;
  title: string;
  summary: string;
  status: ApprovalStatus;
  approvalMode: Extract<AutonomyMode, "requires_approval" | "policy_review">;
  riskScore: RiskScore;
  rationale: string;
  evidence: string[];
  createdAt: string;
};

export type Experiment = {
  id: string;
  companySlug: string;
  linkedActionId: string;
  title: string;
  channel?: string;
  hypothesis: string;
  primaryMetric: string;
  variants: string[];
  status: ExperimentStatus;
  sourceScorecardId?: string;
  baselineMetricValue?: number;
  successCriteria?: string;
  observationWindowDays?: number;
  confidence?: number;
  sourceRunId?: string;
  lastEvaluatedAt?: string;
  winningVariant?: string;
  nextAction?: string;
  createdAt: string;
};

export type ExperimentResult = {
  id: string;
  companySlug: string;
  experimentId: string;
  status: ExperimentStatus;
  summary: string;
  winningVariant?: string;
  observedMetrics: Array<{
    label: string;
    value: string;
  }>;
  createdAt: string;
};

export type PolicyDecision = {
  jobId: string;
  companySlug: string;
  decision: AutonomyMode;
  riskScore: RiskScore;
  rationale: string;
  reasonCodes: string[];
  violatedRules: string[];
  requiredApprovers: string[];
  confidenceFloor: number;
  escalationMetadata: Record<string, unknown>;
  requiredApprovalMode?: Extract<AutonomyMode, "requires_approval" | "policy_review">;
};

export type AutomationOutcome = {
  jobId: string;
  companySlug: string;
  status: Extract<ExecutionJobStatus, "completed" | "blocked" | "failed">;
  summary: string;
  outputs: Record<string, unknown>;
  executionIntentId?: string;
  executionIntentStatus?: ExecutionIntentStatus;
  correlationId?: string;
  connectorKey?: string;
  executorKey?: string;
  durationMs?: number;
  startedAt: string;
  finishedAt: string;
  auditReferences: string[];
};

export type LearningRecord = {
  id: string;
  companySlug: string;
  kind: LearningRecordKind;
  title: string;
  summary: string;
  confidence: number;
  priority: ExecutionTrackPriority;
  evidence: string[];
  recommendedAction?: string;
  sourceRunId?: string;
  createdAt: string;
  updatedAt: string;
};

export type TriggerEvent = {
  id: string;
  companySlug: string;
  type: TriggerEventType;
  actor: string;
  summary: string;
  createdAt: string;
};

export type AutomationRun = {
  id: string;
  companySlug: string;
  trigger: TriggerEvent;
  state: AgentState;
  startedAt: string;
  finishedAt?: string;
  diagnostics: DiagnosticFinding[];
  opportunities: GrowthOpportunity[];
  actions: PrioritizedAction[];
  jobs: ExecutionJob[];
  approvals: ApprovalRequest[];
  policyDecisions: PolicyDecision[];
  outcomes: AutomationOutcome[];
  learningRecords: LearningRecord[];
  experiments: Experiment[];
  experimentResults: ExperimentResult[];
  cmoDecision?: CompanyCmoStrategicDecision;
  metrics: CompanyAutomationRunMetrics;
  summary: string;
  auditReferences: string[];
  nextSuggestedRunAt?: string;
  decisionProvenance?: DecisionProvenanceRecord;
};

export type StoredExperimentOutcome = CompanyExperimentOutcome;
export type StoredExperimentResult = CompanyAutomationExperimentResult;

export type DiagnosticResult = {
  context: CompanyContext;
  findings: DiagnosticFinding[];
};

export type DecisionResult = {
  context: CompanyContext;
  findings: DiagnosticFinding[];
  opportunities: GrowthOpportunity[];
  actions: PrioritizedAction[];
  cmoDecision?: CompanyCmoStrategicDecision;
  coreDecision?: DecisionCoreTrace;
};

export type FeedbackResult = {
  run: AutomationRun;
  learnings: LearningRecord[];
  experimentResults: ExperimentResult[];
  learningUpdates?: LearningUpdate[];
};

export type AgentRuntimeInspectionView =
  | "summary"
  | "metrics"
  | "queue"
  | "dead_letters"
  | "intents"
  | "breakers"
  | "runs"
  | "all";

export type AgentRuntimeSnapshot = {
  companySlug: string;
  executionPlane: "inline" | "external";
  automationRuntimeHealth: CompanyAutomationRuntimeHealth;
  controlTower: CompanyAutomationControlTowerSummary;
  automationQueue: CompanyAutomationQueueItem[];
  automationDeadLetters: CompanyAutomationDeadLetterItem[];
  executionIntents: CompanyExecutionIntent[];
  connectorCircuitBreakers: CompanyConnectorCircuitBreaker[];
  observability: {
    recentRuns: CompanyAutomationControlTowerSummary["recentRuns"];
    recentDeadLetters: CompanyAutomationControlTowerSummary["recentDeadLetters"];
    recentExecutionIntents: CompanyAutomationControlTowerSummary["recentExecutionIntents"];
    connectorBreakers: CompanyAutomationControlTowerSummary["connectorBreakers"];
    actionBreakdown: CompanyAutomationControlTowerSummary["actionBreakdown"];
    executorBreakdown: CompanyAutomationControlTowerSummary["executorBreakdown"];
    topFailures: CompanyAutomationControlTowerSummary["topFailures"];
    autonomyDistribution: CompanyAutomationControlTowerSummary["autonomyDistribution"];
    executionIntentStatusBreakdown: CompanyAutomationControlTowerSummary["executionIntentStatusBreakdown"];
  };
  observabilityExport?: CompanyAutomationObservabilityExport;
  observabilityDeliveries: CompanyAutomationObservabilityDeliveryRecord[];
  workerHeartbeats: CompanyAutomationWorkerHeartbeat[];
  durableStore: {
    mode: "managed" | "local";
    provider: string;
    available: boolean;
    mutationAllowed: boolean;
    productionReady: boolean;
    configurationError?: string | null;
  };
  policyRegistry: ReturnType<typeof import("@/lib/agents/policy-registry").buildAgentPolicyRegistrySummary>;
  latestAutomationRun: CompanyAutomationRun | null;
  latestExecutionPlan: CompanyExecutionPlan | null;
  latestAlertCount: number;
};

export type AgentWorkspaceSource = Pick<
  CompanyWorkspace,
  | "company"
  | "strategyPlan"
  | "connections"
  | "snapshots"
  | "reports"
  | "executionPlans"
  | "automationRuns"
  | "operationalAlerts"
  | "socialRuntimeTasks"
  | "socialExecutionLogs"
  | "approvalsCenter"
  | "agentLearnings"
>;

export function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function toPriorityFromScore(score: number): ExecutionTrackPriority {
  if (score >= 85) {
    return "critical";
  }

  if (score >= 70) {
    return "high";
  }

  if (score >= 45) {
    return "medium";
  }

  return "low";
}

export function summarizeConnectionStatus(connections: CompanyConnection[]) {
  return connections.reduce(
    (summary, connection) => {
      if (connection.status === "connected") {
        summary.ready += 1;
      } else if (connection.status === "action_required") {
        summary.partial += 1;
      } else {
        summary.blocked += 1;
      }

      return summary;
    },
    {
      ready: 0,
      partial: 0,
      blocked: 0
    }
  );
}
