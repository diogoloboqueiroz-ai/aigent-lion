import {
  getStoredCompanyCodeWorkspaces,
  getStoredTechnicalRequests
} from "@/lib/company-vault";
import type {
  CompanyCodeWorkspace,
  CompanyProfile,
  TechnicalRequest,
  TechnicalRequestPriority,
  TechnicalRequestStatus
} from "@/lib/domain";

export function getCompanyEngineeringWorkspaces(company: CompanyProfile) {
  const stored = getStoredCompanyCodeWorkspaces(company.slug);
  return stored.length > 0 ? stored : getSeedEngineeringWorkspaces(company);
}

export function getCompanyTechnicalRequests(companySlug: string) {
  return getStoredTechnicalRequests(companySlug).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function buildTechnicalRequest(input: {
  company: CompanyProfile;
  title: string;
  area: TechnicalRequest["area"];
  priority: TechnicalRequestPriority;
  summary: string;
  expectedOutcome: string;
}): TechnicalRequest {
  return {
    id: `tech-${input.company.slug}-${Date.now()}`,
    companySlug: input.company.slug,
    title: input.title,
    area: input.area,
    priority: input.priority,
    status: "backlog",
    summary: input.summary,
    expectedOutcome: input.expectedOutcome,
    agentPlan: getAgentPlan(input.area),
    approvalsRequired: getApprovalRules(input.area),
    createdAt: new Date().toISOString()
  };
}

export function advanceTechnicalRequestStatus(
  request: TechnicalRequest,
  status: TechnicalRequestStatus
) {
  return {
    ...request,
    status
  };
}

function getSeedEngineeringWorkspaces(company: CompanyProfile): CompanyCodeWorkspace[] {
  return [
    {
      id: `code-${company.slug}-site`,
      companySlug: company.slug,
      label: "Site principal",
      path: `Adicionar caminho do repo do site da ${company.name}`,
      stack: "Next.js / frontend",
      objective: "Permitir ao agente ler o projeto principal, propor melhorias e corrigir bugs.",
      status: "planned",
      access: "write",
      notes: "Conectar o caminho local ou repo clonado quando quiser que o agente atue direto no codigo."
    },
    {
      id: `code-${company.slug}-automations`,
      companySlug: company.slug,
      label: "Automacoes e integracoes",
      path: `Adicionar caminho das automacoes da ${company.name}`,
      stack: "scripts / APIs / integrações",
      objective: "Resolver problemas operacionais, automacoes, tracking e integrações técnicas.",
      status: "planned",
      access: "write",
      notes: "Ideal para pixels, conversoes, CRMs, webhooks e jobs."
    }
  ];
}

function getAgentPlan(area: TechnicalRequest["area"]) {
  switch (area) {
    case "performance":
      return [
        "Ler o projeto e localizar gargalos tecnicos.",
        "Analisar renderizacao, requests, bundle e impacto na experiencia.",
        "Propor ou aplicar correcoes com validacao."
      ];
    case "integration":
      return [
        "Mapear credenciais, callbacks, logs e payloads envolvidos.",
        "Encontrar a causa raiz da falha na integração.",
        "Corrigir fluxo e validar ponta a ponta."
      ];
    case "automation":
      return [
        "Ler a automacao atual e o comportamento esperado.",
        "Diagnosticar falhas de trigger, dados ou retries.",
        "Aplicar uma correcao segura e validar."
      ];
    default:
      return [
        "Ler o codigo e o contexto do problema.",
        "Gerar uma proposta de solucao com risco e impacto.",
        "Corrigir e validar o comportamento esperado."
      ];
  }
}

function getApprovalRules(area: TechnicalRequest["area"]) {
  if (area === "integration" || area === "automation") {
    return [
      "Aprovar mudancas que afetem producao, credenciais ou deploy.",
      "Executar livremente apenas leitura, analise e preparacao de patch."
    ];
  }

  return [
    "O agente pode investigar e propor correcao autonomamente.",
    "Deploy ou mudanca externa relevante deve ser confirmado antes."
  ];
}
