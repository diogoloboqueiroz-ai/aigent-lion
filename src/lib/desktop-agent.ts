import { getStoredDesktopAgentProfile } from "@/lib/company-vault";
import type { DesktopAgentProfile } from "@/lib/domain";

function getUserHome() {
  return process.env.USERPROFILE ?? "C:\\Users\\operador";
}

export function getDesktopAgentProfile() {
  const stored = getStoredDesktopAgentProfile();
  if (stored) {
    return stored;
  }

  const home = getUserHome();

  return {
    status: "seeded",
    updatedAt: new Date().toISOString(),
    accessMode: "full_desktop_guarded",
    approvedRoots: [
      `${home}\\Desktop`,
      `${home}\\Documents`,
      `${home}\\Downloads`,
      `${home}\\OneDrive\\Desktop\\super-agencia-ia`
    ],
    outputRoots: [
      `${home}\\Desktop\\exports-marketing`,
      `${home}\\Desktop\\rascunhos-criativos`,
      `${home}\\Desktop\\relatorios-marketing`
    ],
    allowedApps: [
      "Google Chrome",
      "Google Drive",
      "Google Sheets",
      "Google Docs",
      "Canva",
      "Adobe Photoshop",
      "Adobe Express",
      "Adobe Premiere Pro",
      "Adobe After Effects",
      "CapCut",
      "Figma",
      "ChatGPT",
      "Gemini",
      "Claude"
    ],
    autonomousActions: [
      "Criar pastas, arquivos, briefs, roteiros, planilhas e relatorios locais.",
      "Organizar ativos por cliente, campanha e data.",
      "Gerar exports, rascunhos, thumbnails, copys, prompts e documentos internos.",
      "Abrir apps de criacao e operacao para preparar materiais e fluxo de trabalho."
    ],
    approvalRequiredActions: [
      "Publicar posts, videos ou emails.",
      "Executar pagamentos ou gastos em plataformas.",
      "Apagar arquivos fora das pastas aprovadas.",
      "Instalar programas, mudar configuracoes do sistema ou operar contas sensiveis."
    ],
    blockedActions: [
      "Excluir arquivos sensiveis em massa sem confirmacao.",
      "Alterar configuracoes de seguranca do computador sem aprovacao.",
      "Mover dados pessoais para destinos nao aprovados.",
      "Executar compras ou pagamentos automaticos sem liberacao explicita."
    ],
    runtimeNotes:
      "O agente local pode agir como operador real do computador para gerar arquivos e organizar trabalho, mas publicacao, pagamento, delecao sensivel e mudancas no sistema continuam protegidas por aprovacao."
  } satisfies DesktopAgentProfile;
}

export function parseDesktopAgentForm(formData: FormData, current: DesktopAgentProfile) {
  return {
    ...current,
    status: "customized" as const,
    updatedAt: new Date().toISOString(),
    approvedRoots: textareaToList(formData.get("approvedRoots")),
    outputRoots: textareaToList(formData.get("outputRoots")),
    allowedApps: textareaToList(formData.get("allowedApps")),
    autonomousActions: textareaToList(formData.get("autonomousActions")),
    approvalRequiredActions: textareaToList(formData.get("approvalRequiredActions")),
    blockedActions: textareaToList(formData.get("blockedActions")),
    runtimeNotes: String(formData.get("runtimeNotes") ?? current.runtimeNotes)
  };
}

export function listToTextarea(values: string[]) {
  return values.join("\n");
}

function textareaToList(value: FormDataEntryValue | null) {
  return String(value ?? "")
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}
