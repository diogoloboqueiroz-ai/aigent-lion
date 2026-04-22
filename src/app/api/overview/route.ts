import { NextResponse } from "next/server";
import { blueprint } from "@/lib/blueprint";
import {
  getAuditFeed,
  getCompanyWorkspaces,
  getConnectorOverview,
  getControlTowerSummary,
  getSnapshotFeed
} from "@/lib/connectors";
import { isVaultConfigured } from "@/lib/company-vault";
import { hasGoogleOAuthConfigured } from "@/lib/google-auth";

export async function GET() {
  return NextResponse.json(
    {
      generatedAt: new Date().toISOString(),
      automationMode: blueprint.automationMode,
      googleLoginEnabled: hasGoogleOAuthConfigured(),
      vaultReady: isVaultConfigured(),
      controlTower: getControlTowerSummary(),
      connectors: getConnectorOverview(),
      companies: getCompanyWorkspaces(),
      snapshots: getSnapshotFeed(),
      audit: getAuditFeed()
    },
    {
      headers: {
        "Cache-Control": "no-store"
      }
    }
  );
}
