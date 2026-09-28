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
    // 2. Validate request body.
    // ---------------------------------------------------------
    const body = await request.json();

    const orderId =
      typeof body?.orderId === "string"
        ? body.orderId.trim()
        : "";

    const driverId =
      typeof body?.driverId === "string"
        ? body.driverId.trim()
        : "";

    if (!orderId || !driverId) {
      return NextResponse.json(
        {
          error:
            "Falta el ID de la orden o del conductor.",
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
        "Driver assignment order lookup error:",
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

    // ---------------------------------------------------------
    // 4. Only the seller can assign the driver.
    // ---------------------------------------------------------
    if (order.seller_id !== user.id) {
      return NextResponse.json(
        {
          error:
            "No tienes permiso para asignar esta entrega.",
        },
        { status: 403 },
      );
    }

    // ---------------------------------------------------------
    // 5. Driver assignment only applies to local delivery.
    // ---------------------------------------------------------
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
    // 6. Require a real paid order.
    // ---------------------------------------------------------
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
     * A driver may be assigned before or after the seller
     * generates the pickup code.
     *
     * Once pickup occurs, we don't allow changing drivers
     * through this endpoint.
     */
    if (
      order.status !== "paid" &&
      order.status !== "ready_for_pickup"
    ) {
      return NextResponse.json(
        {
          error:
            "Ya no se puede cambiar el conductor de esta orden.",
        },
        { status: 409 },
      );
    }

    // ---------------------------------------------------------
    // 7. Verify the selected profile is an approved driver.
    // ---------------------------------------------------------
    const { data: driver, error: driverError } = await admin
      .from("profiles")
      .select(
        `
          id,
          username,
          display_name,
          is_driver
        `,
      )
      .eq("id", driverId)
      .maybeSingle();

    if (driverError) {
      console.error(
        "Driver profile lookup error:",
        driverError,
      );

      return NextResponse.json(
        {
          error:
            "No pudimos verificar el conductor.",
        },
        { status: 500 },
      );
    }

    if (!driver || !driver.is_driver) {
      return NextResponse.json(
        {
          error:
            "La cuenta seleccionada no es un conductor autorizado.",
        },
        { status: 400 },
      );
    }

    // Buyer or seller should never be their own driver.
    if (
      driver.id === order.seller_id ||
      driver.id === order.buyer_id
    ) {
      return NextResponse.json(
        {
          error:
            "El comprador o vendedor no puede ser asignado como conductor de esta orden.",
        },
        { status: 400 },
      );
    }

    // ---------------------------------------------------------
    // 8. Create or replace the assignment.
    //
    // order_id has a UNIQUE constraint, so upsert guarantees
    // one current assignment per order.
    // ---------------------------------------------------------
    const { data: assignment, error: assignmentError } =
      await admin
        .from("order_delivery_assignments")
        .upsert(
          {
            order_id: order.id,
            driver_id: driver.id,
            status: "assigned",
            assigned_at: new Date().toISOString(),
            picked_up_at: null,
            completed_at: null,
            cancelled_at: null,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "order_id",
          },
        )
        .select(
          `
            id,
            order_id,
            driver_id,
            status,
            assigned_at
          `,
        )
        .single();

    if (assignmentError) {
      console.error(
        "Driver assignment error:",
        assignmentError,
      );

      return NextResponse.json(
        {
          error:
            "No pudimos asignar el conductor.",
        },
        { status: 500 },
      );
    }

    // ---------------------------------------------------------
    // 9. Return safe assignment information.
    // ---------------------------------------------------------
    return NextResponse.json({
      success: true,

      assignment: {
        id: assignment.id,
        orderId: assignment.order_id,
        driverId: assignment.driver_id,
        status: assignment.status,
        assignedAt: assignment.assigned_at,
      },

      driver: {
        id: driver.id,
        username: driver.username,
        displayName: driver.display_name,
      },
    });
  } catch (error) {
    console.error(
      "Assign driver API unexpected error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Ocurrió un error inesperado al asignar el conductor.",
      },
      { status: 500 },
    );
  }
}