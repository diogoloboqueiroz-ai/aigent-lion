import type {
  CompanyAutomationControlTowerSummary,
  CompanyAutomationObservabilityExport,
  CompanyAutomationObservabilityMetric
} from "@/lib/domain";

export function buildAutomationObservabilityExport(
  summary: CompanyAutomationControlTowerSummary
): CompanyAutomationObservabilityExport {
  const generatedAt = new Date().toISOString();
  const metrics: CompanyAutomationObservabilityMetric[] = [];
  const baseLabels = {
    company_slug: summary.companySlug
  };

  pushMetric(metrics, {
    name: "lion_runs_total",
    description: "Total de automation runs observados no tenant.",
    unit: "count",
    value: summary.totals.runs,
    labels: baseLabels
  });
  pushMetric(metrics, {
    name: "lion_failed_runs_total",
    description: "Total de runs que terminaram com falha.",
    unit: "count",
    value: summary.totals.failedRuns,
    labels: baseLabels
  });
  pushMetric(metrics, {
    name: "lion_queue_items_total",
    description: "Itens atualmente na fila oficial do agente.",
    unit: "count",
    value: summary.totals.queuedItems,
    labels: baseLabels
  });
  pushMetric(metrics, {
    name: "lion_dead_letters_total",
    description: "Itens em dead-letter no tenant.",
    unit: "count",
    value: summary.totals.deadLetters,
    labels: baseLabels
  });

  for (const [name, value, description, unit] of [
    ["lion_runtime_health_score", summary.health.runtimeHealthScore, "Score agregado de saude do runtime.", "score"],
    ["lion_connector_health_score", summary.health.connectorHealthScore, "Score agregado da saude dos conectores.", "score"],
    ["lion_trust_score", summary.health.trustScore, "Indicador composto de confiabilidade operacional.", "score"],
    ["lion_auto_execution_rate", summary.health.autoExecutionRate, "Taxa de jobs autoexecutados.", "ratio"],
    ["lion_approval_rate", summary.health.approvalRate, "Taxa de jobs que exigiram approval/policy.", "ratio"],
    ["lion_block_rate", summary.health.blockRate, "Taxa de jobs bloqueados.", "ratio"],
    ["lion_failed_execution_rate", summary.health.failedExecutionRate, "Taxa de jobs com falha.", "ratio"],
    ["lion_timed_out_execution_rate", summary.health.timedOutExecutionRate, "Taxa de jobs com timeout.", "ratio"],
    ["lion_outcome_coverage_rate", summary.health.outcomeCoverageRate, "Cobertura de outcomes sobre jobs planejados.", "ratio"],
    ["lion_dead_letter_rate", summary.health.deadLetterRate, "Taxa relativa de dead-letters no tenant.", "ratio"],
    ["lion_experiment_win_rate", summary.health.experimentWinRate, "Taxa de experimentos vencedores.", "ratio"],
    ["lion_experiment_loss_rate", summary.health.experimentLossRate, "Taxa de experimentos perdedores.", "ratio"],
    ["lion_average_decision_latency_ms", summary.health.averageDecisionLatencyMs, "Latencia media de decisao do agente.", "milliseconds"],
    ["lion_average_execution_latency_ms", summary.health.averageExecutionLatencyMs, "Latencia media de execucao dos outcomes.", "milliseconds"],
    ["lion_longest_execution_latency_ms", summary.health.longestExecutionLatencyMs, "Maior latencia observada em execucao.", "milliseconds"]
  ] as const) {
    pushMetric(metrics, {
      name,
      description,
      unit,
      value,
      labels: baseLabels
    });
  }

  pushMetric(metrics, {
    name: "lion_observability_delivery_health",
    description: "Saude do canal de entrega de observabilidade do agente.",
    unit: "score",
    value: mapObservabilityHealthToScore(summary.observabilityChannel.health),
    labels: {
      ...baseLabels,
      mode: summary.observabilityChannel.mode,
      ...(summary.observabilityChannel.targetHost
        ? { target_host: summary.observabilityChannel.targetHost }
        : {})
    }
  });
  pushMetric(metrics, {
    name: "lion_observability_deliveries_total",
    description: "Total de entregas recentes observadas no canal de observabilidade.",
    unit: "count",
    value: summary.observabilityChannel.recentDeliveries,
    labels: baseLabels
  });
  pushMetric(metrics, {
    name: "lion_observability_successful_deliveries_total",
    description: "Total de entregas bem-sucedidas no canal de observabilidade.",
    unit: "count",
    value: summary.observabilityChannel.successfulDeliveries,
    labels: baseLabels
  });
  pushMetric(metrics, {
    name: "lion_observability_failed_deliveries_total",
    description: "Total de falhas recentes no canal de observabilidade.",
    unit: "count",
    value: summary.observabilityChannel.failedDeliveries,
    labels: baseLabels
  });
  pushMetric(metrics, {
    name: "lion_observability_received_deliveries_total",
    description: "Total de payloads recebidos pelo collector do agente.",
    unit: "count",
    value: summary.observabilityChannel.receivedDeliveries,
    labels: baseLabels
  });
  pushMetric(metrics, {
    name: "lion_worker_health",
    description: "Saude do worker oficial do Agent Lion.",
    unit: "score",
    value: mapObservabilityHealthToScore(summary.workerHealth.status),
    labels: {
      ...baseLabels,
      expected_mode: summary.workerHealth.expectedMode
    }
  });
  pushMetric(metrics, {
    name: "lion_worker_active_total",
    description: "Workers ativos observados recentemente.",
    unit: "count",
    value: summary.workerHealth.activeWorkers,
    labels: baseLabels
  });
  pushMetric(metrics, {
    name: "lion_worker_stale_total",
    description: "Workers com heartbeat vencido.",
    unit: "count",
    value: summary.workerHealth.staleWorkers,
    labels: baseLabels
  });

  for (const entry of summary.autonomyDistribution) {
    pushMetric(metrics, {
      name: "lion_autonomy_mode_total",
      description: "Distribuicao de modos de autonomia por tenant.",
      unit: "count",
      value: entry.count,
      labels: {
        ...baseLabels,
        autonomy_mode: entry.mode
      }
    });
  }

  for (const entry of summary.executionIntentStatusBreakdown) {
    pushMetric(metrics, {
      name: "lion_execution_intent_status_total",
      description: "Distribuicao dos status de execution intents.",
      unit: "count",
      value: entry.count,
      labels: {
        ...baseLabels,
        intent_status: entry.status
      }
    });
  }

  for (const entry of summary.actionBreakdown) {
    pushMetric(metrics, {
      name: "lion_action_jobs_total",
      description: "Quantidade de jobs por tipo de acao.",
      unit: "count",
      value: entry.totalJobs,
      labels: {
        ...baseLabels,
        action_type: entry.actionType
      }
    });
    pushMetric(metrics, {
      name: "lion_action_avg_execution_latency_ms",
      description: "Latencia media de execucao por tipo de acao.",
      unit: "milliseconds",
      value: entry.averageExecutionLatencyMs,
      labels: {
        ...baseLabels,
        action_type: entry.actionType
      }
    });
  }

  for (const entry of summary.executorBreakdown) {
    pushMetric(metrics, {
      name: "lion_executor_outcomes_total",
      description: "Outcomes por executor real.",
      unit: "count",
      value: entry.totalOutcomes,
      labels: {
        ...baseLabels,
        executor: entry.executor
      }
    });
    pushMetric(metrics, {
      name: "lion_executor_failed_outcomes_total",
      description: "Outcomes falhos por executor.",
      unit: "count",
      value: entry.failedCount,
      labels: {
        ...baseLabels,
        executor: entry.executor
      }
    });
  }

  for (const entry of summary.connectorBreakers) {
    pushMetric(metrics, {
      name: "lion_connector_breaker_state",
      description: "Estado do circuit breaker por conector.",
      unit: "count",
      value: mapBreakerStateToNumber(entry.state),
      labels: {
        ...baseLabels,
        connector_key: entry.connectorKey,
        state: entry.state
      }
    });
  }

  return {
    companySlug: summary.companySlug,
    generatedAt,
    metrics
  };
}

