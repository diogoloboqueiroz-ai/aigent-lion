import type { CompanySchedulerProfile, CompanyOperationalAlert, CompanyProfile } from "@/lib/domain";
import {
  getStoredGoogleCompanyConnection,
  replaceStoredCompanyOperationalAlerts
} from "@/lib/company-vault";
import {
  ensureFreshGoogleCompanyConnection,
  refreshStoredGoogleConnection
} from "@/lib/google-runtime";

type DeliverOperationalAlertEmailsInput = {
  company: Pick<CompanyProfile, "slug" | "name">;
  alerts: CompanyOperationalAlert[];
  schedulerProfile: Pick<
    CompanySchedulerProfile,
    | "alertRecipients"
    | "financeAlertRecipients"
    | "runtimeAlertRecipients"
    | "strategyAlertRecipients"
    | "approvalAlertRecipients"
    | "connectionAlertRecipients"
  >;
  fallbackRecipientEmail?: string;
  origin: string;
};

type DeliverOperationalAlertEmailsResult = {
  alerts: CompanyOperationalAlert[];
  deliveredCount: number;
  failedCount: number;
};

export async function deliverOperationalAlertEmails(
  input: DeliverOperationalAlertEmailsInput
): Promise<DeliverOperationalAlertEmailsResult> {
  const shouldSendEmail = input.alerts.some(
    (alert) =>
      alert.channels.includes("email_ready") &&
      alert.status === "open" &&
      getPendingRecipients(alert, resolveRecipientsForAlert(alert, input)).length > 0
  );

  if (!shouldSendEmail) {
    return {
      alerts: input.alerts,
      deliveredCount: 0,
      failedCount: 0
    };
  }

  const gmailConnection = getStoredGoogleCompanyConnection(input.company.slug, "gmail");
  if (!gmailConnection) {
    return {
      alerts: input.alerts,
      deliveredCount: 0,
      failedCount: 0
    };
  }

  let connection = await ensureFreshGmailConnection(input.company.slug);
  let deliveredCount = 0;
  let failedCount = 0;
  const nextAlerts: CompanyOperationalAlert[] = [];

  for (const alert of input.alerts) {
    const targetRecipients = resolveRecipientsForAlert(alert, input);
    const pendingRecipients = getPendingRecipients(alert, targetRecipients);

    if (!shouldAttemptAlertEmail(alert, targetRecipients)) {
      nextAlerts.push(alert);
      continue;
    }

    const attemptedAt = new Date().toISOString();
    const deliveredRecipients = new Set(getDeliveredRecipients(alert));
    const failedRecipients: string[] = [];
    let latestSuccessAt = alert.emailSentAt;

    for (const recipientEmail of pendingRecipients) {
      try {
        await sendGmailMessage({
          accessToken: connection.accessToken,
          raw: buildOperationalAlertEmail({
            senderEmail: connection.accountEmail,
            senderName: connection.accountName,
            recipientEmail,
            companyName: input.company.name,
            alert,
            sourceUrl: new URL(alert.sourcePath, input.origin).toString()
          })
        });

        deliveredCount += 1;
        deliveredRecipients.add(recipientEmail);
        latestSuccessAt = attemptedAt;
      } catch (error) {
        const shouldRetryWithRefresh =
          error instanceof GmailAuthError && Boolean(connection.refreshToken);

        if (shouldRetryWithRefresh) {
          try {
            connection = await refreshStoredGoogleConnection(connection);
            await sendGmailMessage({
              accessToken: connection.accessToken,
              raw: buildOperationalAlertEmail({
                senderEmail: connection.accountEmail,
                senderName: connection.accountName,
                recipientEmail,
                companyName: input.company.name,
                alert,
                sourceUrl: new URL(alert.sourcePath, input.origin).toString()
              })
            });

            deliveredCount += 1;
            deliveredRecipients.add(recipientEmail);
            latestSuccessAt = attemptedAt;
            continue;
          } catch (retryError) {
            failedCount += 1;
            failedRecipients.push(`${recipientEmail}: ${toAlertErrorMessage(retryError)}`);
            continue;
          }
        }

        failedCount += 1;
        failedRecipients.push(`${recipientEmail}: ${toAlertErrorMessage(error)}`);
      }
    }

    nextAlerts.push({
      ...alert,
      emailRecipient: targetRecipients[0],
      emailRecipients: targetRecipients,
      emailDeliveredTo: Array.from(deliveredRecipients),
      emailAttemptedAt: attemptedAt,
      emailSentAt: latestSuccessAt,
      emailLastError: failedRecipients.length > 0 ? failedRecipients.join(" | ") : undefined
    });
  }

  replaceStoredCompanyOperationalAlerts(input.company.slug, nextAlerts);

  return {
    alerts: nextAlerts,
    deliveredCount,
    failedCount
  };
}

