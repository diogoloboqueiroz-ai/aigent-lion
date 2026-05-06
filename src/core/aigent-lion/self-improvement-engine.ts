import { generateCodexImplementationTask } from "@/core/aigent-lion/codex-task-generator";
import { analyzeAigentReleaseRisk } from "@/core/aigent-lion/release-risk-analyzer";
import type {
  AigentEvolutionArea,
  AigentEvolutionPriority,
  AigentLionApprovalRequirement,
  AigentLionIntelligenceContext,
  AigentReleaseRiskLevel,
  SelfImprovementRecommendation,
  SelfImprovementReport
} from "@/core/aigent-lion/types";
import { evaluateAgentProductionGates } from "@/core/runtime/production-gates";

type RecommendationSeed = {
  area: AigentEvolutionArea;
  title: string;
  summary: string;
  impact: number;
  urgency: number;
  confidence: number;
  evidence: string[];
  objective: string;
  rationale: string;
  filesToInspect: string[];
  suggestedFilesToChange: string[];
  acceptanceCriteria: string[];
  expectedImpact: string;
  riskLevel: AigentReleaseRiskLevel;
  tags: string[];
};

export function runSelfImprovementEngine(
  context: AigentLionIntelligenceContext,
  generatedAt = new Date().toISOString()
): SelfImprovementReport {
  const seeds = buildRecommendationSeeds(context).slice(0, 8);
  const recommendations = seeds.map((seed, index) =>
    buildRecommendation(context.workspace.company.slug, seed, index + 1)
  );
  const codexTasks = recommendations.map((recommendation) => recommendation.task);
  const releaseRisk = analyzeAigentReleaseRisk({
    companySlug: context.workspace.company.slug,
    tasks: codexTasks,
    generatedAt
  });

  return {
    id: `self-improvement-${context.workspace.company.slug}-${Date.parse(generatedAt) || Date.now()}`,
    companySlug: context.workspace.company.slug,
    generatedAt,
    systemMaturityScore: computeMaturityScore(context, recommendations),
    summary: buildSummary(context, recommendations, releaseRisk.level),
    recommendations,
    codexTasks,
    releaseRisk,
    approvalsRequired: buildApprovalsRequired(releaseRisk),
    nextEvolutionCycle: codexTasks.slice(0, 4).map((task) => task.title),
    provenance: {
      triggerId: context.trigger.id,
      sourceRunIds: context.workspace.automationRuns.slice(0, 6).map((run) => run.id),
      sourceLearningIds: context.workspace.agentLearnings.slice(0, 8).map((learning) => learning.id),
      sourcePolicyDecisionCount: context.policyDecisions.length,
      sourceFindingIds: context.diagnosticFindings.slice(0, 8).map((finding) => finding.id)
    }
  };
}