export function formatObservabilityExportAsPrometheus(
  exportBundle: CompanyAutomationObservabilityExport
) {
  const lines: string[] = [];
  const emittedHelp = new Set<string>();
  const emittedType = new Set<string>();

  for (const metric of exportBundle.metrics) {
    if (!emittedHelp.has(metric.name)) {
      lines.push(`# HELP ${metric.name} ${metric.description}`);
      emittedHelp.add(metric.name);
    }

    if (!emittedType.has(metric.name)) {
      lines.push(`# TYPE ${metric.name} gauge`);
      emittedType.add(metric.name);
    }

    const labels = formatPrometheusLabels(metric.labels);
    lines.push(`${metric.name}${labels} ${Number(metric.value.toFixed(4))}`);
  }

  return lines.join("\n");
}

function pushMetric(
  metrics: CompanyAutomationObservabilityMetric[],
  metric: CompanyAutomationObservabilityMetric
) {
  metrics.push(metric);
}

function formatPrometheusLabels(labels?: Record<string, string>) {
  if (!labels || Object.keys(labels).length === 0) {
    return "";
  }

  const serialized = Object.entries(labels)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}="${escapePrometheusLabelValue(value)}"`)
    .join(",");

  return `{${serialized}}`;
}

function escapePrometheusLabelValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function mapBreakerStateToNumber(state: string) {
  switch (state) {
    case "open":
      return 2;
    case "half_open":
      return 1;
    default:
      return 0;
  }
}

function mapObservabilityHealthToScore(health: string) {
  switch (health) {
    case "healthy":
      return 100;
    case "warning":
      return 60;
    default:
      return 25;
  }
}
