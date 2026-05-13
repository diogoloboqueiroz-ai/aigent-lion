import type { CorePolicyDecision } from "@/core/domain/agent-core";
import type { FullCampaignOS } from "@/core/marketing/campaign-os";
import type {
  CampaignIntelligenceBrief,
  CampaignIntelligenceBriefRecord
} from "@/core/marketing/campaign-intelligence";
import type {
  CompanyAutomationControlTowerSummary,
  CompanyCmoStrategicDecision,
  CompanyExperimentOutcome,
  CompanyLearningPlaybook,
  CompanyWorkspace,
  UserProfessionalProfile
} from "@/lib/domain";
import type {
  CompanyContext,
  DecisionResult,
  DiagnosticFinding,
  GrowthOpportunity,
  PrioritizedAction,
  TriggerEvent
} from "@/lib/agents/types";

export type AigentLionIntent =
  | "diagnose"
  | "plan"
  | "campaign"
  | "creative"
  | "analytics"
  | "execute"
  | "learn"
  | "mission_control"
  | "auto";

export type AigentLionAutonomy = "advisory" | "auto_low_risk" | "approval_required";

export type AigentLionMode =
  | "diagnostic"
  | "strategic_planning"
  | "campaign_os"
  | "creative_engine"
  | "analytics_review"
  | "execution_planning"
  | "learning_review"
  | "mission_control";

export type AigentLionInput = {
  companyId: string;
  actor: string;
  message?: string;
  intent?: AigentLionIntent;
  autonomy?: AigentLionAutonomy;
  context?: Record<string, unknown>;
  professionalProfile?: UserProfessionalProfile;
};

export type AigentLionArtifactType =
  | "diagnosis"
  | "strategy"
  | "campaign_os"
  | "creative_asset"
  | "video_script"
  | "image_prompt"
  | "analytics_plan"
  | "execution_plan"
  | "learning_memory"
  | "policy_review"
  | "self_improvement"
  | "codex_task"
  | "release_risk";

export type AigentLionArtifact = {
  id: string;
  type: AigentLionArtifactType;
  title: string;
  summary: string;
  payload: Record<string, unknown>;
  confidence?: number;
  source?: string;
};

export type AigentLionApprovalRequirement = {
  id: string;
  title: string;
  summary: string;
  risk: string;
  policyStatus: CorePolicyDecision["status"];
  requiredApprovers: string[];
  sourceActionId?: string;
};

export type AigentLionNextBestAction = {
  id: string;
  title: string;
  summary: string;
  impact: number;
  urgency: number;
  effort: number;
  risk: string;
  policyStatus?: CorePolicyDecision["status"];
  requiresApproval: boolean;
  href?: string;
};

export type SpecialistAgentId =
  | "cmo-agent"
  | "strategy-agent"
  | "campaign-architect-agent"
  | "funnel-agent"
  | "copy-chief-agent"
  | "paid-media-agent"
  | "social-growth-agent"
  | "creative-director-agent"
  | "video-script-agent"
  | "image-prompt-agent"
  | "analytics-agent"
  | "conversion-agent"
  | "learning-agent"
  | "compliance-guardian-agent"
  | "execution-operator-agent";

export type SpecialistAgentResult = {
  agentId: SpecialistAgentId;
  title: string;
  summary: string;
  findings: string[];
  recommendations: string[];
  artifacts: AigentLionArtifact[];
  confidence: number;
  risks: string[];
};

export type StrategicMemoryDigest = {
  recentLearnings: string[];
  activePlaybooks: string[];
  experimentOutcomes: string[];
  riskWarnings: string[];
  confidence: number;
};

export type AigentEvolutionArea =
  | "supreme_brain"
  | "campaign_os"
  | "creative_engine"
  | "learning"
  | "policy"
  | "runtime"
  | "observability"
  | "production"
  | "ux"
  | "persistence";

export type AigentEvolutionPriority = "p0" | "p1" | "p2" | "p3";

export type AigentReleaseRiskLevel = "low" | "medium" | "high" | "critical";

export type CodexImplementationTask = {
  id: string;
  companySlug: string;
  area: AigentEvolutionArea;
  title: string;
  objective: string;
  priority: AigentEvolutionPriority;
  rationale: string;
  evidence: string[];
  filesToInspect: string[];
  suggestedFilesToChange: string[];
  acceptanceCriteria: string[];
  prompt: string;
  expectedImpact: string;
  riskLevel: AigentReleaseRiskLevel;
  requiresApproval: boolean;
  tags: string[];
};