function buildRecommendationSeeds(context: AigentLionIntelligenceContext): RecommendationSeed[] {
  const seeds: RecommendationSeed[] = [];
  const productionGates = evaluateAgentProductionGates({
    ...process.env,
    NODE_ENV: "production"
  });
  const failingProductionGates = productionGates.filter((gate) => gate.status !== "pass");

  if (failingProductionGates.length > 0) {
    seeds.push({
      area: "production",
      title: "Fechar production gates antes de escala real",
      summary: "O ambiente alvo ainda nao passaria todos os gates obrigatorios de producao.",
      impact: 92,
      urgency: 91,
      confidence: 0.94,
      evidence: failingProductionGates.map((gate) => `${gate.id}: ${gate.status} - ${gate.summary}`),
      objective: "Tornar os gates de producao bloqueantes e verdes para deploy do Aigent Lion.",
      rationale: "Um agente autonomo com execucao e aprendizado nao pode operar empresas reais se persistencia, sessao, worker ou observabilidade estiverem inconsistentes.",
      filesToInspect: [
        "src/core/runtime/production-gates.ts",
        "src/scripts/check-agent-production-gates.ts",
        "OPERATIONS.md",
        ".env.example"
      ],
      suggestedFilesToChange: [
        "src/core/runtime/production-gates.ts",
        "src/scripts/check-agent-production-gates.ts",
        "OPERATIONS.md"
      ],
      acceptanceCriteria: [
        "NODE_ENV=production sem DATABASE_URL falha fechado.",
        "NODE_ENV=production sem AGENT_AUTOMATION_STORE_MODE=managed falha fechado.",
        "Worker externo e sink de observabilidade aparecem como gate verificavel.",
        "Documentacao mostra exatamente como corrigir cada gate."
      ],
      expectedImpact: "Reduzir risco operacional antes de rodar multiempresa em producao.",
      riskLevel: "high",
      tags: ["production", "runtime", "persistence", "security"]
    });
  }

  if (context.controlTower.workerHealth.status !== "healthy" || context.controlTower.totals.deadLetters > 0) {
    seeds.push({
      area: "runtime",
      title: "Endurecer worker, fila e dead-letter no Execution Plane",
      summary: "O control tower mostra worker nao saudavel ou dead letters que precisam virar rotina de replay inspecionavel.",
      impact: 88,
      urgency: context.controlTower.totals.deadLetters > 0 ? 94 : 78,
      confidence: 0.9,
      evidence: [
        `Worker health: ${context.controlTower.workerHealth.status}.`,
        `Dead letters: ${context.controlTower.totals.deadLetters}.`,
        `Queued items: ${context.controlTower.totals.queuedItems}.`
      ],
      objective: "Separar o Execution Plane em fluxo operacional robusto com replay seguro e sinais claros no Mission Control.",
      rationale: "Sem worker confiavel, o Supreme Brain pode decidir bem e ainda assim falhar na execucao continua.",
      filesToInspect: [
        "src/lib/agents/worker.ts",
        "src/lib/agents/queue-processor.ts",
        "src/lib/agents/reliability.ts",
        "src/app/api/companies/[companyId]/agent-runtime/route.ts"
      ],
      suggestedFilesToChange: [
        "src/lib/agents/worker.ts",
        "src/lib/agents/queue-processor.ts",
        "src/app/empresas/[companyId]/mission-control/page.tsx"
      ],
      acceptanceCriteria: [
        "Dead-letter recente aparece com causa, run id e replay hint.",
        "Worker health diferencia healthy, warning e critical.",
        "Replay so e permitido quando policy e idempotencia forem seguros.",
        "Teste cobre dead-letter e worker stale."
      ],
      expectedImpact: "Aumentar confianca operacional do agente continuo.",
      riskLevel: "high",
      tags: ["runtime", "worker", "dead_letter", "external_execution"]
    });
  }

  if (context.controlTower.observabilityChannel.health !== "healthy") {
    seeds.push({
      area: "observability",
      title: "Ligar observabilidade do cerebro a sink verificavel",
      summary: "O canal de observabilidade nao esta saudavel, entao decisoes e falhas podem ficar invisiveis fora do app.",
      impact: 80,
      urgency: 76,
      confidence: 0.88,
      evidence: [
        `Observability health: ${context.controlTower.observabilityChannel.health}.`,
        `Target host: ${context.controlTower.observabilityChannel.targetHost ?? "not configured"}.`
      ],
      objective: "Garantir que metricas do cerebro sejam exportadas e auditaveis em destino operacional.",
      rationale: "Um agente premium precisa ter telemetria externa, alertas e health de canal visiveis.",
      filesToInspect: [
        "src/core/observability/metrics-sink.ts",
        "src/core/observability/collector-forwarding.ts",
        "src/app/api/agent/observability/collector/route.ts"
      ],
      suggestedFilesToChange: [
        "src/core/observability/metrics-sink.ts",
        "src/app/empresas/[companyId]/mission-control/page.tsx",
        "OPERATIONS.md"
      ],
      acceptanceCriteria: [
        "Sink configurado aparece como healthy no control tower.",
        "Falha de forward aparece como warning ou critical.",
        "Metricas incluem decision latency, execution latency, auto-execution rate e dead letters.",
        "Script agent:observability:check valida o destino."
      ],
      expectedImpact: "Melhorar confiabilidade percebida e operacao SRE do agente.",
      riskLevel: "medium",
      tags: ["observability", "production"]
    });
  }

  if (context.campaignOS.launchReadiness.score < 78) {
    seeds.push({
      area: "campaign_os",
      title: "Elevar Campaign OS de plano para launch package mais forte",
      summary: "A campanha gerada ainda tem blockers ou readiness abaixo do padrao premium.",
      impact: 84,
      urgency: 72,
      confidence: 0.86,
      evidence: [
        `Launch readiness: ${context.campaignOS.launchReadiness.score}/100.`,
        ...context.campaignOS.launchReadiness.blockers,
        ...context.campaignOS.launchReadiness.warnings.slice(0, 3)
      ],
      objective: "Transformar o Campaign OS em pacote de lancamento com funil, assets, policy, analytics e aprovacoes mais completos.",
      rationale: "O usuario deve receber campanha executavel, nao apenas estrategia bonita.",
      filesToInspect: [
        "src/core/marketing/campaign-os.ts",
        "src/core/marketing/campaign-intelligence.ts",
        "src/core/marketing/campaign-activation.ts",
        "src/core/creative/multimodal-creative-engine.ts"
      ],
      suggestedFilesToChange: [
        "src/core/marketing/campaign-os.ts",
        "src/app/empresas/[companyId]/campanhas/page.tsx"
      ],
      acceptanceCriteria: [
        "Campaign OS retorna funil, canais, copies, ads, social calendar, video, image prompts, experiments e analytics.",
        "Readiness explica blockers e warnings.",
        "Itens sensiveis viram approval plan.",
        "Teste cobre campanha completa com pelo menos dois canais."
      ],
      expectedImpact: "Aumentar a sensacao de super agencia operacional, nao dashboard.",
      riskLevel: "medium",
      tags: ["campaign_os", "creative_engine", "approval"]
    });
  }

  if (context.campaignOS.creativeQaScore < 76) {
    seeds.push({
      area: "creative_engine",
      title: "Aprofundar QA criativo antes de producao multimodal",
      summary: "O score de QA criativo indica risco de promessa fraca, claim sensivel ou baixa clareza visual.",
      impact: 76,
      urgency: 66,
      confidence: 0.82,
      evidence: [
        `Creative QA: ${context.campaignOS.creativeQaScore}/100.`,
        ...context.campaignOS.risks.slice(0, 4)
      ],
      objective: "Melhorar prompts, roteiros e QA criativo para reduzir revisoes e risco de claim.",
      rationale: "Criatividade multimodal sem QA forte vira volume, nao qualidade premium.",
      filesToInspect: [
        "src/core/creative/image-prompt-engine.ts",
        "src/core/creative/video-script-engine.ts",
        "src/core/creative/creative-qa-engine.ts"
      ],
      suggestedFilesToChange: [
        "src/core/creative/creative-qa-engine.ts",
        "src/core/creative/image-prompt-engine.ts",
        "src/core/creative/video-script-engine.ts"
      ],
      acceptanceCriteria: [
        "QA pontua hook, promessa, audiencia, hierarquia visual, CTA e risco de claim.",
        "Prompt de imagem inclui provider, formato, negative prompt e checklist.",
        "Roteiro de video inclui hook, storyboard, narracao, texto em tela e CTA.",
        "Teste impede creative bloqueado de ir para launch readiness alto."
      ],
      expectedImpact: "Elevar qualidade dos assets e proteger reputacao da marca.",
      riskLevel: "medium",
      tags: ["creative_engine", "compliance"]
    });
  }

  if (context.strategicMemory.confidence < 0.64 || context.workspace.experimentOutcomes.length < 2) {
    seeds.push({
      area: "learning",
      title: "Fechar learning loop com evidencia reutilizavel",
      summary: "A memoria ainda tem baixa confianca ou poucos outcomes suficientes para virar playbook robusto.",
      impact: 86,
      urgency: 74,
      confidence: 0.87,
      evidence: [
        `Strategic memory confidence: ${context.strategicMemory.confidence}.`,
        `Experiment outcomes: ${context.workspace.experimentOutcomes.length}.`,
        `Learning playbooks: ${context.workspace.learningPlaybooks.length}.`
      ],
      objective: "Transformar outcomes de campanha em learning estatistico, versionado e seguro para reuso.",
      rationale: "O Lion so vira agente que melhora continuamente quando aprende com vitorias, derrotas e falhas sem confundir correlacao com causalidade.",
      filesToInspect: [
        "src/core/learning/learning-rigor.ts",
        "src/core/learning/versioned-learning.ts",
        "src/lib/learning.ts",
        "src/core/learning/campaign-runtime-outcomes.ts"
      ],
      suggestedFilesToChange: [
        "src/core/learning/learning-rigor.ts",
        "src/lib/learning.ts"
      ],
      acceptanceCriteria: [
        "Outcome com pouca amostra nao vira playbook reutilizavel.",
        "Confianca decai com tempo sem validacao.",
        "Reuso exige canal e metrica compativeis.",
        "Falhas e approvals negados alimentam risk warnings."
      ],
      expectedImpact: "Aumentar autonomia segura e qualidade de decisao ao longo do tempo.",
      riskLevel: "medium",
      tags: ["learning", "statistics"]
    });
  }

  const blockedPolicies = context.policyDecisions.filter((entry) =>
    entry.policy.status === "BLOCK" || entry.policy.status === "REQUIRE_POLICY_REVIEW"
  );

  if (blockedPolicies.length > 0) {
    seeds.push({
      area: "policy",
      title: "Converter bloqueios de policy em matriz enterprise acionavel",
      summary: "A policy esta protegendo o sistema, mas bloqueios/reviews precisam virar regra clara por tenant, canal e risco.",
      impact: 82,
      urgency: 82,
      confidence: 0.89,
      evidence: blockedPolicies.map((entry) => `${entry.action.title}: ${entry.policy.status} - ${entry.policy.rationale}`),
      objective: "Formalizar ajustes de policy por tenant e evitar bloqueios opacos para o operador.",
      rationale: "Autonomia sem governanca e perigosa; governanca opaca mata velocidade.",
      filesToInspect: [
        "src/core/policy/policy-engine.ts",
        "src/core/policy/tenant-policy-matrix.ts",
        "src/infrastructure/persistence/company-policy-matrix-storage.ts",
        "src/app/api/companies/[companyId]/agent-runtime/policy-matrix/route.ts"
      ],
      suggestedFilesToChange: [
        "src/core/policy/policy-engine.ts",
        "src/core/policy/tenant-policy-matrix.ts"
      ],
      acceptanceCriteria: [
        "Policy decision inclui reason codes, violated rules e approvers.",
        "Tenant matrix consegue bloquear, aprovar ou escalar action types especificos.",
        "High risk nunca autoexecuta.",
        "Teste cobre spend cap, claims sensiveis e connector health."
      ],
      expectedImpact: "Aumentar autonomia graduada sem expor a empresa a risco reputacional ou financeiro.",
      riskLevel: "high",
      tags: ["policy", "compliance", "approval"]
    });
  }

  const topFinding = context.diagnosticFindings.find((finding) => finding.severity === "critical" || finding.severity === "high");
  if (topFinding) {
    seeds.push({
      area: "supreme_brain",
      title: "Fazer o Supreme Brain atacar o gargalo dominante com mais decisao",
      summary: "Existe finding severo que deve virar tese, action plan, policy e tarefa concreta de melhoria.",
      impact: 78,
      urgency: topFinding.severity === "critical" ? 92 : 76,
      confidence: topFinding.confidence,
      evidence: [topFinding.summary, topFinding.suspectedRootCause, ...topFinding.evidence.slice(0, 4)],
      objective: "Reduzir distancia entre diagnostico e execucao priorizada dentro do Supreme Brain.",
      rationale: "Se o cerebro percebe um gargalo severo mas nao transforma isso em tarefa e plano, ele vira apenas analista.",
      filesToInspect: [
        "src/core/aigent-lion/supreme-brain.ts",
        "src/core/aigent-lion/agent-router.ts",
        "src/core/aigent-lion/response-composer.ts",
        "src/lib/agents/cmo-agent.ts"
      ],
      suggestedFilesToChange: [
        "src/core/aigent-lion/agent-router.ts",
        "src/core/aigent-lion/response-composer.ts"
      ],
      acceptanceCriteria: [
        "Finding dominante aparece na resposta final.",
        "Next best action aponta para rota executavel.",
        "Aprovacao ou policy review aparece quando a acao for sensivel.",
        "Provenance inclui finding, policy count e source run ids."
      ],
      expectedImpact: "Tornar o Lion mais estrategista-operador e menos painel explicativo.",
      riskLevel: "medium",
      tags: ["supreme_brain", "decision"]
    });
  }

  if (seeds.length === 0) {
    seeds.push({
      area: "ux",
      title: "Criar smoke UX premium do Mission Control e Aigent Chat",
      summary: "Nenhum gargalo critico foi detectado, entao o proximo ganho e validar clareza e fluxo real do operador.",
      impact: 58,
      urgency: 44,
      confidence: 0.72,
      evidence: [
        "Control tower sem falha critica.",
        "Campaign OS e Supreme Brain conectados.",
        "Proximo risco e percepcao de produto e fluxo do operador."
      ],
      objective: "Garantir que Mission Control e chat operacional respondam as perguntas centrais do usuario.",
      rationale: "Produto premium tambem precisa ser claro, rapido e acionavel para o operador.",
      filesToInspect: [
        "src/app/empresas/[companyId]/mission-control/page.tsx",
        "src/app/empresas/[companyId]/aigent/page.tsx",
        "src/app/empresas/[companyId]/aigent/aigent-chat-client.tsx"
      ],
      suggestedFilesToChange: [
        "src/app/empresas/[companyId]/mission-control/page.tsx",
        "src/app/empresas/[companyId]/aigent/aigent-chat-client.tsx"
      ],
      acceptanceCriteria: [
        "Tela responde o que o Lion percebeu, decidiu, recomenda, arrisca e aprendeu.",
        "Chat mostra agentes usados, artefatos, aprovacoes e confianca.",
        "Mobile nao quebra cards principais.",
        "Build e lint passam."
      ],
      expectedImpact: "Aumentar percepcao de entidade inteligente operacional.",
      riskLevel: "low",
      tags: ["ux", "mission_control"]
    });
  }

  return seeds.sort((left, right) => scoreSeed(right) - scoreSeed(left));
}

