import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const admin = createAdminClient();

    // Authenticate the buyer.
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
    const productId = body?.productId;

    if (!productId || typeof productId !== "string") {
      return NextResponse.json(
        { error: "Falta el artículo." },
        { status: 400 },
      );
    }

    // IMPORTANT:
    // The server retrieves the product. We do not trust seller_id,
    // price, status, or buyer_id supplied by the browser.
    const { data: product, error: productError } = await admin
      .from("products")
      .select("id, seller_id, price, status")
      .eq("id", productId)
      .maybeSingle();

    if (productError) {
      console.error("Create order product lookup error:", productError);

      return NextResponse.json(
        { error: "No pudimos verificar el artículo." },
        { status: 500 },
      );
    }

    if (!product) {
      return NextResponse.json(
        { error: "El artículo no existe." },
        { status: 404 },
      );
    }

    if (product.status !== "active") {
      return NextResponse.json(
        { error: "Este artículo ya no está disponible." },
        { status: 409 },
      );
    }

    if (product.seller_id === user.id) {
      return NextResponse.json(
        { error: "No puedes comprar tu propia publicación." },
        { status: 400 },
      );
    }

    const amount = Number(product.price);

    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json(
        { error: "El precio del artículo no es válido." },
        { status: 400 },
      );
    }

    // Reuse an existing pending checkout for this buyer/product.
    const { data: existingOrders, error: existingOrderError } =
      await admin
        .from("orders")
        .select("id")
        .eq("product_id", product.id)
        .eq("buyer_id", user.id)
        .eq("seller_id", product.seller_id)
        .eq("status", "pending_payment")
        .order("created_at", { ascending: false })
        .limit(1);

    if (existingOrderError) {
      console.error(
        "Existing order lookup error:",
        existingOrderError,
      );

      return NextResponse.json(
        { error: "No pudimos preparar la compra." },
        { status: 500 },
      );
    }

    const existingOrder = existingOrders?.[0] ?? null;

    if (existingOrder) {
      return NextResponse.json({
        success: true,
        existing: true,
        order: {
          id: existingOrder.id,
        },
      });
    }

    // ADMIN performs the insert after all values have been
    // independently determined by the server.
    const { data: order, error: orderError } = await admin
      .from("orders")
      .insert({
        product_id: product.id,
        buyer_id: user.id,
        seller_id: product.seller_id,
        amount,
        status: "pending_payment",
      })
      .select("id")
      .single();

    if (orderError) {
      console.error("Create order error:", orderError);

      return NextResponse.json(
        { error: "No pudimos iniciar la compra." },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      existing: false,
      order: {
        id: order.id,
      },
    });
  } catch (error) {
    console.error("Create order route error:", error);

    return NextResponse.json(
      { error: "Error interno del servidor." },
      { status: 500 },
    );
  }
}