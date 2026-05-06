import {
  checkManagedAutomationStoreSchema,
  closeManagedAutomationStorePool
} from "../infrastructure/persistence/managed-automation-store";

async function main() {
  const result = await checkManagedAutomationStoreSchema({ ensure: true });

  console.log(
    JSON.stringify(
      {
        ok: result.ok,
        store: result.store,
        schema: result.schema,
        checkedAt: result.checkedAt,
        missingTables: result.missingTables,
        missingIndexes: result.missingIndexes,
        configurationError: result.configurationError
      },
      null,
      2
    )
  );

  if (!result.ok) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error("[agent-store-check] fatal", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeManagedAutomationStorePool();
  });