function shouldAttemptAlertEmail(alert: CompanyOperationalAlert, recipientEmails: string[]) {
  return (
    alert.channels.includes("email_ready") &&
    alert.status === "open" &&
    getPendingRecipients(alert, recipientEmails).length > 0
  );
}

async function ensureFreshGmailConnection(companySlug: string) {
  return ensureFreshGoogleCompanyConnection(companySlug, "gmail");
}

async function sendGmailMessage(input: { accessToken: string; raw: string }) {
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      raw: input.raw
    })
  });

  if (!response.ok) {
    const body = await response.text();

    if (response.status === 401 || response.status === 403) {
      throw new GmailAuthError(body);
    }

    throw new Error(`Falha ao enviar email operacional: ${body}`);
  }
}

function buildOperationalAlertEmail(input: {
  senderEmail: string;
  senderName: string;
  recipientEmail: string;
  companyName: string;
  alert: CompanyOperationalAlert;
  sourceUrl: string;
}) {
  const priorityLabel = getAlertPriorityEmailLabel(input.alert.priority);
  const priorityDescription = getAlertPriorityDescription(input.alert.priority);
  const subject = sanitizeHeaderValue(`[Agent Lion][${priorityLabel}] ${input.companyName} - ${input.alert.title}`);
  const senderName = sanitizeHeaderValue(input.senderName || "Agent Lion");
  const lines = [
    `From: ${senderName} <${input.senderEmail}>`,
    `To: ${sanitizeHeaderValue(input.recipientEmail)}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "",
    `Agent Lion detectou um alerta operacional ${priorityDescription} em ${input.companyName}.`,
    "",
    `Alerta: ${input.alert.title}`,
    `Prioridade: ${input.alert.priority}`,
    `Status: ${input.alert.status}`,
    "",
    input.alert.message,
    "",
    ...(input.alert.evidence?.length
      ? ["Evidencias:", ...input.alert.evidence.map((entry) => `- ${entry}`), ""]
      : []),
    `Abrir origem: ${input.sourceUrl}`,
    "",
    "Esse envio foi gerado automaticamente porque o workspace esta com Gmail conectado para alertas operacionais."
  ];

  return Buffer.from(lines.join("\r\n"), "utf8").toString("base64url");
}

function sanitizeHeaderValue(value: string) {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function getAlertPriorityEmailLabel(priority: CompanyOperationalAlert["priority"]) {
  switch (priority) {
    case "critical":
      return "Critico";
    case "high":
      return "Alta";
    case "medium":
      return "Media";
    default:
      return "Baixa";
  }
}

function getAlertPriorityDescription(priority: CompanyOperationalAlert["priority"]) {
  switch (priority) {
    case "critical":
      return "de prioridade critica";
    case "high":
      return "de prioridade alta";
    case "medium":
      return "de prioridade media";
    default:
      return "de prioridade baixa";
  }
}

function toAlertErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Falha desconhecida ao enviar email operacional.";
}

class GmailAuthError extends Error {}

function normalizeRecipientEmails(emails: string[]) {
  return emails
    .map((entry) => entry.trim().toLowerCase())
    .filter((entry, index, entries) => Boolean(entry) && entries.indexOf(entry) === index);
}

function getDeliveredRecipients(alert: CompanyOperationalAlert) {
  if (alert.emailDeliveredTo?.length) {
    return alert.emailDeliveredTo;
  }

  if (alert.emailRecipient) {
    return [alert.emailRecipient];
  }

  return [];
}

function getPendingRecipients(alert: CompanyOperationalAlert, recipientEmails: string[]) {
  const deliveredRecipients = new Set(getDeliveredRecipients(alert));

  return recipientEmails.filter((entry) => !deliveredRecipients.has(entry));
}

function resolveRecipientsForAlert(
  alert: CompanyOperationalAlert,
  input: Pick<DeliverOperationalAlertEmailsInput, "schedulerProfile" | "fallbackRecipientEmail">
) {
  const defaults = normalizeRecipientEmails(input.schedulerProfile.alertRecipients);
  const fallback = normalizeRecipientEmails(input.fallbackRecipientEmail ? [input.fallbackRecipientEmail] : []);

  const typedRecipients = (() => {
    switch (alert.alertType) {
      case "finance":
        return input.schedulerProfile.financeAlertRecipients;
      case "runtime":
        return input.schedulerProfile.runtimeAlertRecipients;
      case "strategy":
        return input.schedulerProfile.strategyAlertRecipients;
      case "approvals":
        return input.schedulerProfile.approvalAlertRecipients;
      case "connections":
        return input.schedulerProfile.connectionAlertRecipients;
      default:
        return [];
    }
  })();

  const normalizedTypedRecipients = normalizeRecipientEmails(typedRecipients);

  if (normalizedTypedRecipients.length > 0) {
    return normalizedTypedRecipients;
  }

  if (defaults.length > 0) {
    return defaults;
  }

  return fallback;
}
