import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supabase = await createClient();

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

    const admin = createAdminClient();

    // Verify that the logged-in user is an approved driver.
    const { data: driverProfile, error: driverError } =
      await admin
        .from("profiles")
        .select(`
          id,
          username,
          display_name,
          is_driver
        `)
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
            "No pudimos verificar tu cuenta de conductor.",
        },
        { status: 500 },
      );
    }

    if (!driverProfile?.is_driver) {
      return NextResponse.json(
        {
          error:
            "Esta cuenta no está autorizada como conductor.",
        },
        { status: 403 },
      );
    }

    // Load only assignments belonging to this driver.
    const {
      data: assignments,
      error: assignmentsError,
    } = await admin
      .from("order_delivery_assignments")
      .select(`
        id,
        order_id,
        driver_id,
        status,
        assigned_at,
        picked_up_at,
        completed_at
      `)
      .eq("driver_id", user.id)
      .in("status", [
        "assigned",
        "picked_up",
        "completed",
      ])
      .order("assigned_at", {
        ascending: false,
      });

    if (assignmentsError) {
      console.error(
        "Driver assignments lookup error:",
        assignmentsError,
      );

      return NextResponse.json(
        {
          error:
            "No pudimos cargar tus entregas.",
        },
        { status: 500 },
      );
    }

    const deliveries = await Promise.all(
      (assignments || []).map(
        async (assignment) => {
          const { data: order, error: orderError } =
            await admin
              .from("orders")
              .select(`
                id,
                product_id,
                buyer_id,
                seller_id,
                amount,
                status,
                fulfillment_method,
                created_at
              `)
              .eq("id", assignment.order_id)
              .maybeSingle();

          if (orderError || !order) {
            console.error(
              "Assigned order lookup error:",
              orderError,
            );

            return null;
          }

          // Defensive check:
          // driver assignments should only represent local delivery.
          if (
            order.fulfillment_method !==
            "local_delivery"
          ) {
            return null;
          }

          const [
            productResult,
            sellerResult,
            buyerResult,
          ] = await Promise.all([
            admin
              .from("products")
              .select(`
                id,
                title,
                product_images (
                  image_url,
                  position
                )
              `)
              .eq("id", order.product_id)
              .maybeSingle(),

            admin
              .from("profiles")
              .select(`
                id,
                username,
                display_name
              `)
              .eq("id", order.seller_id)
              .maybeSingle(),

            admin
              .from("profiles")
              .select(`
                id,
                username,
                display_name
              `)
              .eq("id", order.buyer_id)
              .maybeSingle(),
          ]);

          const product =
            productResult.data;

          const images = [
            ...(product?.product_images || []),
          ].sort(
            (a, b) =>
              Number(a.position) -
              Number(b.position),
          );

          return {
            assignment: {
              id: assignment.id,
              status: assignment.status,
              assignedAt:
                assignment.assigned_at,
              pickedUpAt:
                assignment.picked_up_at,
              completedAt:
                assignment.completed_at,
            },

            order: {
              id: order.id,
              amount: order.amount,
              status: order.status,
              createdAt: order.created_at,
            },

            product: product
              ? {
                  id: product.id,
                  title: product.title,
                  image:
                    images[0]?.image_url ||
                    null,
                }
              : null,

            seller: sellerResult.data
              ? {
                  id: sellerResult.data.id,
                  username:
                    sellerResult.data
                      .username,
                  displayName:
                    sellerResult.data
                      .display_name,
                }
              : null,

            buyer: buyerResult.data
              ? {
                  id: buyerResult.data.id,
                  username:
                    buyerResult.data
                      .username,
                  displayName:
                    buyerResult.data
                      .display_name,
                }
              : null,
          };
        },
      ),
    );

    return NextResponse.json({
      success: true,

      driver: {
        id: driverProfile.id,
        username:
          driverProfile.username,
        displayName:
          driverProfile.display_name,
      },

      deliveries: deliveries.filter(
        (
          delivery,
        ): delivery is NonNullable<
          typeof delivery
        > => delivery !== null,
      ),
    });
  } catch (error) {
    console.error(
      "My deliveries API unexpected error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Ocurrió un error al cargar tus entregas.",
      },
      { status: 500 },
    );
  }
}