function buildRecommendation(
  companySlug: string,
  seed: RecommendationSeed,
  index: number
): SelfImprovementRecommendation {
  const priority = classifyPriority(seed);
  const task = generateCodexImplementationTask({
    companySlug,
    area: seed.area,
    title: seed.title,
    objective: seed.objective,
    priority,
    rationale: seed.rationale,
    evidence: seed.evidence,
    filesToInspect: seed.filesToInspect,
    suggestedFilesToChange: seed.suggestedFilesToChange,
    acceptanceCriteria: seed.acceptanceCriteria,
    expectedImpact: seed.expectedImpact,
    riskLevel: seed.riskLevel,
    tags: seed.tags
  });

  return {
    id: `self-improvement-rec-${companySlug}-${index}`,
    area: seed.area,
    title: seed.title,
    summary: seed.summary,
    priority,
    impact: seed.impact,
    urgency: seed.urgency,
    confidence: Number(Math.max(0.3, Math.min(0.98, seed.confidence)).toFixed(2)),
    evidence: seed.evidence.slice(0, 6),
    task
  };
}

function classifyPriority(seed: RecommendationSeed): AigentEvolutionPriority {
  const score = scoreSeed(seed);

  if (seed.riskLevel === "critical" || score >= 86) {
    return "p0";
  }

  if (seed.riskLevel === "high" || score >= 74) {
    return "p1";
  }

  if (score >= 56) {
    return "p2";
  }

  return "p3";
}

