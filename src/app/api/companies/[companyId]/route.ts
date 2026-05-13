import { companyRouteJson, requireCompanyRouteAccess } from "@/lib/api/company-route-auth";

export async function GET(
  _request: Request,
  context: { params: Promise<{ companyId: string }> }
) {
  const { companyId } = await context.params;
  const access = await requireCompanyRouteAccess({
    companyId,
    permission: "agent:decide"
  });

  if (!access.ok) {
    return access.response;
  }

  return companyRouteJson(access.workspace);
}
