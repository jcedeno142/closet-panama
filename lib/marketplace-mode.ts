// Keep managed checkout code available for a future payment-provider integration.
export const managedPaymentsEnabled = false;

export function directSalesOnlyResponse() {
  return Response.json({ error: "Los pagos y las entregas se acuerdan directamente entre comprador y vendedor por mensaje." }, { status: 409 });
}
