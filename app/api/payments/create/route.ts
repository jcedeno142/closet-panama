import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const PLATFORM_FEE_PERCENT = 10;

export async function POST(request: Request) {
  try {
    // Normal authenticated client
    const supabase = await createClient();

    // Server-only admin client
    const admin = createAdminClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "No autorizado." }, { status: 401 });
    }

    const body = await request.json();

    const { orderId, paymentMethod } = body;

    if (!orderId) {
      return NextResponse.json({ error: "Falta el pedido." }, { status: 400 });
    }

    if (paymentMethod !== "yappy" && paymentMethod !== "card") {
      return NextResponse.json(
        { error: "Método de pago inválido." },
        { status: 400 },
      );
    }

    // Normal client is used here because we WANT RLS/auth
    // to verify this buyer owns this order.
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .select(
        `
          id,
          buyer_id,
          seller_id,
          product_id,
          amount,
          status
        `,
      )
      .eq("id", orderId)
      .eq("buyer_id", user.id)
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

    if (order.status !== "pending_payment") {
      return NextResponse.json(
        {
          error: "Este pedido ya no está pendiente de pago.",
        },
        { status: 400 },
      );
    }

    /*
     * Verify that the listing is still available.
     * This check is server-side so it cannot be bypassed
     * by manually calling the payment endpoint.
     */
    const { data: product, error: productError } = await admin
      .from("products")
      .select("id, seller_id, status")
      .eq("id", order.product_id)
      .maybeSingle();

    if (productError) {
      console.error("Product availability lookup error:", productError);

      return NextResponse.json(
        { error: "No pudimos verificar la disponibilidad del artículo." },
        { status: 500 },
      );
    }

    if (!product) {
      return NextResponse.json(
        { error: "El artículo ya no está disponible." },
        { status: 404 },
      );
    }

    if (product.seller_id !== order.seller_id) {
      return NextResponse.json(
        { error: "El artículo no corresponde a este pedido." },
        { status: 400 },
      );
    }

    if (product.status !== "active") {
      return NextResponse.json(
        {
          error:
            "Este artículo ya fue vendido y no está disponible para compra.",
        },
        { status: 409 },
      );
    }

    const amount = Number(order.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ error: "Monto inválido." }, { status: 400 });
    }

    const platformFee =
      Math.round(amount * (PLATFORM_FEE_PERCENT / 100) * 100) / 100;

    const sellerAmount = Math.round((amount - platformFee) * 100) / 100;

    const provider = paymentMethod === "card" ? "tilopay" : "yappy";

    /*
     * IMPORTANT:
     * From this point on, PAYMENTS uses ADMIN.
     */

    const { data: existingPayments, error: existingError } = await admin
      .from("payments")
      .select("*")
      .eq("order_id", order.id)
      .eq("provider", provider)
      .in("status", ["pending", "processing"])
      .limit(1);

    if (existingError) {
      console.error("Existing payment lookup error:", existingError);

      return NextResponse.json(
        { error: "No pudimos verificar el pago." },
        { status: 500 },
      );
    }

    const existingPayment = existingPayments?.[0] ?? null;

    if (existingPayment) {
      return NextResponse.json({
        success: true,
        existing: true,
        payment: existingPayment,
      });
    }

    // ADMIN CLIENT — not the browser/authenticated client
    const { data: payment, error: paymentError } = await admin
      .from("payments")
      .insert({
        order_id: order.id,
        buyer_id: order.buyer_id,
        seller_id: order.seller_id,
        provider,
        amount,
        platform_fee: platformFee,
        seller_amount: sellerAmount,
        status: "pending",
      })
      .select()
      .single();

    if (paymentError) {
      console.error("Payment creation error:", paymentError);

      return NextResponse.json(
        {
          error: "No pudimos crear el pago.",
          code: paymentError.code,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      existing: false,
      payment: {
        id: payment.id,
        orderId: order.id,
        provider,
        amount,
        platformFee,
        sellerAmount,
        status: payment.status,
      },
    });
  } catch (error) {
    console.error("Create payment error:", error);

    return NextResponse.json(
      { error: "Error interno del servidor." },
      { status: 500 },
    );
  }
}
