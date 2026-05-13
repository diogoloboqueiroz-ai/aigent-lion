import assert from "node:assert/strict";
import test from "node:test";
import { evaluateCompanyPermission, hasCompanyAccess } from "@/lib/rbac";
import type { UserProfessionalProfile } from "@/lib/domain";

function buildProfile(overrides?: Partial<UserProfessionalProfile>): UserProfessionalProfile {
  return {
    userKey: "google:test-user",
    email: "test@example.com",
    displayName: "Test User",
    role: "strategist",
    permissions: ["agent:run", "agent:decide"],
    tenantScope: "all",
    allowedCompanySlugs: [],
    trainingStatus: "seeded",
    updatedAt: "2026-04-22T10:00:00.000Z",
    professionalTitle: "Strategist",
    businessModel: "Growth OS",
    strategicNorthStar: "Crescer com seguranca",
    decisionStyle: "Analitico",
    planningCadence: "Semanal",
    costDiscipline: "Alta",
    expertiseAreas: ["Performance"],
    preferredChannels: ["google-ads"],
    targetSectors: ["SaaS"],
    clientSelectionRules: [],
    approvalPreferences: [],
    growthLevers: [],
    learnedPatterns: [],
    noGoRules: [],
    strategicNotes: "",
    systemPrompt: "",
    ...overrides
  };
}

test("rbac allows access when permission exists and tenant scope is open", () => {
  const profile = buildProfile();

  assert.equal(hasCompanyAccess(profile, "acme"), true);
  assert.deepEqual(
    evaluateCompanyPermission({
      companySlug: "acme",
      profile,
      permission: "agent:run",
      actor: "user@test"
    }),
    { allowed: true }
  );
});

test("rbac blocks access outside the allowed tenant scope", () => {
  const profile = buildProfile({
    tenantScope: "restricted",
    allowedCompanySlugs: ["lion-a"]
  });

  assert.equal(hasCompanyAccess(profile, "lion-b"), false);
  assert.deepEqual(
    evaluateCompanyPermission({
      companySlug: "lion-b",
      profile,
      permission: "agent:run",
      actor: "user@test"
    }),
    {
      allowed: false,
      reason: "tenant_scope_blocked",
      message: "Acesso negado para a empresa lion-b."
    }
  );
});

test("rbac blocks access when permission is missing even inside tenant scope", () => {
  const profile = buildProfile({
    tenantScope: "restricted",
    allowedCompanySlugs: ["lion-a"],
    permissions: ["agent:decide"]
  });

  assert.deepEqual(
    evaluateCompanyPermission({
      companySlug: "lion-a",
      profile,
      permission: "agent:run",
      actor: "user@test"
    }),
    {
      allowed: false,
      reason: "missing_permission",
      message: "Permissao insuficiente para agent:run."
    }
  );
});
