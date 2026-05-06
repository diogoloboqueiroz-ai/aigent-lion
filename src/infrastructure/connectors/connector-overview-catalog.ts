import type { PlatformId } from "@/lib/domain";

export type GlobalConnectorDefinition = {
  connector: PlatformId;
  label: string;
  access: "read" | "write" | "mixed";
  requiredEnv: string[];
  summary: string;
  nextAction: string;
};

export const globalConnectorDefinitions: GlobalConnectorDefinition[] = [
  {
    connector: "ga4",
    label: "GA4 Data API",
    access: "read",
    requiredEnv: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    summary: "Cliente global Google para iniciar conexoes por empresa em GA4.",
    nextAction: "Configurar client id/client secret do app do agente."
  },
  {
    connector: "google-sheets",
    label: "Google Sheets API",
    access: "mixed",
    requiredEnv: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    summary:
      "Canal operacional para consolidar KPIs, backlog e historico executivo em planilhas por empresa.",
    nextAction: "Conectar as planilhas-chave de cada empresa e permitir escrita apenas em documentos aprovados."
  },
  {
    connector: "search-console",
    label: "Search Console API",
    access: "read",
    requiredEnv: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    summary: "Reaproveita o OAuth Google para conectar propriedades Search Console por empresa.",
    nextAction: "Usar o mesmo app OAuth do Google e mapear sites por workspace."
  },
  {
    connector: "google-ads",
    label: "Google Ads API",
    access: "mixed",
    requiredEnv: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_ADS_DEVELOPER_TOKEN"],
    summary: "Credencial global do agente para depois vincular contas Google Ads de cada empresa.",
    nextAction: "Adicionar developer token e testar leitura read-only em conta sandbox."
  },
  {
    connector: "meta",
    label: "Meta Marketing API",
    access: "mixed",
    requiredEnv: ["META_APP_ID", "META_APP_SECRET"],
    summary: "App global da Meta para conectar ad accounts individuais por empresa.",
    nextAction: "Configurar app id/app secret e preparar fluxo de token por empresa."
  },
  {
    connector: "business-profile",
    label: "Business Profile APIs",
    access: "mixed",
    requiredEnv: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    summary: "Mesmo stack Google, mas com permissao separada para perfis locais.",
    nextAction: "Confirmar aprovacao de acesso e quota antes do onboarding em massa."
  },
  {
    connector: "gmail",
    label: "Gmail API",
    access: "write",
    requiredEnv: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    summary: "Cliente global para enviar follow-up por empresa com escopo minimo.",
    nextAction: "Comecar por gmail.send e armazenar refresh token por workspace."
  },
  {
    connector: "youtube",
    label: "YouTube Data API",
    access: "write",
    requiredEnv: ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
    summary: "Canal de video opcional que pode ser conectado por empresa quando houver demanda.",
    nextAction: "Habilitar apenas nas empresas que realmente publicam video."
  }
];
