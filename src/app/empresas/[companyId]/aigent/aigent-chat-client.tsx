"use client";

import { useState, useTransition } from "react";

type ChatResponse = {
  success: boolean;
  answer: string;
  executiveSummary: string;
  agentsUsed: string[];
  artifacts: Array<{
    id: string;
    title: string;
    summary: string;
    type: string;
  }>;
  nextBestActions: Array<{
    id: string;
    title: string;
    summary: string;
    risk: string;
    requiresApproval: boolean;
  }>;
  approvalsRequired: Array<{
    id: string;
    title: string;
    risk: string;
    summary: string;
  }>;
  risks: string[];
  confidence: number;
};

export function AigentChatClient(props: {
  companyId: string;
  initialPrompt?: string;
}) {
  const [message, setMessage] = useState(
    props.initialPrompt ?? "Quero vender mais esse mes. Monte o melhor plano para hoje."
  );
  const [intent, setIntent] = useState("auto");
  const [result, setResult] = useState<ChatResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const response = await fetch(`/api/companies/${props.companyId}/aigent-lion/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message,
          intent,
          autonomy: "advisory"
        })
      });
      const payload = (await response.json().catch(() => null)) as ChatResponse | { error?: string } | null;

      if (!response.ok || !payload || isErrorPayload(payload)) {
        setError(isErrorPayload(payload) ? payload.error ?? "Nao foi possivel falar com o Aigent Lion." : "Nao foi possivel falar com o Aigent Lion.");
        return;
      }

      setResult(payload);
    });
  }

  return (
    <section className="glass" style={{ padding: 26, borderRadius: 30, display: "grid", gap: 20 }}>
      <div style={{ display: "grid", gap: 8 }}>
        <p className="eyebrow">Aigent Lion Chat</p>
        <h2 className="section-title">Converse com o cerebro operacional.</h2>
        <p className="muted" style={{ margin: 0, lineHeight: 1.7 }}>
          O chat aciona especialistas internos, gera plano, cria artefatos e mostra riscos antes de qualquer execucao.
          Ele sempre responde com diagnostico, tese, acoes, evidencias e approvals.
        </p>
      </div>
      <div className="premium-status-strip">
        <div className="status-pill status-readiness">
          <span className="muted">Autonomia desta conversa</span>
          <strong>Advisory</strong>
          <span className="muted">Nenhum publish, budget ou CRM sensivel e executado direto pelo chat.</span>
        </div>
        <div className="status-pill status-live">
          <span className="muted">Resposta esperada</span>
          <strong>Plano operacional</strong>
          <span className="muted">Diagnostico, tese, plano, ativos, riscos, metricas e proximos passos.</span>
        </div>
      </div>
      <div style={{ display: "grid", gap: 12 }}>
        <textarea
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          rows={5}
          style={textareaStyle}
        />
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <select value={intent} onChange={(event) => setIntent(event.target.value)} style={selectStyle}>
            <option value="auto">Auto</option>
            <option value="diagnose">Diagnostico</option>
            <option value="plan">Plano</option>
            <option value="campaign">Campanha</option>
            <option value="creative">Criativo</option>
            <option value="analytics">Analytics</option>
            <option value="execute">Execucao</option>
            <option value="learn">Learning</option>
          </select>
          <button type="button" className="tag" onClick={submit} disabled={isPending} style={buttonStyle}>
            {isPending ? "Pensando..." : "Acionar Supreme Brain"}
          </button>
        </div>
      </div>
      {isPending ? (
        <div style={loadingStyle}>
          <strong>Supreme Brain montando a leitura operacional...</strong>
          <span className="muted">Carregando contexto, especialistas, policy, Campaign OS e memoria da empresa.</span>
        </div>
      ) : null}
      {error ? (
        <div style={errorStyle}>
          <strong>O Lion nao conseguiu completar esta rodada.</strong>
          <span>{error}</span>
          <span className="muted">Nada foi executado. Tente novamente ou abra o Mission Control para checar runtime e credenciais.</span>
        </div>
      ) : null}
      {result ? (
        <div style={{ display: "grid", gap: 18 }}>
          <div style={resultPanelStyle}>
            <strong>Resumo executivo</strong>
            <p style={{ margin: "8px 0 0", lineHeight: 1.7 }}>{result.executiveSummary}</p>
            <span className="tag" style={{ marginTop: 12, width: "fit-content" }}>
              Confianca {Math.round(result.confidence * 100)}%
            </span>
          </div>
          <pre style={answerStyle}>{result.answer}</pre>
          <div className="grid-auto">
            <ResultCard title="Agentes usados" items={result.agentsUsed} />
            <ResultCard title="Next Best Actions" items={result.nextBestActions.map((action) => `${action.title} (${action.risk})`)} />
            <ResultCard title="Aprovacoes" items={result.approvalsRequired.map((approval) => `${approval.title}: ${approval.risk}`)} />
            <ResultCard title="Riscos" items={result.risks} />
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            <p className="eyebrow">Artefatos</p>
            {result.artifacts.slice(0, 6).map((artifact) => (
              <div key={artifact.id} style={resultPanelStyle}>
                <span className="tag" style={{ width: "fit-content" }}>{artifact.type}</span>
                <strong>{artifact.title}</strong>
                <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>{artifact.summary}</p>
              </div>
            ))}
          </div>
        </div>
      ) : !isPending ? (
        <div style={resultPanelStyle}>
          <strong>Pronto para operar.</strong>
          <p className="muted" style={{ margin: 0, lineHeight: 1.6 }}>
            Exemplo bom: &quot;Quero vender mais esse mes&quot; ou &quot;Crie uma campanha completa para Instagram, TikTok e Meta Ads&quot;.
            O Lion vai separar estrategia, execucao, risco e aprendizado.
          </p>
        </div>
      ) : null}
    </section>
  );
}

function isErrorPayload(payload: ChatResponse | { error?: string } | null): payload is { error?: string } {
  return Boolean(payload && "error" in payload);
}

function ResultCard(props: { title: string; items: string[] }) {
  return (
    <article style={resultPanelStyle}>
      <strong>{props.title}</strong>
      <div style={{ display: "grid", gap: 8, marginTop: 10 }}>
        {(props.items.length ? props.items.slice(0, 5) : ["Nenhum item critico agora."]).map((item) => (
          <span key={item} className="muted" style={{ lineHeight: 1.45 }}>{item}</span>
        ))}
      </div>
    </article>
  );
}

const textareaStyle = {
  width: "100%",
  border: "1px solid rgba(126, 224, 179, 0.18)",
  borderRadius: 18,
  background: "rgba(4, 12, 17, 0.86)",
  color: "var(--foreground)",
  padding: 16,
  lineHeight: 1.6,
  resize: "vertical" as const,
  outline: "none"
};

const selectStyle = {
  border: "1px solid rgba(126, 224, 179, 0.18)",
  borderRadius: 999,
  background: "rgba(4, 12, 17, 0.86)",
  color: "var(--foreground)",
  padding: "9px 12px",
  outline: "none"
};

const buttonStyle = {
  cursor: "pointer",
  border: "1px solid rgba(126, 224, 179, 0.26)"
};

const resultPanelStyle = {
  border: "1px solid rgba(148, 196, 208, 0.14)",
  borderRadius: 20,
  background: "rgba(255, 255, 255, 0.035)",
  padding: 16,
  display: "grid",
  gap: 8
};

const answerStyle = {
  whiteSpace: "pre-wrap" as const,
  margin: 0,
  border: "1px solid rgba(126, 224, 179, 0.14)",
  borderRadius: 24,
  padding: 20,
  background: "rgba(2, 8, 12, 0.72)",
  color: "var(--foreground)",
  lineHeight: 1.65,
  fontFamily: "inherit"
};

const errorStyle = {
  border: "1px solid rgba(255, 127, 127, 0.32)",
  background: "rgba(255, 127, 127, 0.1)",
  color: "#ffdede",
  padding: 14,
  borderRadius: 16,
  display: "grid",
  gap: 8
};

const loadingStyle = {
  border: "1px solid rgba(126, 224, 179, 0.22)",
  background: "rgba(126, 224, 179, 0.08)",
  padding: 14,
  borderRadius: 16,
  display: "grid",
  gap: 8
};
