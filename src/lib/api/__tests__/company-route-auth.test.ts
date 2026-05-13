import assert from "node:assert/strict";
import test from "node:test";
import { requireResolvedCompanyRoutePermission } from "@/lib/api/company-route-auth";
import type { CompanyWorkspace, UserProfessionalProfile } from "@/lib/domain";

function buildWorkspace(): CompanyWorkspace {
  return {
    company: {
      slug: "secure-tenant"
    }
  } as CompanyWorkspace;
}

function buildProfile(permissions: UserProfessionalProfile["permissions"]): UserProfessionalProfile {
  return {
    role: "strategist",
    permissions,
    tenantScope: "all",
    allowedCompanySlugs: []
  } as unknown as UserProfessionalProfile;
}

test("company route auth allows a resolved workspace when permission is present", () => {
  const response = requireResolvedCompanyRoutePermission({
    workspace: buildWorkspace(),
    profile: buildProfile(["agent:decide"]),
    session: { email: "operator@example.com" },
    permission: "agent:decide"
  });

  assert.equal(response, null);
});

test("company route auth blocks a resolved workspace when permission is missing", async () => {
  const response = requireResolvedCompanyRoutePermission({
    workspace: buildWorkspace(),
    profile: buildProfile(["agent:decide"]),
    session: { email: "operator@example.com" },
    permission: "payments:approve"
  });

  assert.ok(response);
  assert.equal(response.status, 403);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.match(JSON.stringify(await response.json()), /payments:approve/);
});
