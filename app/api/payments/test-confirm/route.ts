import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    // NEVER allow simulated payments in production
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Test payments are disabled." },
        { status: 403 },
      );
    }

    const supabase = await createClient();
    const admin = createAdminClient();

    // Verify logged-in buyer
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
    const { paymentId } = body;

    if (!paymentId || typeof paymentId !== "string") {
      return NextResponse.json(
        { error: "Falta el pago." },
        { status: 400 },
      );
    }

    /*
     * Finalize the entire financial transaction inside PostgreSQL.
     *
     * The RPC atomically:
     * - locks the payment
     * - locks the order
     * - locks the product
     * - marks payment paid
     * - marks order paid
     * - marks product sold
     * - credits seller pending balance
     *
     * If any step fails, PostgreSQL rolls everything back.
     */
    const { data: result, error: finalizeError } = await admin.rpc(
      "finalize_marketplace_payment",
      {
        p_payment_id: paymentId,
        p_buyer_id: user.id,
      },
    );

    if (finalizeError) {
      console.error(
        "Finalize marketplace payment error:",
        finalizeError,
      );

      const message = finalizeError.message || "";

      if (message.includes("PAYMENT_NOT_FOUND")) {
        return NextResponse.json(
          { error: "Pago no encontrado." },
          { status: 404 },
        );
      }

      if (message.includes("PAYMENT_NOT_OWNED")) {
        return NextResponse.json(
          { error: "No autorizado." },
          { status: 403 },
        );
      }

      if (message.includes("PAYMENT_NOT_PENDING")) {
        return NextResponse.json(
          { error: "Este pago no puede ser confirmado." },
          { status: 409 },
        );
      }

      if (message.includes("ORDER_NOT_FOUND")) {
        return NextResponse.json(
          { error: "Pedido no encontrado." },
          { status: 404 },
        );
      }

      if (message.includes("ORDER_NOT_PENDING")) {
        return NextResponse.json(
          {
            error:
              "Este pedido ya no está disponible para pago.",
          },
          { status: 409 },
        );
      }

      if (
        message.includes("PRODUCT_NOT_FOUND") ||
        message.includes("PRODUCT_NOT_AVAILABLE")
      ) {
        return NextResponse.json(
          {
            error:
              "Este artículo ya fue vendido o no está disponible.",
          },
          { status: 409 },
        );
      }

      if (
        message.includes("ORDER_PAYMENT_MISMATCH") ||
        message.includes("PRODUCT_SELLER_MISMATCH") ||
        message.includes("PAYMENT_AMOUNT_MISMATCH") ||
        message.includes("INVALID_PAYMENT_AMOUNTS")
      ) {
        return NextResponse.json(
          {
            error:
              "No pudimos verificar la integridad del pago.",
          },
          { status: 409 },
        );
      }

      return NextResponse.json(
        { error: "No pudimos confirmar el pago." },
        { status: 500 },
      );
    }

    if (!result?.success) {
      console.error(
        "Unexpected payment finalization result:",
        result,
      );

      return NextResponse.json(
        { error: "No pudimos confirmar el pago." },
        { status: 500 },
      );
    }

    /*
     * If this payment was already finalized, do NOT create
     * another sale notification.
     *
     * The RPC already prevented another seller balance credit.
     */
    if (result.already_paid) {
      return NextResponse.json({
        success: true,
        alreadyPaid: true,
        paymentId: result.payment_id,
        orderId: result.order_id,
        sellerAmount: Number(result.seller_amount) || 0,
      });
    }

    const sellerAmount = Number(result.seller_amount) || 0;
    const orderId = result.order_id as string;
    const productId = result.product_id as string;
    const sellerId = result.seller_id as string;
    const buyerId = result.buyer_id as string;

    /*
     * Notification is intentionally outside the financial RPC.
     *
     * A notification failure must never roll back or make the
     * client believe that a successful payment failed.
     */
    let productTitle = "tu publicación";

    const { data: product, error: productLookupError } =
      await admin
        .from("products")
        .select("title")
        .eq("id", productId)
        .maybeSingle();

    if (productLookupError) {
      console.error(
        "Product notification lookup error:",
        productLookupError,
      );
    }

    if (product?.title) {
      productTitle = product.title;
    }

    const { error: notificationError } = await admin
      .from("notifications")
      .insert({
        user_id: sellerId,
        actor_id: buyerId,
        type: "sale",
        title: "¡Nueva venta!",
        message: `Vendiste ${productTitle} por $${sellerAmount.toFixed(2)}.`,
        link: "/sales",
        product_id: productId,
      });

    if (notificationError) {
      console.error(
        "Sale notification error:",
        notificationError,
      );
    }

    return NextResponse.json({
      success: true,
      alreadyPaid: false,
      paymentId: result.payment_id,
      orderId,
      sellerAmount,
    });
  } catch (error) {
    console.error("Test payment error:", error);

    return NextResponse.json(
      { error: "Error interno del servidor." },
      { status: 500 },
    );
  }
}