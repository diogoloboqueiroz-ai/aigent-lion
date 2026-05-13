import type {
  AigentEvolutionArea,
  AigentEvolutionPriority,
  AigentReleaseRiskLevel,
  CodexImplementationTask
} from "@/core/aigent-lion/types";

export type CodexTaskGeneratorInput = {
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
  expectedImpact: string;
  riskLevel: AigentReleaseRiskLevel;
  tags?: string[];
};

export function generateCodexImplementationTask(
  input: CodexTaskGeneratorInput
): CodexImplementationTask {
  const taskId = `codex-task-${input.companySlug}-${input.area}-${stableHash([
    input.title,
    input.objective,
    input.evidence.join("|")
  ].join("|"))}`;
  const tags = Array.from(new Set([input.area, input.priority, input.riskLevel, ...(input.tags ?? [])]));

  return {
    id: taskId,
    companySlug: input.companySlug,
    area: input.area,
    title: input.title,
    objective: input.objective,
    priority: input.priority,
    rationale: input.rationale,
    evidence: input.evidence.slice(0, 8),
    filesToInspect: input.filesToInspect.slice(0, 10),
    suggestedFilesToChange: input.suggestedFilesToChange.slice(0, 10),
    acceptanceCriteria: input.acceptanceCriteria.slice(0, 8),
    prompt: buildCodexPrompt(input),
    expectedImpact: input.expectedImpact,
    riskLevel: input.riskLevel,
    requiresApproval: input.riskLevel === "high" || input.riskLevel === "critical",
    tags
  };
}

function buildCodexPrompt(input: CodexTaskGeneratorInput) {
  return [
    "Voce esta atuando como Principal Engineer no Aigent Lion.",
    "",
    `Empresa/tenant: ${input.companySlug}`,
    `Area: ${input.area}`,
    `Prioridade: ${input.priority}`,
    `Risco de release: ${input.riskLevel}`,
    "",
    "Objetivo",
    input.objective,
    "",
    "Racional",
    input.rationale,
    "",
    "Evidencias que motivaram a tarefa",
    ...input.evidence.map((item) => `- ${item}`),
    "",
    "Arquivos para inspecionar primeiro",
    ...input.filesToInspect.map((file) => `- ${file}`),
    "",
    "Arquivos provaveis de alteracao",
    ...input.suggestedFilesToChange.map((file) => `- ${file}`),
    "",
    "Criterios de aceite",
    ...input.acceptanceCriteria.map((criterion) => `- ${criterion}`),
    "",
    "Regras",
    "- Nao recrie o projeto do zero.",
    "- Nao crie placeholder visual ou engine desconectada.",
    "- Preserve multi-tenancy, policy, auditoria e testes.",
    "- Rode lint, typecheck, tests e build quando a mudanca tocar runtime, API ou UI.",
    "",
    `Impacto esperado: ${input.expectedImpact}`
  ].join("\n");
}

function stableHash(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash.toString(36);
}
