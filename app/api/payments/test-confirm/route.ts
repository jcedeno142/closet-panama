import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    // NEVER allow simulated payments in production
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Test payments are disabled." },
        { status: 403 }
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
        { status: 401 }
      );
    }

    const body = await request.json();
    const { paymentId } = body;

    if (!paymentId) {
      return NextResponse.json(
        { error: "Falta el pago." },
        { status: 400 }
      );
    }

    // Find payment
    const { data: payment, error: paymentError } =
      await admin
        .from("payments")
        .select("*")
        .eq("id", paymentId)
        .eq("buyer_id", user.id)
        .maybeSingle();

    if (paymentError) {
      console.error(paymentError);

      return NextResponse.json(
        { error: "No pudimos verificar el pago." },
        { status: 500 }
      );
    }

    if (!payment) {
      return NextResponse.json(
        { error: "Pago no encontrado." },
        { status: 404 }
      );
    }

    if (payment.status === "paid") {
      return NextResponse.json({
        success: true,
        alreadyPaid: true,
      });
    }

    if (payment.status !== "pending") {
      return NextResponse.json(
        { error: "Este pago no puede ser confirmado." },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();

    // Mark payment paid
    const { error: updatePaymentError } =
      await admin
        .from("payments")
        .update({
          status: "paid",
          paid_at: now,
          updated_at: now,
        })
        .eq("id", payment.id)
        .eq("status", "pending");

    if (updatePaymentError) {
      console.error(updatePaymentError);

      return NextResponse.json(
        { error: "No pudimos confirmar el pago." },
        { status: 500 }
      );
    }

    // Mark order paid
    const { error: orderError } =
      await admin
        .from("orders")
        .update({
          status: "paid",
          updated_at: now,
        })
        .eq("id", payment.order_id);

    if (orderError) {
      console.error(orderError);

      return NextResponse.json(
        { error: "No pudimos actualizar el pedido." },
        { status: 500 }
      );
    }

    // Create seller balance row if it doesn't exist
    const { error: balanceCreateError } =
      await admin
        .from("seller_balances")
        .upsert(
          {
            seller_id: payment.seller_id,
          },
          {
            onConflict: "seller_id",
            ignoreDuplicates: true,
          }
        );

    if (balanceCreateError) {
      console.error(balanceCreateError);

      return NextResponse.json(
        { error: "No pudimos preparar el saldo del vendedor." },
        { status: 500 }
      );
    }

    // Get current seller balance
    const { data: balance, error: balanceError } =
      await admin
        .from("seller_balances")
        .select("pending_balance")
        .eq("seller_id", payment.seller_id)
        .single();

    if (balanceError) {
      console.error(balanceError);

      return NextResponse.json(
        { error: "No pudimos obtener el saldo." },
        { status: 500 }
      );
    }

    const currentPending =
      Number(balance.pending_balance) || 0;

    const sellerAmount =
      Number(payment.seller_amount) || 0;

    // Add proceeds to pending seller balance
    const { error: balanceUpdateError } =
      await admin
        .from("seller_balances")
        .update({
          pending_balance:
            Math.round(
              (currentPending + sellerAmount) * 100
            ) / 100,

          updated_at: now,
        })
        .eq("seller_id", payment.seller_id);

    if (balanceUpdateError) {
      console.error(balanceUpdateError);

      return NextResponse.json(
        { error: "No pudimos actualizar el saldo." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      paymentId: payment.id,
      orderId: payment.order_id,
      sellerAmount,
    });
  } catch (error) {
    console.error("Test payment error:", error);

    return NextResponse.json(
      { error: "Error interno del servidor." },
      { status: 500 }
    );
  }
}