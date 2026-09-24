import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const admin = createAdminClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    const body = await request.json();
    const { orderId, action } = body;

    if (!orderId) {
      return NextResponse.json({ error: "Falta el pedido." }, { status: 400 });
    }

    if (action !== "ship" && action !== "ready_for_pickup") {
      return NextResponse.json({ error: "Acción inválida." }, { status: 400 });
    }

    // Verify this order belongs to the logged-in seller
    const { data: order, error: orderError } = await admin
      .from("orders")
      .select(
        `
        id,
        seller_id,
        buyer_id,
        status,
        fulfillment_method
      `,
      )
      .eq("id", orderId)
      .maybeSingle();

    if (orderError) {
      console.error("Order lookup error:", orderError);

      return NextResponse.json(
        { error: "No pudimos verificar el pedido." },
        { status: 500 },
      );
    }

    if (!order) {
      return NextResponse.json(
        { error: "Pedido no encontrado." },
        { status: 404 },
      );
    }

    if (order.seller_id !== user.id) {
      return NextResponse.json(
        { error: "No tienes permiso para modificar este pedido." },
        { status: 403 },
      );
    }

    if (order.status !== "paid") {
      return NextResponse.json(
        {
          error: "Este pedido ya no está esperando preparación.",
        },
        { status: 400 },
      );
    }

    let newStatus: "shipped" | "ready_for_pickup";

    if (action === "ready_for_pickup") {
      if (order.fulfillment_method !== "pickup") {
        return NextResponse.json(
          {
            error: "Este pedido no fue seleccionado para retiro.",
          },
          { status: 400 },
        );
      }

      newStatus = "ready_for_pickup";
    } else {
      if (order.fulfillment_method === "pickup") {
        return NextResponse.json(
          {
            error:
              "Los pedidos para retiro deben marcarse como listos para retirar.",
          },
          { status: 400 },
        );
      }

      newStatus = "shipped";
    }

    const now = new Date().toISOString();

    const { data: updatedOrder, error: updateError } = await admin
      .from("orders")
      .update({
        status: newStatus,
        updated_at: now,
      })
      .eq("id", order.id)
      .eq("status", "paid")
      .select()
      .single();

    if (updateError) {
      console.error("Seller order update error:", updateError);

      return NextResponse.json(
        { error: "No pudimos actualizar el pedido." },
        { status: 500 },
      );
    }

    // Get product information for the notification
    const { data: orderDetails, error: detailsError } = await admin
      .from("orders")
      .select("product_id")
      .eq("id", order.id)
      .maybeSingle();

    if (detailsError) {
      console.error("Order notification details error:", detailsError);
    }

    let productTitle = "tu pedido";
    let productId: string | null = null;

    if (orderDetails?.product_id) {
      productId = orderDetails.product_id;

      const { data: product, error: productError } = await admin
        .from("products")
        .select("title")
        .eq("id", productId)
        .maybeSingle();

      if (productError) {
        console.error("Notification product lookup error:", productError);
      }

      if (product?.title) {
        productTitle = product.title;
      }
    }

    // Build notification depending on fulfillment method
    const notificationTitle =
      newStatus === "ready_for_pickup"
        ? "¡Tu pedido está listo!"
        : "Tu pedido fue enviado 📦";

    const notificationMessage =
      newStatus === "ready_for_pickup"
        ? `${productTitle} está listo para retirar.`
        : `${productTitle} está en camino.`;

    // Notify the buyer
    const { error: notificationError } = await admin
      .from("notifications")
      .insert({
        user_id: order.buyer_id,
        actor_id: order.seller_id,
        type:
          newStatus === "ready_for_pickup"
            ? "ready_for_pickup"
            : "order_shipped",
        title: notificationTitle,
        message: notificationMessage,
        link: "/orders",
        product_id: productId,
      });

    if (notificationError) {
      /*
       * The order status was already updated successfully,
       * so a notification failure must not make the order
       * operation appear to have failed.
       */
      console.error("Order status notification error:", notificationError);
    }

    return NextResponse.json({
      success: true,
      order: updatedOrder,
    });
  } catch (error) {
    console.error("Seller status error:", error);

    return NextResponse.json(
      { error: "Error interno del servidor." },
      { status: 500 },
    );
  }
}
