import type { AgentActionType } from "@/lib/agents/types";

export type CorePolicyRule = {
  actionType: AgentActionType;
  label: string;
  category: "operations" | "growth" | "governance";
  defaultDecision: "auto_execute" | "requires_approval" | "policy_review";
  channelScope: "internal" | "crm" | "site" | "social" | "ads" | "cross_channel";
  complianceTier: "operational" | "customer_contact" | "marketing_content" | "financial_change";
  blastRadius: "single_task" | "single_channel" | "cross_channel" | "tenant_wide";
  requiresConnectorReadiness?: boolean;
  allowsDraftOnlyAuto?: boolean;
  allowsLeadAutopilot?: boolean;
  spendSensitive?: boolean;
  tenantSpendCapSensitive?: boolean;
  claimRiskProfile?: "none" | "brand" | "compliance";
  autoExecuteConfidenceFloor?: number;
  requireApprovalAboveBudget?: number;
  policyReviewAboveBudget?: number;
  requiresExplicitConsent?: boolean;
  approvalApprovers?: string[];
  policyReviewApprovers?: string[];
  brandApprovers?: string[];
  financeApprovers?: string[];
  complianceApprovers?: string[];
  notes: string[];
  examples: string[];
};

export const CORE_POLICY_REGISTRY: Record<AgentActionType, CorePolicyRule> = {
  review_approvals: {
    actionType: "review_approvals",
    label: "Revisar aprovacoes",
    category: "operations",
    defaultDecision: "requires_approval",
    channelScope: "internal",
    complianceTier: "operational",
    blastRadius: "tenant_wide",
    autoExecuteConfidenceFloor: 82,
    approvalApprovers: ["operator"],
    policyReviewApprovers: ["strategist", "admin"],
    notes: [
      "A fila de aprovacoes pode mudar a velocidade operacional e o risco do ciclo.",
      "Nao deve autoaprovar itens que mudem publicacao, gasto ou contratos."
    ],
    examples: [
      "Priorizar aprovacoes de baixo risco para o operador decidir.",
      "Escalar itens de spend ou policy para revisao humana."
    ]
  },
  stabilize_runtime: {
    actionType: "stabilize_runtime",
    label: "Estabilizar runtime",
    category: "operations",
    defaultDecision: "auto_execute",
    channelScope: "internal",
    complianceTier: "operational",
    blastRadius: "single_task",
    autoExecuteConfidenceFloor: 55,
    notes: [
      "A acao so deve preparar replay e saneamento de fila, sem disparar mutacoes arriscadas.",
      "Indicada quando a runtime bloqueada vira gargalo dominante."
    ],
    examples: [
      "Replay seguro de analytics.",
      "Preparar limpeza de fila e bindings antes da proxima drenagem."
    ]
  },
  queue_social_sync: {
    actionType: "queue_social_sync",
    label: "Enfileirar sync social",
    category: "operations",
    defaultDecision: "auto_execute",
    channelScope: "social",
    complianceTier: "operational",
    blastRadius: "single_channel",
    requiresConnectorReadiness: true,
    autoExecuteConfidenceFloor: 58,
    notes: [
      "Pode autoexecutar quando os bindings analiticos do canal ja estao prontos.",
      "Sem conector pronto, deve ser bloqueado em vez de simular autonomia."
    ],
    examples: ["Criar tarefas de sync para Facebook, Instagram ou LinkedIn com analytics ready."]
  },
  stabilize_tracking: {
    actionType: "stabilize_tracking",
    label: "Estabilizar tracking",
    category: "operations",
    defaultDecision: "auto_execute",
    channelScope: "site",
    complianceTier: "operational",
    blastRadius: "single_channel",
    requiresConnectorReadiness: true,
    autoExecuteConfidenceFloor: 60,
    notes: [
      "Pode autoexecutar quando o objetivo for reparar ou reprocessar sinais de atribuicao.",
      "Nao deve mascarar falta de segredos ou mappings obrigatorios."
    ],
    examples: ["Reenfileirar dispatch de conversao e validar destinos configurados."]
  },
  follow_up_leads: {
    actionType: "follow_up_leads",
    label: "Fazer follow-up comercial",
    category: "growth",
    defaultDecision: "requires_approval",
    channelScope: "crm",
    complianceTier: "customer_contact",
    blastRadius: "single_channel",
    allowsLeadAutopilot: true,
    claimRiskProfile: "none",
    autoExecuteConfidenceFloor: 72,
    requiresExplicitConsent: true,
    approvalApprovers: ["sales_owner"],
    policyReviewApprovers: ["sales_owner", "strategist", "compliance"],
    complianceApprovers: ["compliance"],
    notes: [
      "Pode autoexecutar apenas quando a cadencia e o owner estiverem claros e o modo nao for manual_only.",
      "Qualquer outreach comercial ambiguo deve seguir para approval."
    ],
    examples: [
      "Marcar leads atrasados para contato.",
      "Sincronizar follow-up seguro no CRM com owner e cadence definidos."
    ]
  },
  prepare_growth_report: {
    actionType: "prepare_growth_report",
    label: "Preparar relatorio de growth",
    category: "governance",
    defaultDecision: "auto_execute",
    channelScope: "internal",
    complianceTier: "operational",
    blastRadius: "single_task",
    autoExecuteConfidenceFloor: 45,
    notes: [
      "Rotina executiva de baixo risco, usada para explicabilidade do proximo ciclo.",
      "Pode consolidar snapshots, relatorios e learnings sem approval."
    ],
    examples: ["Gerar relatorio semanal de marketing.", "Atualizar baseline de observabilidade do ciclo."]
  },
  launch_experiment: {
    actionType: "launch_experiment",
    label: "Lancar experimento",
    category: "growth",
    defaultDecision: "requires_approval",
    channelScope: "cross_channel",
    complianceTier: "marketing_content",
    blastRadius: "cross_channel",
    allowsDraftOnlyAuto: true,
    tenantSpendCapSensitive: true,
    claimRiskProfile: "brand",
    autoExecuteConfidenceFloor: 74,
    requireApprovalAboveBudget: 1,
    policyReviewAboveBudget: 1500,
    approvalApprovers: ["strategist"],
    policyReviewApprovers: ["strategist", "admin"],
    brandApprovers: ["brand_owner"],
    financeApprovers: ["finance_owner"],
    complianceApprovers: ["compliance"],
    notes: [
      "Experimentos em modo draft podem ser autoexecutados para preparar bancada de teste.",
      "Publicacao real ou uso de budget deve continuar em approval ou policy review."
    ],
    examples: [
      "Criar variantes A/B no Studio em modo draft.",
      "Abrir landing draft vinculada a um experimento."
    ]
  },
  refresh_creatives: {
    actionType: "refresh_creatives",
    label: "Atualizar criativos",
    category: "growth",
    defaultDecision: "requires_approval",
    channelScope: "social",
    complianceTier: "marketing_content",
    blastRadius: "single_channel",
    allowsDraftOnlyAuto: true,
    claimRiskProfile: "brand",
    autoExecuteConfidenceFloor: 70,
    requireApprovalAboveBudget: 1,
    approvalApprovers: ["strategist"],
    policyReviewApprovers: ["strategist", "admin"],
    brandApprovers: ["brand_owner"],
    complianceApprovers: ["compliance"],
    notes: [
      "Refresh criativo pode autoexecutar apenas como draft auditavel.",
      "Qualquer envio direto para canal continua exigindo aprovacao."
    ],
    examples: ["Gerar nova versao de criativo no Studio.", "Preparar asset alternativo para experimento."]
  },
  audit_connectors: {
    actionType: "audit_connectors",
    label: "Auditar conectores",
    category: "governance",
    defaultDecision: "auto_execute",
    channelScope: "internal",
    complianceTier: "operational",
    blastRadius: "tenant_wide",
    autoExecuteConfidenceFloor: 40,
    notes: [
      "Auditoria de readiness e de cobertura de leitura/escrita e segura por natureza.",
      "Serve como base para explicar por que certas trilhas ainda nao podem autoexecutar."
    ],
    examples: ["Consolidar conectores ready, partial e blocked.", "Apontar o proximo desbloqueio por canal."]
  },
  propose_budget_shift: {
    actionType: "propose_budget_shift",
    label: "Propor mudanca de budget",
    category: "governance",
    defaultDecision: "policy_review",
    channelScope: "ads",
    complianceTier: "financial_change",
    blastRadius: "cross_channel",
    spendSensitive: true,
    tenantSpendCapSensitive: true,
    claimRiskProfile: "none",
    autoExecuteConfidenceFloor: 88,
    policyReviewAboveBudget: 1,
    approvalApprovers: ["strategist", "finance_owner"],
    policyReviewApprovers: ["admin", "strategist", "finance_owner"],
    financeApprovers: ["finance_owner"],
    notes: [
      "Mudancas de budget tocam spend cap, risco financeiro e governanca de canal.",
      "Devem sempre passar por policy review, mesmo com evidencia forte."
    ],
    examples: ["Mover verba de Meta para Google Ads.", "Ampliar budget do canal vencedor."]
  },
  pause_underperforming_channel: {
    actionType: "pause_underperforming_channel",
    label: "Pausar canal com baixa performance",
    category: "governance",
    defaultDecision: "policy_review",
    channelScope: "ads",
    complianceTier: "financial_change",
    blastRadius: "single_channel",
    spendSensitive: true,
    tenantSpendCapSensitive: true,
    claimRiskProfile: "none",
    autoExecuteConfidenceFloor: 84,
    policyReviewAboveBudget: 1,
    approvalApprovers: ["strategist"],
    policyReviewApprovers: ["admin", "strategist", "finance_owner"],
    financeApprovers: ["finance_owner"],
    notes: [
      "Pausar um canal impacta pipeline, aprendizado e distribuicao de receita.",
      "Precisa de revisao de politica para evitar cortes precipitados."
    ],
    examples: ["Segurar um canal classificado como wasteful.", "Interromper canal antes de novo ciclo de aprendizado."]
  }
};

export function getCorePolicyRule(actionType: AgentActionType) {
  return CORE_POLICY_REGISTRY[actionType];
}

export function listCorePolicyRules() {
  return Object.values(CORE_POLICY_REGISTRY);
}
