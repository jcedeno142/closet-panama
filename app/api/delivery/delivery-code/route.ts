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
     * 3. Load the order.
     */
    const { data: order, error: orderError } = await admin
      .from("orders")
      .select(
        `
          id,
          buyer_id,
          seller_id,
          status,
          fulfillment_method,
          paid_at
        `,
      )
      .eq("id", orderId)
      .maybeSingle();

    if (orderError) {
      console.error(
        "Delivery code order lookup error:",
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
     * 4. Only the buyer can generate the delivery code.
     */
    if (order.buyer_id !== user.id) {
      return NextResponse.json(
        {
          error:
            "No tienes permiso para generar el código de esta orden.",
        },
        { status: 403 },
      );
    }

    /*
     * 5. Only local-delivery orders use this workflow.
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
     * The driver must already have possession of the item.
     *
     * Regeneration is allowed while out_for_delivery.
     * Generating a new code replaces the previous hash,
     * immediately invalidating the old code.
     */
    if (
      order.status !== "picked_up" &&
      order.status !== "out_for_delivery"
    ) {
      return NextResponse.json(
        {
          error:
            "El pedido todavía no está en camino.",
        },
        { status: 409 },
      );
    }

    /*
     * 6. Generate the buyer's private six-digit code.
     *
     * The plaintext code is returned once to the buyer.
     * Only its bcrypt hash remains in the database.
     */
    const { data: deliveryCode, error: rpcError } =
      await admin.rpc("generate_delivery_code", {
        p_order_id: order.id,
      });

    if (rpcError) {
      console.error(
        "Generate delivery code RPC error:",
        rpcError,
      );

      return NextResponse.json(
        {
          error:
            "No pudimos generar el código de entrega.",
        },
        { status: 500 },
      );
    }

    if (
      typeof deliveryCode !== "string" ||
      !/^\d{6}$/.test(deliveryCode)
    ) {
      console.error(
        "Invalid delivery code returned by RPC.",
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
     * 7. Return plaintext only to the authenticated buyer.
     */
    return NextResponse.json({
      success: true,
      orderId: order.id,
      status: "out_for_delivery",
      deliveryCode,
    });
  } catch (error) {
    console.error(
      "Delivery code API unexpected error:",
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