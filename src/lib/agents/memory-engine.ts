import {
  getPersistedCompanyAgentLearnings,
  replacePersistedCompanyAgentLearnings
} from "@/infrastructure/persistence/company-learning-storage";
import { getCompanyWorkspace } from "@/lib/connectors";
import {
  buildCompanyKPIState as buildCoreCompanyKPIState,
  buildCompanyMemory as buildCoreCompanyMemory,
  buildConnectorCapabilities as buildCoreConnectorCapabilities,
  buildCoreCompanyContext,
  buildGrowthGoals as buildCoreGrowthGoals
} from "@/core/domain/company-context";
import type {
  ApprovalCenterItem,
  CompanyAgentLearning,
  CompanyWorkspace,
  UserProfessionalProfile
} from "@/lib/domain";
import type {
  CompanyContext,
  CompanyKPIState,
  CompanyMemory,
  ConnectorCapability,
  GrowthGoal,
  LearningRecord,
  TriggerEvent
} from "@/lib/agents/types";

type BuildCompanyContextInput = {
  workspace: CompanyWorkspace;
  trigger: TriggerEvent;
};

type PersistAgentMemoryInput = {
  workspace: CompanyWorkspace;
  learningRecords: LearningRecord[];
};

export function resolveCompanyWorkspace(
  companySlug: string,
  professionalProfile?: UserProfessionalProfile | null
) {
  return getCompanyWorkspace(companySlug, professionalProfile);
}

export function buildCompanyContext(input: BuildCompanyContextInput): CompanyContext {
  return buildCoreCompanyContext({
    workspace: input.workspace,
    trigger: input.trigger,
    mapLearningRecord: mapStoredLearningToRecord,
    mapApproval: mapApprovalCenterItemToMemoryApproval
  });
}

export function buildGrowthGoals(workspace: CompanyWorkspace): GrowthGoal[] {
  return buildCoreGrowthGoals(workspace);
}

export function buildConnectorCapabilities(workspace: CompanyWorkspace): ConnectorCapability[] {
  return buildCoreConnectorCapabilities(workspace);
}

export function buildCompanyKPIState(
  workspace: CompanyWorkspace,
  connectorCapabilities: ConnectorCapability[]
): CompanyKPIState {
  return buildCoreCompanyKPIState(workspace, connectorCapabilities);
}

export function buildCompanyMemory(workspace: CompanyWorkspace): CompanyMemory {
  return buildCoreCompanyMemory(workspace, {
    mapLearningRecord: mapStoredLearningToRecord,
    mapApproval: mapApprovalCenterItemToMemoryApproval
  });
}

export function getCompanyMemorySummary(
  companySlug: string,
  professionalProfile?: UserProfessionalProfile | null
) {
  const workspace = resolveCompanyWorkspace(companySlug, professionalProfile);

  if (!workspace) {
    return null;
  }

  return buildCompanyMemory(workspace);
}

export function persistCompanyMemory(input: PersistAgentMemoryInput) {
  const existing = getPersistedCompanyAgentLearnings(input.workspace.company.slug);
  const existingById = new Map(existing.map((learning) => [learning.id, learning]));
  const now = new Date().toISOString();

  const mappedLearnings = input.learningRecords.map((record) => {
    const previous = existingById.get(record.id);

    return {
      id: record.id,
      companySlug: input.workspace.company.slug,
      learningBoundary: "tenant_private",
      shareability: "restricted",
      kind: record.kind,
      status: previous ? "active" : "fresh",
      priority: record.priority,
      confidence: record.confidence,
      title: record.title,
      summary: record.summary,
      recommendedAction: record.recommendedAction,
      evidence: record.evidence,
      sourceType: "execution_plan" as const,
      sourcePath: `/empresas/${input.workspace.company.slug}/operacao`,
      sourceLabel: "Abrir operacao",
      generatedAt: previous?.generatedAt ?? record.createdAt,
      updatedAt: now,
      lastAppliedAt: previous?.lastAppliedAt
    } satisfies CompanyAgentLearning;
  });

  const nextLearnings = [
    ...mappedLearnings,
    ...existing.filter((learning) => !mappedLearnings.some((entry) => entry.id === learning.id))
  ].slice(0, 240);

  replacePersistedCompanyAgentLearnings(input.workspace.company.slug, nextLearnings);

  return nextLearnings.map(mapStoredLearningToRecord);
}

function mapStoredLearningToRecord(learning: CompanyAgentLearning): LearningRecord {
  return {
    id: learning.id,
    companySlug: learning.companySlug,
    kind: learning.kind,
    title: learning.title,
    summary: learning.summary,
    confidence: learning.confidence,
    priority: learning.priority,
    evidence: learning.evidence ?? [],
    recommendedAction: learning.recommendedAction,
    createdAt: learning.generatedAt,
    updatedAt: learning.updatedAt
  };
}

function mapApprovalCenterItemToMemoryApproval(item: ApprovalCenterItem) {
  return {
    id: `memory-approval-${item.id}`,
    companySlug: item.companySlug,
    jobId: item.id,
    title: item.title,
    summary: `${item.summary} ${item.context ? `| ${item.context}` : ""}`.trim(),
    status: "pending" as const,
    approvalMode: "requires_approval" as const,
    riskScore: {
      score: 55,
      level: "medium" as const,
      factors: [`Item pendente na central de aprovacoes (${item.kind}).`]
    },
    rationale: "A memoria do agente guarda itens abertos para evitar ciclos cegos.",
    evidence: [item.sourcePath],
    createdAt: item.requestedAt
  };
}
