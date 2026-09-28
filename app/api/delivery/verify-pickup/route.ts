import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();

    // Authenticate the driver.
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

    // Load the order.
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
        "Pickup verification order lookup error:",
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

    /*
     * Verify that the logged-in account is an approved driver.
     */
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

    /*
     * Verify that this exact driver is assigned to this order.
     */
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
        "Pickup assignment lookup error:",
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

    if (assignment.status !== "assigned") {
      /*
       * If the order already passed pickup, let the database
       * function handle its idempotent replay behavior.
       */
      if (
        assignment.status !== "picked_up" &&
        assignment.status !== "completed"
      ) {
        return NextResponse.json(
          {
            error:
              "Esta asignación no está disponible para recogida.",
          },
          { status: 409 },
        );
      }
    }

    if (
      order.status !== "ready_for_pickup" &&
      order.status !== "picked_up" &&
      order.status !== "out_for_delivery" &&
      order.status !== "completed"
    ) {
      return NextResponse.json(
        {
          error:
            "Esta orden no está lista para ser recogida.",
        },
        { status: 409 },
      );
    }

    /*
     * Verify the seller's pickup code.
     */
    const { data: result, error: rpcError } =
      await admin.rpc("verify_pickup_code", {
        p_order_id: order.id,
        p_code: code,
      });

    if (rpcError) {
      console.error(
        "Verify pickup code RPC error:",
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

      return NextResponse.json(
        {
          error:
            "No pudimos verificar el código de recogida.",
        },
        { status: 400 },
      );
    }

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

    /*
     * Keep the assignment synchronized with the order.
     *
     * Don't rewrite timestamps during an idempotent replay.
     */
    if (!result.already_picked_up) {
      const { error: updateError } = await admin
        .from("order_delivery_assignments")
        .update({
          status: "picked_up",
          picked_up_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", assignment.id)
        .eq("driver_id", user.id);

      if (updateError) {
        console.error(
          "Pickup assignment update error:",
          updateError,
        );

        /*
         * The order itself has already been changed by the
         * database RPC, so don't pretend the pickup failed.
         */
        return NextResponse.json(
          {
            success: true,
            orderId: order.id,
            status: result.status,
            alreadyPickedUp: false,
            assignmentSyncPending: true,
          },
          { status: 200 },
        );
      }
    }

    return NextResponse.json({
      success: true,
      orderId: order.id,
      status: result.status,
      alreadyPickedUp:
        result.already_picked_up ?? false,
    });
  } catch (error) {
    console.error(
      "Verify pickup API unexpected error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Ocurrió un error inesperado al verificar el código.",
      },
      { status: 500 },
    );
  }
}