import assert from "node:assert/strict";
import test from "node:test";
import {
  appendStoredCompanyExecutionPlanToCollection,
  listStoredCompanyExecutionPlans,
  replaceStoredCompanyOperationalAlertsInCollection,
  upsertStoredCompanyKeywordStrategyInCollection,
  upsertStoredCompanyOperationalAlertInCollection
} from "@/infrastructure/persistence/company-strategy-storage";
import type {
  CompanyExecutionPlan,
  CompanyKeywordStrategy,
  CompanyOperationalAlert
} from "@/lib/domain";

test("company strategy storage scopes and caps execution plans", () => {
  const existing = Array.from({ length: 125 }, (_, index) => ({
    id: `plan-${index}`,
    companySlug: index % 2 === 0 ? "acme" : "lion"
  })) as CompanyExecutionPlan[];

  const next = appendStoredCompanyExecutionPlanToCollection(existing, {
    id: "plan-new",
    companySlug: "acme"
  } as CompanyExecutionPlan);

  assert.equal(next.length, 120);
  assert.equal(next[0]?.id, "plan-new");
  assert.ok(listStoredCompanyExecutionPlans(next, "acme").every((plan) => plan.companySlug === "acme"));
});

test("company strategy storage replaces operational alerts per tenant only", () => {
  const existing = [
    { id: "old-acme", companySlug: "acme" },
    { id: "old-lion", companySlug: "lion" }
  ] as CompanyOperationalAlert[];
  const next = replaceStoredCompanyOperationalAlertsInCollection({
    existing,
    companySlug: "acme",
    alerts: [{ id: "new-acme", companySlug: "acme" } as CompanyOperationalAlert]
  });

  assert.deepEqual(next.map((alert) => alert.id), ["new-acme", "old-lion"]);

  const upserted = upsertStoredCompanyOperationalAlertInCollection(next, {
    id: "new-acme",
    companySlug: "acme",
    sourcePlanId: "plan-1",
    sourceActionId: "action-1",
    sourceActionKind: "review_approvals",
    alertType: "approvals",
    title: "updated",
    message: "updated",
    priority: "high",
    status: "open",
    channels: ["scheduler"],
    createdAt: "2026-05-04T00:00:00.000Z",
    updatedAt: "2026-05-04T00:00:00.000Z",
    sourcePath: "/test",
    sourceLabel: "Test"
  } as CompanyOperationalAlert);

  assert.equal(upserted.find((alert) => alert.id === "new-acme")?.title, "updated");
});

test("company strategy storage upserts keyword strategy by tenant", () => {
  const strategies = [
    { companySlug: "acme", mainOffer: "old" },
    { companySlug: "lion", mainOffer: "other" }
  ] as CompanyKeywordStrategy[];
  const next = upsertStoredCompanyKeywordStrategyInCollection(strategies, {
    companySlug: "acme",
    mainOffer: "new"
  } as CompanyKeywordStrategy);

  assert.equal(next.length, 2);
  assert.equal(next.find((strategy) => strategy.companySlug === "acme")?.mainOffer, "new");
});
