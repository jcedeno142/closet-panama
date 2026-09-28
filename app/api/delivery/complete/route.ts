import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // ---------------------------------------------------------
    // 1. Authenticate the current user.
    // ---------------------------------------------------------
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

    // ---------------------------------------------------------
    // 2. Validate request.
    // ---------------------------------------------------------
    const body = await request.json();

    const orderId =
      typeof body?.orderId === "string"
        ? body.orderId.trim()
        : "";

    const code =
      typeof body?.code === "string"
        ? body.code.trim()
        : "";

    if (!orderId) {
      return NextResponse.json(
        { error: "Falta el ID de la orden." },
        { status: 400 },
      );
    }

    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json(
        {
          error:
            "El código debe contener exactamente 6 números.",
        },
        { status: 400 },
      );
    }

    const admin = createAdminClient();

    // ---------------------------------------------------------
    // 3. Load the order.
    // ---------------------------------------------------------
    const { data: order, error: orderError } = await admin
      .from("orders")
      .select(
        `
          id,
          status,
          fulfillment_method
        `,
      )
      .eq("id", orderId)
      .maybeSingle();

    if (orderError) {
      console.error(
        "Delivery completion order lookup error:",
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

    if (order.fulfillment_method !== "local_delivery") {
      return NextResponse.json(
        {
          error:
            "Esta orden no utiliza entrega local.",
        },
        { status: 400 },
      );
    }

    // ---------------------------------------------------------
    // 4. Verify this account is an approved driver.
    // ---------------------------------------------------------
    const { data: driver, error: driverError } = await admin
      .from("profiles")
      .select("id, is_driver")
      .eq("id", user.id)
      .maybeSingle();

    if (driverError) {
      console.error(
        "Driver profile lookup error:",
        driverError,
      );

      return NextResponse.json(
        {
          error:
            "No pudimos verificar la cuenta del conductor.",
        },
        { status: 500 },
      );
    }

    if (!driver?.is_driver) {
      return NextResponse.json(
        {
          error:
            "Esta cuenta no está autorizada como conductor.",
        },
        { status: 403 },
      );
    }

    // ---------------------------------------------------------
    // 5. Verify this exact driver is assigned to the order.
    // ---------------------------------------------------------
    const {
      data: assignment,
      error: assignmentError,
    } = await admin
      .from("order_delivery_assignments")
      .select(
        `
          id,
          order_id,
          driver_id,
          status
        `,
      )
      .eq("order_id", order.id)
      .maybeSingle();

    if (assignmentError) {
      console.error(
        "Delivery assignment lookup error:",
        assignmentError,
      );

      return NextResponse.json(
        {
          error:
            "No pudimos verificar la asignación de entrega.",
        },
        { status: 500 },
      );
    }

    if (!assignment) {
      return NextResponse.json(
        {
          error:
            "Esta orden no tiene un conductor asignado.",
        },
        { status: 403 },
      );
    }

    if (assignment.driver_id !== user.id) {
      return NextResponse.json(
        {
          error:
            "No eres el conductor asignado a esta orden.",
        },
        { status: 403 },
      );
    }

    /*
     * Normal first completion:
     *
     * assignment = picked_up
     * order      = out_for_delivery
     *
     * We also permit completed/completed so an idempotent
     * replay can safely reach the PostgreSQL RPC.
     */
    const normalCompletion =
      assignment.status === "picked_up" &&
      order.status === "out_for_delivery";

    const idempotentReplay =
      assignment.status === "completed" &&
      order.status === "completed";

    if (!normalCompletion && !idempotentReplay) {
      return NextResponse.json(
        {
          error:
            "Esta entrega no está lista para ser completada.",
        },
        { status: 409 },
      );
    }

    // ---------------------------------------------------------
    // 6. Execute the atomic financial completion RPC.
    // ---------------------------------------------------------
    const { data: result, error: rpcError } =
      await admin.rpc("complete_local_delivery", {
        p_order_id: order.id,
        p_code: code,
      });

    if (rpcError) {
      console.error(
        "Complete local delivery RPC error:",
        rpcError,
      );

      if (
        rpcError.message?.includes("TOO_MANY_ATTEMPTS")
      ) {
        return NextResponse.json(
          {
            error:
              "Se alcanzó el límite de intentos para este código.",
          },
          { status: 429 },
        );
      }

      if (
        rpcError.message?.includes(
          "INSUFFICIENT_PENDING_BALANCE",
        )
      ) {
        return NextResponse.json(
          {
            error:
              "No pudimos completar la liquidación de esta orden.",
          },
          { status: 409 },
        );
      }

      return NextResponse.json(
        {
          error:
            "No pudimos confirmar la entrega.",
        },
        { status: 400 },
      );
    }

    // ---------------------------------------------------------
    // 7. Wrong buyer delivery code.
    // ---------------------------------------------------------
    if (!result?.success) {
      return NextResponse.json(
        {
          success: false,
          invalidCode: true,
          attemptsRemaining:
            result?.attempts_remaining ?? 0,
          error: "Código incorrecto.",
        },
        { status: 400 },
      );
    }

    // ---------------------------------------------------------
    // 8. Synchronize delivery assignment.
    //
    // The financial/order transaction has already completed
    // atomically inside PostgreSQL.
    // ---------------------------------------------------------
    if (!result.already_completed) {
      const now = new Date().toISOString();

      const { error: updateError } = await admin
        .from("order_delivery_assignments")
        .update({
          status: "completed",
          completed_at: now,
          updated_at: now,
        })
        .eq("id", assignment.id)
        .eq("driver_id", user.id);

      if (updateError) {
        console.error(
          "Delivery assignment completion sync error:",
          updateError,
        );

        /*
         * Never report the financial transaction as failed
         * after complete_local_delivery() has succeeded.
         */
        return NextResponse.json({
          success: true,
          orderId: order.id,
          status: "completed",
          alreadyCompleted: false,
          alreadyReleased:
            result.already_released ?? false,
          assignmentSyncPending: true,
        });
      }
    }

    // ---------------------------------------------------------
    // 9. Return only safe information.
    //
    // Seller balance amounts are intentionally not exposed
    // through this driver-facing endpoint.
    // ---------------------------------------------------------
    return NextResponse.json({
      success: true,
      orderId: order.id,
      status: "completed",
      alreadyCompleted:
        result.already_completed ?? false,
      alreadyReleased:
        result.already_released ?? false,
    });
  } catch (error) {
    console.error(
      "Complete delivery API unexpected error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Ocurrió un error inesperado al confirmar la entrega.",
      },
      { status: 500 },
    );
  }
}