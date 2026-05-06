import assert from "node:assert/strict";
import test from "node:test";
import {
  getStoredCompanyDataOpsProfileFromCollection,
  listStoredCompanyCodeWorkspaces,
  upsertStoredCompanyCodeWorkspaceInCollection,
  upsertStoredCompanyDataOpsProfileInCollection,
  upsertStoredUserProfessionalProfileInCollection
} from "@/infrastructure/persistence/company-profile-storage";
import type {
  CompanyCodeWorkspace,
  CompanyDataOpsProfile,
  UserProfessionalProfile
} from "@/lib/domain";

test("company profile storage replaces user profiles by stable user key", () => {
  const first = { userKey: "user-1", displayName: "Old" } as UserProfessionalProfile;
  const replacement = { userKey: "user-1", displayName: "New" } as UserProfessionalProfile;
  const other = { userKey: "user-2", displayName: "Other" } as UserProfessionalProfile;

  const profiles = upsertStoredUserProfessionalProfileInCollection(
    [first, other],
    replacement
  );

  assert.equal(profiles.length, 2);
  assert.equal(profiles.find((profile) => profile.userKey === "user-1")?.displayName, "New");
});

test("company profile storage scopes code workspaces by company", () => {
  const workspaces = [
    { id: "repo-1", companySlug: "acme" },
    { id: "repo-2", companySlug: "lion" }
  ] as CompanyCodeWorkspace[];

  assert.deepEqual(
    listStoredCompanyCodeWorkspaces(workspaces, "acme").map((workspace) => workspace.id),
    ["repo-1"]
  );

  const next = upsertStoredCompanyCodeWorkspaceInCollection(workspaces, {
    id: "repo-1",
    companySlug: "acme",
    label: "replaced",
    path: "/repo",
    stack: "next",
    objective: "test",
    status: "connected",
    access: "read",
    notes: ""
  });

  assert.equal(next.length, 2);
  assert.equal(next.find((workspace) => workspace.id === "repo-1")?.label, "replaced");
});

test("company profile storage upserts data ops profiles by tenant", () => {
  const profiles = [
    { companySlug: "acme", status: "seeded" },
    { companySlug: "lion", status: "customized" }
  ] as CompanyDataOpsProfile[];
  const next = upsertStoredCompanyDataOpsProfileInCollection(profiles, {
    companySlug: "acme",
    status: "customized"
  } as CompanyDataOpsProfile);

  assert.equal(getStoredCompanyDataOpsProfileFromCollection(next, "acme")?.status, "customized");
  assert.equal(next.length, 2);
});
