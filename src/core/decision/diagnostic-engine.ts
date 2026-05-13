import type {
  AgentFindingSeverity,
  CompanyContext,
  DiagnosticFinding,
  OpportunityArea
} from "@/lib/agents/types";

export function runCoreDiagnosticEngine(context: CompanyContext): DiagnosticFinding[] {
  const findings: DiagnosticFinding[] = [];

  const approvalBacklog = context.kpis.approvalBacklog;
  if (approvalBacklog > 0) {
    findings.push(
      buildFinding(context, {
        id: "approval-backlog",
        area: "operations",
        summary: `${approvalBacklog} itens estao parados na fila de aprovacoes.`,
        severity: approvalBacklog >= 8 ? "critical" : approvalBacklog >= 4 ? "high" : "medium",
        confidence: 0.94,
        evidence: [
          `${approvalBacklog} itens com acao pendente na central de aprovacoes.`,
          `${context.workspace.publishingRequests.filter((request) => request.status === "pending").length} publicacoes aguardando decisao.`
        ],
        suspectedRootCause:
          "A operacao depende demais de validacao manual concentrada e o backlog passou a competir com a execucao.",
        suggestedNextMoves: [
          "Abrir a central de aprovacoes e priorizar itens com maior impacto de receita.",
          "Separar o que e low-risk do que realmente exige policy review."
        ]
      })
    );
  }

  if (context.kpis.runtimeBlocked > 0 || context.kpis.runtimeFailed > 0) {
    const mostRecentIssue = context.recentRuntimeLogs.find(
      (log) => log.status === "blocked" || log.status === "failed"
    );

    findings.push(
      buildFinding(context, {
        id: "runtime-stability",
        area: "operations",
        summary: `A runtime social acumula ${context.kpis.runtimeBlocked} bloqueios e ${context.kpis.runtimeFailed} falhas recentes.`,
        severity: context.kpis.runtimeFailed > 0 ? "critical" : "high",
        confidence: 0.91,
        evidence: [
          mostRecentIssue ? `${mostRecentIssue.platform}: ${mostRecentIssue.detail}` : "A fila ainda nao estabilizou.",
          `${context.kpis.runtimeQueued} tarefas continuam enfileiradas.`
        ],
        suspectedRootCause:
          "Bindings, conectores ou assets operacionais ainda nao estao consistentes o suficiente para drenar a fila com previsibilidade.",
        suggestedNextMoves: [
          "Atacar primeiro a causa da ultima falha ou bloqueio da runtime.",
          "Reexecutar somente depois de confirmar readiness do canal afetado."
        ]
      })
    );
  }

  if (context.workspace.automationRuntimeHealth.deadLetters > 0) {
    findings.push(
      buildFinding(context, {
        id: "automation-dead-letter",
        area: "governance",
        summary: `A runtime autonoma do Agent Lion tem ${context.workspace.automationRuntimeHealth.deadLetters} itens em dead-letter.`,
        severity: "critical",
        confidence: 0.96,
        evidence: [
          context.workspace.automationRuntimeHealth.latestDeadLetterAt
            ? `Ultimo dead-letter em ${context.workspace.automationRuntimeHealth.latestDeadLetterAt}.`
            : "Dead-letter detectado sem timestamp consolidado.",
          `${context.workspace.automationRuntimeHealth.queuedRetries} retries ainda aguardam execucao.`
        ],
        suspectedRootCause:
          "Parte do proprio cerebro operacional esta encontrando falhas repetidas sem recuperacao automatica suficiente.",
        suggestedNextMoves: [
          "Inspecionar o dead-letter antes de ampliar autonomia do ciclo.",
          "Corrigir a classe de erro recorrente e so depois liberar nova escala automatica."
        ]
      })
    );
  }

  const priorityChannelGaps = context.workspace.strategyPlan.priorityChannels.filter((platform) => {
    const connection = context.workspace.connections.find((entry) => entry.platform === platform);
    return !connection || connection.status !== "connected";
  });

  if (priorityChannelGaps.length > 0) {
    findings.push(
      buildFinding(context, {
        id: "priority-channel-gaps",
        area: "acquisition",
        summary: `Existem gaps de conectores nos canais prioritarios: ${priorityChannelGaps.join(", ")}.`,
        severity: priorityChannelGaps.length >= 3 ? "high" : "medium",
        confidence: 0.88,
        evidence: priorityChannelGaps.map((platform) => `Canal prioritario sem readiness total: ${platform}.`),
        suspectedRootCause:
          "A estrategia prioriza canais que ainda nao estao plenamente onboardados ou validados no workspace.",
        suggestedNextMoves: [
          "Conectar primeiro os canais de maior peso no plano estrategico.",
          "Evitar sugerir automacao nesses canais antes do onboarding completo."
        ]
      })
    );
  }

  const blockedConversions = context.workspace.conversionEvents.filter(
    (event) => event.status === "blocked" || event.status === "failed"
  );
  if (blockedConversions.length > 0) {
    findings.push(
      buildFinding(context, {
        id: "tracking-dispatch",
        area: "tracking",
        summary: `${blockedConversions.length} eventos de conversao recentes nao chegaram aos destinos esperados.`,
        severity: blockedConversions.some((event) => event.status === "failed") ? "critical" : "high",
        confidence: 0.93,
        evidence: blockedConversions.slice(0, 4).map((event) => `${event.destination}: ${event.detail}`),
        suspectedRootCause:
          "Falta de mapping, credencial ou identificador de atribuicao confiavel entre captura e destino final.",
        suggestedNextMoves: [
          "Corrigir o destino com mais falhas primeiro.",
          "Revalidar identificadores de clique, segredos e bindings antes do replay."
        ]
      })
    );
  }

  if (context.recentReports.length === 0) {
    findings.push(
      buildFinding(context, {
        id: "reporting-gap",
        area: "governance",
        summary: "Nao ha relatorios recentes para sustentar explicabilidade e rotina executiva.",
        severity: "medium",
        confidence: 0.79,
        evidence: ["Nenhum relatorio recente encontrado no workspace da empresa."],
        suspectedRootCause:
          "A camada executiva ainda depende demais de leitura ad hoc, sem consolidado recorrente.",
        suggestedNextMoves: [
          "Gerar um relatorio semanal base para dar contexto ao proximo ciclo autonomo.",
          "Usar o relatorio como baseline de decisao e auditoria."
        ]
      })
    );
  }

  if (context.kpis.connectorCoverage.ready === 0 || context.kpis.connectorCoverage.blocked >= 3) {
    findings.push(
      buildFinding(context, {
        id: "connector-coverage",
        area: "governance",
        summary: `A cobertura de conectores ainda esta fraca: ${context.kpis.connectorCoverage.ready} prontos, ${context.kpis.connectorCoverage.partial} parciais e ${context.kpis.connectorCoverage.blocked} bloqueados.`,
        severity: context.kpis.connectorCoverage.ready === 0 ? "high" : "medium",
        confidence: 0.82,
        evidence: context.connectorCapabilities
          .filter((capability) => capability.status !== "ready")
          .slice(0, 5)
          .map((capability) => `${capability.label}: ${capability.note}`),
        suspectedRootCause: "O agente ainda tem cobertura desigual de leitura e escrita, o que reduz autonomia real.",
        suggestedNextMoves: [
          "Fechar primeiro os conectores que destravam estrategia e mensuracao.",
          "Marcar explicitamente quais trilhas podem autoexecutar sem depender de conectores bloqueados."
        ]
      })
    );
  }

  if (findings.length === 0) {
    findings.push(
      buildFinding(context, {
        id: "healthy-baseline",
        area: "operations",
        summary: "O workspace nao mostra gargalo operacional dominante neste momento.",
        severity: "low",
        confidence: 0.68,
        evidence: [
          "Aprovacoes sob controle e runtime sem pressao anormal.",
          "Nao ha anomalia dominante acima dos thresholds iniciais."
        ],
        suspectedRootCause: "A operacao esta em estado relativamente estavel para este ciclo.",
        suggestedNextMoves: [
          "Priorizar experimentos ou refresh criativo em vez de manutencao reativa.",
          "Seguir medindo para detectar mudanca de padrao cedo."
        ]
      })
    );
  }

  return findings;
}

function buildFinding(
  context: CompanyContext,
  input: {
    id: string;
    area: OpportunityArea;
    summary: string;
    severity: AgentFindingSeverity;
    confidence: number;
    evidence: string[];
    suspectedRootCause: string;
    suggestedNextMoves: string[];
  }
): DiagnosticFinding {
  return {
    id: `finding-${context.companySlug}-${input.id}`,
    companySlug: context.companySlug,
    area: input.area,
    summary: input.summary,
    severity: input.severity,
    confidence: input.confidence,
    evidence: input.evidence,
    suspectedRootCause: input.suspectedRootCause,
    suggestedNextMoves: input.suggestedNextMoves
  };
}