function scoreSeed(seed: RecommendationSeed) {
  return Math.round(seed.impact * 0.46 + seed.urgency * 0.38 + seed.confidence * 16);
}

function computeMaturityScore(
  context: AigentLionIntelligenceContext,
  recommendations: SelfImprovementRecommendation[]
) {
  const trust = context.controlTower.health.trustScore;
  const readiness = context.campaignOS.launchReadiness.score;
  const memory = Math.round(context.strategicMemory.confidence * 100);
  const policyPenalty = context.policyDecisions.filter((entry) => entry.policy.status === "BLOCK").length * 5;
  const backlogPenalty = Math.min(18, recommendations.filter((item) => item.priority === "p0" || item.priority === "p1").length * 4);

  return Math.max(0, Math.min(100, Math.round(trust * 0.34 + readiness * 0.28 + memory * 0.26 + 12 - policyPenalty - backlogPenalty)));
}

function buildSummary(
  context: AigentLionIntelligenceContext,
  recommendations: SelfImprovementRecommendation[],
  releaseRiskLevel: AigentReleaseRiskLevel
) {
  const top = recommendations[0]?.title ?? "Manter smoke tests e observabilidade.";

  return `${context.workspace.company.name}: maturidade operacional recalculada com ${recommendations.length} oportunidades de evolucao. Proximo foco: ${top}. Risco de release agregado: ${releaseRiskLevel}.`;
}

function buildApprovalsRequired(
  releaseRisk: ReturnType<typeof analyzeAigentReleaseRisk>
): AigentLionApprovalRequirement[] {
  if (!releaseRisk.requiresApproval) {
    return [];
  }

  return [
    {
      id: `approval-${releaseRisk.id}`,
      title: "Aprovacao de release do Self-Improvement Engine",
      summary: releaseRisk.reasons.join(" "),
      risk: releaseRisk.level,
      policyStatus: releaseRisk.level === "critical" ? "BLOCK" : "REQUIRE_POLICY_REVIEW",
      requiredApprovers: releaseRisk.requiredApprovers
    }
  ];
}
