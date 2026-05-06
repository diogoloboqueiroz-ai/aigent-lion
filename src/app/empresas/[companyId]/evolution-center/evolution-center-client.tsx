"use client";

import { useState } from "react";
import type { AigentEvolutionCenterSnapshot } from "@/core/aigent-lion/types";

type EvolutionApiResponse =
  | {
      success: true;
      snapshot: AigentEvolutionCenterSnapshot;
    }
  | {
      error: string;
      auditId?: string;
    };

export function EvolutionCenterClient(props: {
  companySlug: string;
  initialSnapshot: AigentEvolutionCenterSnapshot;
}) {
  const [snapshot, setSnapshot] = useState(props.initialSnapshot);
  const [status, setStatus] = useState<"idle" | "loading" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [copiedTaskId, setCopiedTaskId] = useState<string | null>(null);

  async function refreshEvolutionAudit() {
    setStatus("loading");
    setError(null);

    const response = await fetch(`/api/companies/${props.companySlug}/aigent-lion/evolution`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        message: "Revisar criticamente o Aigent Lion e gerar tarefas Codex reais."
      })
    });
    const payload = (await response.json()) as EvolutionApiResponse;

    if (!response.ok || !("success" in payload)) {
      setStatus("error");
      setError("error" in payload ? payload.error : "Falha ao rodar Evolution Center.");
      return;
    }

    setSnapshot(payload.snapshot);
    setStatus("idle");
  }

  async function copyTaskPrompt(taskId: string, prompt: string) {
    await navigator.clipboard.writeText(prompt);
    setCopiedTaskId(taskId);
  }

  return (
    <section style={{ display: "grid", gap: 18 }}>
      <div className="glass" style={toolbarStyle}>
        <div>
          <p className="eyebrow">Live API Check</p>
          <h2 className="section-title">Aigent Evolution Center conectado ao motor real</h2>
          <p className="muted" style={{ margin: "8px 0 0", lineHeight: 1.6 }}>
            Este painel chama a API `/aigent-lion/evolution`, que roda Self-Improvement Engine,
            Codex Task Generator e Release Risk Analyzer sobre o contexto atual da empresa.
            Ele nao aplica patch, nao faz merge e nao faz deploy automatico.
          </p>
        </div>
        <button
          type="button"
          onClick={refreshEvolutionAudit}
          disabled={status === "loading"}
          className="tag"
          style={buttonStyle}
        >
          {status === "loading" ? "Auditando..." : "Rodar auditoria viva"}
        </button>
      </div>

      {error ? (
        <div className="glass" style={{ ...alertStyle, borderColor: "rgba(255, 127, 127, 0.28)" }}>
          {error}
        </div>
      ) : null}

      <div className="grid-auto">
        <MetricCard label="Maturity score" value={`${snapshot.selfImprovement.systemMaturityScore}/100`} />
        <MetricCard label="Release risk" value={`${snapshot.releaseRisk.level} | ${snapshot.releaseRisk.score}/100`} />
        <MetricCard label="Codex tasks" value={String(snapshot.codexTasks.length)} />
        <MetricCard label="Approvals" value={snapshot.releaseRisk.requiresApproval ? "required" : "not required"} />
      </div>

      <div className="premium-status-strip">
        <div className="status-pill status-live">
          <span className="muted">Status real</span>
          <strong>API conectada</strong>
          <span className="muted">O botao roda auditoria viva contra o contexto atual da empresa.</span>
        </div>
        <div className="status-pill status-readiness">
          <span className="muted">Historico</span>
          <strong>Snapshot atual</strong>
          <span className="muted">Historico persistido ainda deve entrar como proximo ciclo de produto.</span>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))", gap: 18 }}>
        <article className="glass" style={panelStyle}>
          <p className="eyebrow">Self-Improvement Engine</p>
          <h2 className="section-title">O que estava fraco</h2>
          <div style={{ display: "grid", gap: 12 }}>
            {snapshot.selfImprovement.recommendations.slice(0, 6).map((recommendation) => (
              <div key={recommendation.id} style={rowStyle}>
                <strong>{recommendation.title}</strong>
                <span className="tag" style={{ width: "fit-content" }}>
                  {recommendation.priority} | {recommendation.area}
                </span>
                <span className="muted" style={{ lineHeight: 1.55 }}>{recommendation.summary}</span>
                <span style={{ lineHeight: 1.55 }}>{recommendation.evidence[0]}</span>
              </div>
            ))}
          </div>
        </article>

        <article className="glass" style={panelStyle}>
          <p className="eyebrow">Release Risk Analyzer</p>
          <h2 className="section-title">Aprovacao de risco</h2>
          <div style={{ display: "grid", gap: 12 }}>
            <span className="tag" style={{ width: "fit-content" }}>
              {snapshot.releaseRisk.requiresApproval ? "approval required" : "safe to continue"}
            </span>
            {snapshot.releaseRisk.reasons.map((reason) => (
              <span key={reason} className="muted" style={{ lineHeight: 1.55 }}>{reason}</span>
            ))}
            {snapshot.releaseRisk.blockers.map((blocker) => (
              <span key={blocker} style={{ color: "var(--danger)", lineHeight: 1.55 }}>{blocker}</span>
            ))}
            {snapshot.releaseRisk.requiredApprovers.length > 0 ? (
              <span>Approvers: {snapshot.releaseRisk.requiredApprovers.join(", ")}</span>
            ) : null}
          </div>
        </article>
      </div>

      <article className="glass" style={panelStyle}>
        <p className="eyebrow">Codex Task Generator</p>
        <h2 className="section-title">Tarefas reais para o proximo ciclo</h2>
        <div style={{ display: "grid", gap: 14 }}>
          {snapshot.codexTasks.slice(0, 5).map((task) => (
            <details key={task.id} style={taskStyle}>
              <summary style={{ cursor: "pointer", fontWeight: 800 }}>
                {task.priority.toUpperCase()} | {task.title}
              </summary>
              <p className="muted" style={{ lineHeight: 1.6 }}>{task.objective}</p>
              <p style={{ lineHeight: 1.6 }}>{task.expectedImpact}</p>
              <div className="grid-auto" style={{ gap: 12 }}>
                <MiniList title="Arquivos para inspecionar" items={task.filesToInspect} />
                <MiniList title="Criterios de aceite" items={task.acceptanceCriteria} />
              </div>
              <button
                type="button"
                className="tag"
                style={copyButtonStyle}
                onClick={() => void copyTaskPrompt(task.id, task.prompt)}
              >
                {copiedTaskId === task.id ? "Prompt copiado" : "Copiar prompt para Codex"}
              </button>
              <pre style={promptStyle}>{task.prompt}</pre>
            </details>
          ))}
          {snapshot.codexTasks.length === 0 ? (
            <div style={rowStyle}>
              <strong>Nenhuma tarefa acionavel nesta rodada.</strong>
              <span className="muted">
                O agente nao inventou trabalho: sem evidencia suficiente, ele fica em observacao.
              </span>
            </div>
          ) : null}
        </div>
      </article>
    </section>
  );
}

