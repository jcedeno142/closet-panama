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
      return NextResponse.json(
        { error: "No autorizado." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { orderId } = body;

    if (!orderId) {
      return NextResponse.json(
        { error: "Falta el pedido." },
        { status: 400 }
      );
    }

    const { data: order, error: orderError } = await admin
      .from("orders")
      .select(`
        id,
        buyer_id,
        seller_id,
        status
      `)
      .eq("id", orderId)
      .maybeSingle();

    if (orderError) {
      console.error("Order lookup error:", orderError);

      return NextResponse.json(
        { error: "No pudimos verificar el pedido." },
        { status: 500 }
      );
    }

    if (!order) {
      return NextResponse.json(
        { error: "Pedido no encontrado." },
        { status: 404 }
      );
    }

    if (order.buyer_id !== user.id) {
      return NextResponse.json(
        { error: "No tienes permiso para confirmar este pedido." },
        { status: 403 }
      );
    }

    if (
      order.status !== "shipped" &&
      order.status !== "ready_for_pickup"
    ) {
      return NextResponse.json(
        { error: "Este pedido todavía no puede ser completado." },
        { status: 400 }
      );
    }

    const { data: payment, error: paymentError } = await admin
      .from("payments")
      .select(`
        id,
        seller_id,
        seller_amount,
        status
      `)
      .eq("order_id", order.id)
      .eq("status", "paid")
      .maybeSingle();

    if (paymentError) {
      console.error("Payment lookup error:", paymentError);

      return NextResponse.json(
        { error: "No pudimos verificar el pago." },
        { status: 500 }
      );
    }

    if (!payment) {
      return NextResponse.json(
        { error: "No encontramos un pago confirmado para este pedido." },
        { status: 400 }
      );
    }

    const { data: balance, error: balanceError } = await admin
      .from("seller_balances")
      .select(`
        seller_id,
        pending_balance,
        available_balance
      `)
      .eq("seller_id", order.seller_id)
      .maybeSingle();

    if (balanceError) {
      console.error("Balance lookup error:", balanceError);

      return NextResponse.json(
        { error: "No pudimos verificar el saldo del vendedor." },
        { status: 500 }
      );
    }

    if (!balance) {
      return NextResponse.json(
        { error: "No encontramos el saldo del vendedor." },
        { status: 400 }
      );
    }

    const sellerAmount = Number(payment.seller_amount);
    const pendingBalance = Number(balance.pending_balance) || 0;
    const availableBalance = Number(balance.available_balance) || 0;

    if (pendingBalance < sellerAmount) {
      return NextResponse.json(
        { error: "El saldo pendiente del vendedor no es suficiente." },
        { status: 400 }
      );
    }

    const newPending =
      Math.round((pendingBalance - sellerAmount) * 100) / 100;

    const newAvailable =
      Math.round((availableBalance + sellerAmount) * 100) / 100;

    const now = new Date().toISOString();

    const { error: balanceUpdateError } = await admin
      .from("seller_balances")
      .update({
        pending_balance: newPending,
        available_balance: newAvailable,
        updated_at: now,
      })
      .eq("seller_id", order.seller_id);

    if (balanceUpdateError) {
      console.error("Balance update error:", balanceUpdateError);

      return NextResponse.json(
        { error: "No pudimos liberar el saldo del vendedor." },
        { status: 500 }
      );
    }

    const { data: completedOrder, error: orderUpdateError } =
      await admin
        .from("orders")
        .update({
          status: "completed",
          updated_at: now,
        })
        .eq("id", order.id)
        .in("status", ["shipped", "ready_for_pickup"])
        .select()
        .single();

    if (orderUpdateError) {
      console.error("Order completion error:", orderUpdateError);

      return NextResponse.json(
        { error: "No pudimos completar el pedido." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      order: completedOrder,
      sellerAmount,
      pendingBalance: newPending,
      availableBalance: newAvailable,
    });
  } catch (error) {
    console.error("Confirm received error:", error);

    return NextResponse.json(
      { error: "Error interno del servidor." },
      { status: 500 }
    );
  }
}