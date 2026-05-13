import { getObservabilityCollectorConfigurationError } from "../core/observability/collector-forwarding";

const configurationError = getObservabilityCollectorConfigurationError();

console.log(
  JSON.stringify(
    {
      ok: !configurationError,
      checkedAt: new Date().toISOString(),
      configurationError
    },
    null,
    2
  )
);

if (configurationError) {
  process.exitCode = 1;
}