export type ReleaseRiskAnalysis = {
  id: string;
  companySlug: string;
  level: AigentReleaseRiskLevel;
  score: number;
  requiresApproval: boolean;
  requiredApprovers: string[];
  reasons: string[];
  blockers: string[];
  mitigations: string[];
  safeToAutoMerge: boolean;
  analyzedAt: string;
};

export type SelfImprovementRecommendation = {
  id: string;
  area: AigentEvolutionArea;
  title: string;
  summary: string;
  priority: AigentEvolutionPriority;
  impact: number;
  urgency: number;
  confidence: number;
  evidence: string[];
  task: CodexImplementationTask;
};

export type SelfImprovementReport = {
  id: string;
  companySlug: string;
  generatedAt: string;
  systemMaturityScore: number;
  summary: string;
  recommendations: SelfImprovementRecommendation[];
  codexTasks: CodexImplementationTask[];
  releaseRisk: ReleaseRiskAnalysis;
  approvalsRequired: AigentLionApprovalRequirement[];
  nextEvolutionCycle: string[];
  provenance: {
    triggerId: string;
    sourceRunIds: string[];
    sourceLearningIds: string[];
    sourcePolicyDecisionCount: number;
    sourceFindingIds: string[];
  };
};

export type AigentLionIntelligenceContext = {
  workspace: CompanyWorkspace;
  trigger: TriggerEvent;
  companyContext: CompanyContext;
  diagnosticFindings: DiagnosticFinding[];
  cmoDecision: CompanyCmoStrategicDecision;
  decisionResult: DecisionResult;
  policyDecisions: Array<{
    action: PrioritizedAction;
    policy: CorePolicyDecision;
  }>;
  campaignOS: FullCampaignOS;
  controlTower: CompanyAutomationControlTowerSummary;
  strategicMemory: StrategicMemoryDigest;
  latestCampaignBrief?: CampaignIntelligenceBrief | CampaignIntelligenceBriefRecord;
  selfImprovement?: SelfImprovementReport;
};

export type AigentLionSupremeBrainOutput = {
  success: boolean;
  mode: AigentLionMode;
  answer: string;
  executiveSummary: string;
  diagnosis: {
    dominantConstraint: CompanyCmoStrategicDecision["dominantConstraint"];
    findings: DiagnosticFinding[];
    confidence: number;
  };
  strategy: {
    weeklyThesis: string;
    primaryBet: string;
    focusMetric: string;
    expectedImpact: string;
    opportunities: GrowthOpportunity[];
  };
  recommendedActions: AigentLionNextBestAction[];
  agentsUsed: string[];
  artifacts: AigentLionArtifact[];
  approvalsRequired: AigentLionApprovalRequirement[];
  risks: string[];
  memoryUpdates: Array<{
    title: string;
    summary: string;
    source: "learning" | "playbook" | "experiment" | "runtime";
  }>;
  nextBestActions: AigentLionNextBestAction[];
  confidence: number;
  provenance: {
    companySlug: string;
    triggerId: string;
    generatedAt: string;
    cmoDecisionId?: string;
    sourceRunIds: string[];
    sourceLearningIds: string[];
    sourcePlaybookIds: string[];
    sourceOutcomeIds: string[];
    policyDecisionCount: number;
  };
};

export type MissionControlSnapshot = {
  companySlug: string;
  generatedAt: string;
  supremeBrain: AigentLionSupremeBrainOutput;
  controlTower: CompanyAutomationControlTowerSummary;
  cmoDecision: CompanyCmoStrategicDecision;
  findings: DiagnosticFinding[];
  actions: AigentLionNextBestAction[];
  campaignOS: FullCampaignOS;
  learning: {
    recentLearnings: StrategicMemoryDigest["recentLearnings"];
    playbooks: CompanyLearningPlaybook[];
    outcomes: CompanyExperimentOutcome[];
  };
  approvals: {
    pendingSocial: number;
    pendingPayments: number;
    totalPending: number;
  };
  selfImprovement: SelfImprovementReport;
};

export type AigentEvolutionCenterSnapshot = {
  companySlug: string;
  generatedAt: string;
  supremeBrain: AigentLionSupremeBrainOutput;
  selfImprovement: SelfImprovementReport;
  releaseRisk: ReleaseRiskAnalysis;
  codexTasks: CodexImplementationTask[];
  qualityGates: Array<{
    id: string;
    label: string;
    status: "pass" | "warn" | "fail";
    summary: string;
  }>;
};