function MetricCard(props: { label: string; value: string }) {
  return (
    <article className="glass" style={{ padding: 18, borderRadius: 20 }}>
      <span className="muted" style={{ fontSize: 13 }}>{props.label}</span>
      <strong style={{ display: "block", fontSize: "1.45rem", marginTop: 6 }}>{props.value}</strong>
    </article>
  );
}

function MiniList(props: { title: string; items: string[] }) {
  return (
    <div style={rowStyle}>
      <strong>{props.title}</strong>
      {props.items.slice(0, 6).map((item) => (
        <span key={item} className="muted" style={{ lineHeight: 1.45 }}>{item}</span>
      ))}
    </div>
  );
}

const toolbarStyle = {
  padding: 22,
  borderRadius: 26,
  display: "flex",
  gap: 18,
  justifyContent: "space-between",
  alignItems: "center",
  flexWrap: "wrap" as const
};

const buttonStyle = {
  cursor: "pointer",
  border: "1px solid rgba(126, 224, 179, 0.32)"
};

const copyButtonStyle = {
  ...buttonStyle,
  width: "fit-content",
  marginTop: 8
};

const panelStyle = {
  padding: 24,
  borderRadius: 26,
  display: "grid",
  gap: 16
};

const rowStyle = {
  border: "1px solid rgba(148, 196, 208, 0.14)",
  borderRadius: 18,
  padding: 14,
  background: "rgba(255, 255, 255, 0.035)",
  display: "grid",
  gap: 8
};

const taskStyle = {
  border: "1px solid rgba(126, 224, 179, 0.14)",
  borderRadius: 20,
  padding: 16,
  background: "rgba(3, 12, 17, 0.55)"
};

const promptStyle = {
  whiteSpace: "pre-wrap" as const,
  overflow: "auto",
  maxHeight: 360,
  borderRadius: 16,
  padding: 14,
  background: "rgba(0, 0, 0, 0.28)",
  color: "var(--foreground)",
  fontSize: 13,
  lineHeight: 1.55
};

const alertStyle = {
  padding: 16,
  borderRadius: 18,
  border: "1px solid rgba(148, 196, 208, 0.14)"
};
