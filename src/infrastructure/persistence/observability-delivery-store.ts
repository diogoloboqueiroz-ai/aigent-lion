import {
  readPlainJsonFile,
  writePlainJsonFile
} from "@/infrastructure/persistence/company-vault-storage";
import { getObservabilityDeliveryPaths } from "@/infrastructure/persistence/storage-paths";
import type { CompanyAutomationObservabilityDeliveryRecord } from "@/lib/domain";

type ObservabilityDeliveryPayload = {
  deliveries: CompanyAutomationObservabilityDeliveryRecord[];
};

const EMPTY_PAYLOAD: ObservabilityDeliveryPayload = {
  deliveries: []
};

export function listObservabilityDeliveries(companySlug?: string) {
  const payload = readObservabilityDeliveryPayload();
  const filtered = companySlug
    ? payload.deliveries.filter((entry) => entry.companySlug === companySlug)
    : payload.deliveries;

  return [...filtered].sort((left, right) => {
    const leftTime = left.deliveredAt ?? left.createdAt;
    const rightTime = right.deliveredAt ?? right.createdAt;
    return rightTime.localeCompare(leftTime);
  });
}

export function appendObservabilityDeliveryRecord(
  delivery: CompanyAutomationObservabilityDeliveryRecord
) {
  const payload = readObservabilityDeliveryPayload();
  const nextDeliveries = payload.deliveries.filter((entry) => entry.id !== delivery.id);

  nextDeliveries.unshift(delivery);
  writeObservabilityDeliveryPayload({
    deliveries: nextDeliveries.slice(0, 1000)
  });
}

function readObservabilityDeliveryPayload() {
  const { deliveryFile, deliveryBackupFile } = getObservabilityDeliveryPaths();
  return (
    readPlainJsonFile<ObservabilityDeliveryPayload>({
      candidateFiles: [deliveryFile, deliveryBackupFile]
    }) ?? { ...EMPTY_PAYLOAD }
  );
}

function writeObservabilityDeliveryPayload(payload: ObservabilityDeliveryPayload) {
  const { dataDir, deliveryFile, deliveryBackupFile, deliveryTempFile } =
    getObservabilityDeliveryPaths();
  writePlainJsonFile({
    dataDir,
    targetFile: deliveryFile,
    backupFile: deliveryBackupFile,
    tempFile: deliveryTempFile,
    payload: JSON.stringify(payload, null, 2)
  });
}
