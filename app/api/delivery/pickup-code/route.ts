import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    /*
     * 1. Authenticate the current user.
     */
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "No autorizado." },
        { status: 401 },
      );
    }

    /*
     * 2. Read the order ID.
     */
    const body = await request.json();
    const orderId =
      typeof body?.orderId === "string"
        ? body.orderId.trim()
        : "";

    if (!orderId) {
      return NextResponse.json(
        { error: "Falta el ID de la orden." },
        { status: 400 },
      );
    }

    const admin = createAdminClient();

    /*
     * 3. Load the order using the server-only admin client.
     */
    const { data: order, error: orderError } = await admin
      .from("orders")
      .select(
        `
          id,
          seller_id,
          buyer_id,
          status,
          fulfillment_method,
          paid_at
        `,
      )
      .eq("id", orderId)
      .maybeSingle();

    if (orderError) {
      console.error(
        "Pickup code order lookup error:",
        orderError,
      );

      return NextResponse.json(
        { error: "No pudimos cargar la orden." },
        { status: 500 },
      );
    }

    if (!order) {
      return NextResponse.json(
        { error: "Orden no encontrada." },
        { status: 404 },
      );
    }

    /*
     * 4. Only the seller can generate the pickup code.
     */
    if (order.seller_id !== user.id) {
      return NextResponse.json(
        { error: "No tienes permiso para esta orden." },
        { status: 403 },
      );
    }

    /*
     * 5. This workflow only applies to local delivery.
     */
    if (order.fulfillment_method !== "local_delivery") {
      return NextResponse.json(
        {
          error:
            "Esta orden no utiliza entrega local.",
        },
        { status: 400 },
      );
    }

    /*
     * 6. A real payment must already have been completed.
     *
     * The first generation happens while status = paid.
     * Regeneration is allowed while ready_for_pickup.
     *
     * generate_pickup_code() will replace the previous hash,
     * so an older pickup code becomes invalid automatically.
     */
    if (
      order.status !== "paid" &&
      order.status !== "ready_for_pickup"
    ) {
      return NextResponse.json(
        {
          error:
            "La orden no está disponible para generar el código de recogida.",
        },
        { status: 409 },
      );
    }

    if (!order.paid_at) {
      return NextResponse.json(
        {
          error:
            "La orden todavía no tiene un pago confirmado.",
        },
        { status: 409 },
      );
    }

    /*
     * 7. Call the service-role-only database function.
     *
     * The plaintext six-digit code exists only in this
     * response. The database stores only its bcrypt hash.
     */
    const { data: pickupCode, error: rpcError } =
      await admin.rpc("generate_pickup_code", {
        p_order_id: order.id,
      });

    if (rpcError) {
      console.error(
        "Generate pickup code RPC error:",
        rpcError,
      );

      return NextResponse.json(
        {
          error:
            "No pudimos generar el código de recogida.",
        },
        { status: 500 },
      );
    }

    if (
      typeof pickupCode !== "string" ||
      !/^\d{6}$/.test(pickupCode)
    ) {
      console.error(
        "Invalid pickup code returned by RPC.",
      );

      return NextResponse.json(
        {
          error:
            "El servidor generó una respuesta inválida.",
        },
        { status: 500 },
      );
    }

    /*
     * 8. Return the code only to the authenticated seller.
     */
    return NextResponse.json({
      success: true,
      orderId: order.id,
      status: "ready_for_pickup",
      pickupCode,
    });
  } catch (error) {
    console.error(
      "Pickup code API unexpected error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Ocurrió un error inesperado al generar el código.",
      },
      { status: 500 },
    );
  }
}