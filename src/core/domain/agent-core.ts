import type { ExecutionTrackPriority, PlatformId } from "@/lib/domain";

export type SignalSeverity = "info" | "warning" | "critical";
export type SignalSource =
  | "kpi"
  | "finding"
  | "runtime"
  | "connector"
  | "approval"
  | "learning"
  | "strategy";

export type Signal = {
  id: string;
  tenantId: string;
  source: SignalSource;
  category: string;
  severity: SignalSeverity;
  summary: string;
  evidence: string[];
  observedAt: string;
  metric?: string;
};

export type ContextSnapshot = {
  id: string;
  tenantId: string;
  companyName: string;
  generatedAt: string;
  triggerType: string;
  strategySummary: string[];
  goals: string[];
  connectorSummary: {
    ready: number;
    partial: number;
    blocked: number;
  };
  kpis: Array<{
    label: string;
    value: string;
    context?: string;
  }>;
};

export type Diagnosis = {
  id: string;
  tenantId: string;
  area: string;
  title: string;
  summary: string;
  severity: "low" | "medium" | "high" | "critical";
  confidence: number;
  rootCause: string;
  evidence: string[];
  linkedSignalIds: string[];
};

export type Hypothesis = {
  id: string;
  tenantId: string;
  diagnosisId: string;
  statement: string;
  expectedImpact: string;
  confidence: number;
  supportingEvidence: string[];
};

export type CandidateAction = {
  id: string;
  tenantId: string;
  actionType: string;
  title: string;
  summary: string;
  targetMetric: string;
  targetPlatform?: PlatformId;
  priority: ExecutionTrackPriority;
  impactScore: number;
  urgencyScore: number;
  effortScore: number;
  confidenceScore: number;
  compositeScore: number;
  evidence: string[];
  linkedDiagnosisIds: string[];
  linkedHypothesisIds: string[];
};

export type DecisionReason = {
  code: string;
  summary: string;
  evidence: string[];
};

export type RiskAssessment = {
  reversibility: number;
  historicalSuccess: number;
  policyClarity: number;
  connectorHealth: number;
  confidence: number;
  blastRadius: number;
  financialExposure: number;
  reputationalRisk: number;
  complianceRisk: number;
};

export type AutonomyClassification =
  | "auto_execute"
  | "execute_with_notification"
  | "require_approval"
  | "policy_review"
  | "blocked";

export type AutonomyScore = {
  score: number;
  classification: AutonomyClassification;
  components: RiskAssessment;
};

export type CorePolicyDecision = {
  jobId: string;
  tenantId: string;
  status: "AUTO_EXECUTE" | "REQUIRE_APPROVAL" | "REQUIRE_POLICY_REVIEW" | "BLOCK";
  reasonCodes: string[];
  violatedRules: string[];
  requiredApprovers: string[];
  confidenceFloor: number;
  escalationMetadata: Record<string, unknown>;
  autonomyScore: AutonomyScore;
  rationale: string;
};

export type DecisionCoreTrace = {
  snapshot: ContextSnapshot;
  signals: Signal[];
  diagnoses: Diagnosis[];
  hypotheses: Hypothesis[];
  candidateActions: CandidateAction[];
  selectedActionId?: string;
  reasons: DecisionReason[];
};

export type OutcomeRecord = {
  jobId: string;
  status: "completed" | "blocked" | "failed";
  summary: string;
};

export type DecisionProvenanceRecord = {
  id: string;
  tenantId: string;
  generatedAt: string;
  trigger: {
    id: string;
    type: string;
    actor: string;
    summary: string;
  };
  contextSnapshot: ContextSnapshot;
  signals: Signal[];
  diagnoses: Diagnosis[];
  hypotheses: Hypothesis[];
  candidateActions: CandidateAction[];
  selectedActionId?: string;
  decisionReasons: DecisionReason[];
  policyDecisions: Array<{
    jobId: string;
    status: CorePolicyDecision["status"];
    reasonCodes: string[];
  }>;
  outcomes: OutcomeRecord[];
  version: string;
};

export type LearningUpdate = {
  id: string;
  tenantId: string;
  sourceRunId?: string;
  kind: "playbook" | "risk" | "warning" | "opportunity";
  title: string;
  summary: string;
  confidenceDelta: number;
  evidence: string[];
  nextRecommendation?: string;
  experimentId?: string;
  createdAt: string;
};

