"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Box,
  CheckCircle2,
  ChevronRight,
  Clock3,
  MapPin,
  PackageCheck,
  ShoppingBag,
  Store,
  Truck,
  Star,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Order = {
  id: string;
  product_id: string;
  buyer_id: string;
  seller_id: string;
  amount: number;
  status: string;
  fulfillment_method: string | null;
  payment_method: string | null;
  created_at: string;
};

type ProductInfo = {
  id: string;
  title: string;
  image: string | null;
};

type ProfileInfo = {
  id: string;
  username: string | null;
  display_name: string | null;
};

type OrderWithDetails = Order & {
  product?: ProductInfo;
  buyer?: ProfileInfo;
  seller?: ProfileInfo;
  hasReview?: boolean;
};

type Tab = "buying" | "selling";

export default function OrdersPage() {
  const supabase = useMemo(() => createClient(), []);

  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>("buying");

  const [processingId, setProcessingId] = useState<string | null>(null);

  const [message, setMessage] = useState("");

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  async function loadOrders() {
    setLoading(true);

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      window.location.href = "/auth";
      return;
    }

    setCurrentUserId(user.id);

    const { data: orderData, error: orderError } = await supabase
      .from("orders")
      .select(
        `
          id,
          product_id,
          buyer_id,
          seller_id,
          amount,
          status,
          fulfillment_method,
          payment_method,
          created_at
        `,
      )
      .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
      .order("created_at", {
        ascending: false,
      });

    if (orderError) {
      console.error("Orders error:", orderError);
      setMessage(orderError.message);
      setLoading(false);
      return;
    }

    const baseOrders = orderData || [];

    const detailedOrders: OrderWithDetails[] = await Promise.all(
      baseOrders.map(async (order) => {
        const { data: productData } = await supabase
          .from("products")
          .select(
            `
              id,
              title,
              product_images (
                image_url,
                position
              )
            `,
          )
          .eq("id", order.product_id)
          .maybeSingle();

        const images = [...(productData?.product_images || [])].sort(
          (a, b) => Number(a.position) - Number(b.position),
        );

        const { data: buyerData } = await supabase
          .from("profiles")
          .select(
            `
              id,
              username,
              display_name
            `,
          )
          .eq("id", order.buyer_id)
          .maybeSingle();

        const { data: sellerData } = await supabase
          .from("profiles")
          .select(
            `
              id,
              username,
              display_name
            `,
          )
          .eq("id", order.seller_id)
          .maybeSingle();

        const { data: reviewData } = await supabase
          .from("reviews")
          .select("id")
          .eq("order_id", order.id)
          .eq("reviewer_id", user.id)
          .maybeSingle();

        return {
          ...order,

          product: productData
            ? {
                id: productData.id,
                title: productData.title,
                image: images[0]?.image_url || null,
              }
            : undefined,

          buyer: buyerData || undefined,
          seller: sellerData || undefined,

          hasReview: Boolean(reviewData),
        };
      }),
    );

    setOrders(detailedOrders);
    setLoading(false);
  }

  useEffect(() => {
    loadOrders();
  }, []);

  async function confirmReceived(orderId: string) {
    const confirmed = window.confirm(
      "¿Confirmas que recibiste el artículo? Esta acción completará la compra y liberará el pago al vendedor.",
    );

    if (!confirmed) {
      return;
    }

    setMessage("");
    setProcessingId(orderId);

    try {
      const response = await fetch("/api/orders/confirm-received", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          orderId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "No pudimos confirmar la entrega.");
        return;
      }

      setMessage("¡Listo! El pedido fue completado correctamente.");

      await loadOrders();
    } catch (error) {
      console.error("Confirm received error:", error);

      setMessage("Ocurrió un error al confirmar la entrega.");
    } finally {
      setProcessingId(null);
    }
  }

  const buyingOrders = orders.filter(
    (order) => order.buyer_id === currentUserId,
  );

  const sellingOrders = orders.filter(
    (order) => order.seller_id === currentUserId,
  );

  const visibleOrders = tab === "buying" ? buyingOrders : sellingOrders;

  return (
    <main className="min-h-screen bg-zinc-50 text-black">
      <div className="mx-auto max-w-md">
        {/* HEADER */}

        <header className="sticky top-0 z-40 border-b border-zinc-100 bg-white">
          <div className="flex items-center px-4 py-4">
            <Link
              href="/"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100"
            >
              <ArrowLeft size={20} />
            </Link>

            <div className="ml-4">
              <h1 className="text-lg font-black">Mis pedidos</h1>

              <p className="text-xs text-zinc-400">Compras y ventas</p>
            </div>
          </div>

          {/* TABS */}

          <div className="flex px-4">
            <button
              type="button"
              onClick={() => setTab("buying")}
              className={`flex-1 border-b-2 py-3 text-sm font-bold ${
                tab === "buying"
                  ? "border-black text-black"
                  : "border-transparent text-zinc-400"
              }`}
            >
              Compras
            </button>

            <button
              type="button"
              onClick={() => setTab("selling")}
              className={`flex-1 border-b-2 py-3 text-sm font-bold ${
                tab === "selling"
                  ? "border-black text-black"
                  : "border-transparent text-zinc-400"
              }`}
            >
              Ventas
            </button>
          </div>
        </header>

        {/* MESSAGE */}

        {message && (
          <div className="mx-4 mt-4 rounded-2xl bg-white p-4 text-sm">
            {message}
          </div>
        )}

        {/* SELLER DASHBOARD LINK */}

        {tab === "selling" && (
          <div className="px-4 pt-4">
            <Link
              href="/sales"
              className="flex items-center justify-between rounded-2xl bg-black p-4 text-white"
            >
              <div className="flex items-center gap-3">
                <Store size={20} />

                <div>
                  <p className="text-sm font-bold">Administrar ventas</p>

                  <p className="text-xs text-zinc-300">
                    Preparar y enviar pedidos
                  </p>
                </div>
              </div>

              <ChevronRight size={19} />
            </Link>
          </div>
        )}

        {/* CONTENT */}

        {loading ? (
          <div className="flex min-h-[60vh] items-center justify-center">
            <p className="text-sm text-zinc-400">Cargando pedidos...</p>
          </div>
        ) : visibleOrders.length === 0 ? (
          <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white">
              {tab === "buying" ? (
                <ShoppingBag size={27} />
              ) : (
                <Store size={27} />
              )}
            </div>

            <h2 className="mt-4 font-black">
              {tab === "buying"
                ? "Todavía no tienes compras"
                : "Todavía no tienes ventas"}
            </h2>

            <p className="mt-2 text-sm text-zinc-400">
              {tab === "buying"
                ? "Tus compras aparecerán aquí."
                : "Los artículos que vendas aparecerán aquí."}
            </p>

            {tab === "buying" && (
              <Link
                href="/"
                className="mt-5 rounded-xl bg-black px-5 py-3 text-sm font-bold text-white"
              >
                Explorar productos
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-3 p-4">
            {visibleOrders.map((order) => {
              const otherPerson = tab === "buying" ? order.seller : order.buyer;

              const otherPersonName =
                otherPerson?.display_name ||
                otherPerson?.username ||
                (tab === "buying" ? "Vendedor" : "Comprador");

              return (
                <article
                  key={order.id}
                  className="overflow-hidden rounded-2xl bg-white"
                >
                  {/* PRODUCT */}

                  <div className="flex gap-4 p-4">
                    <div className="h-24 w-20 shrink-0 overflow-hidden rounded-xl bg-zinc-100">
                      {order.product?.image ? (
                        <img
                          src={order.product.image}
                          alt={order.product.title || "Producto"}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Box size={21} className="text-zinc-300" />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <StatusBadge status={order.status} />

                      <h2 className="mt-2 truncate font-bold">
                        {order.product?.title || "Producto"}
                      </h2>

                      <p className="mt-1 text-xs text-zinc-400">
                        {tab === "buying" ? "Vendedor" : "Comprador"}:{" "}
                        {otherPersonName}
                      </p>

                      <p className="mt-2 text-lg font-black">
                        ${Number(order.amount).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  {/* DELIVERY */}

                  {order.fulfillment_method && (
                    <div className="border-t border-zinc-100 px-4 py-3">
                      <div className="flex items-center gap-2 text-xs text-zinc-500">
                        {order.fulfillment_method === "pickup" ? (
                          <MapPin size={15} />
                        ) : (
                          <Truck size={15} />
                        )}

                        <span>
                          {fulfillmentLabel(order.fulfillment_method)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* BUYER: PAYMENT NEEDED */}

                  {tab === "buying" && order.status === "pending_payment" && (
                    <div className="border-t border-zinc-100 p-4">
                      <Link
                        href={`/checkout/${order.id}`}
                        className="flex w-full items-center justify-between rounded-xl bg-black px-4 py-3 text-sm font-bold text-white"
                      >
                        Completar pago
                        <ChevronRight size={18} />
                      </Link>
                    </div>
                  )}

                  {/* BUYER: PAID WAITING FOR SELLER */}

                  {tab === "buying" && order.status === "paid" && (
                    <div className="flex items-center gap-2 border-t border-zinc-100 bg-zinc-50 px-4 py-3">
                      <Clock3 size={16} className="text-zinc-500" />

                      <p className="text-xs font-semibold text-zinc-500">
                        El vendedor está preparando tu pedido.
                      </p>
                    </div>
                  )}

                  {/* BUYER: SHIPPED */}

                  {tab === "buying" && order.status === "shipped" && (
                    <>
                      <div className="border-t border-zinc-100 bg-zinc-50 px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Truck size={16} className="text-zinc-500" />

                          <p className="text-xs font-semibold text-zinc-500">
                            El vendedor marcó este artículo como enviado.
                          </p>
                        </div>
                      </div>

                      <div className="border-t border-zinc-100 p-4">
                        <button
                          type="button"
                          onClick={() => confirmReceived(order.id)}
                          disabled={processingId === order.id}
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-black px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
                        >
                          <CheckCircle2 size={18} />

                          {processingId === order.id
                            ? "Confirmando..."
                            : "Confirmar que recibí el artículo"}
                        </button>

                        <p className="mt-2 text-center text-[11px] text-zinc-400">
                          Confirma solamente cuando tengas el artículo.
                        </p>
                      </div>
                    </>
                  )}

                  {/* BUYER: READY FOR PICKUP */}

                  {tab === "buying" && order.status === "ready_for_pickup" && (
                    <>
                      <div className="border-t border-zinc-100 bg-zinc-50 px-4 py-3">
                        <div className="flex items-center gap-2">
                          <PackageCheck size={16} className="text-zinc-500" />

                          <p className="text-xs font-semibold text-zinc-500">
                            Tu artículo está listo para retirar.
                          </p>
                        </div>
                      </div>

                      <div className="border-t border-zinc-100 p-4">
                        <button
                          type="button"
                          onClick={() => confirmReceived(order.id)}
                          disabled={processingId === order.id}
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-black px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
                        >
                          <CheckCircle2 size={18} />

                          {processingId === order.id
                            ? "Confirmando..."
                            : "Confirmar que recibí el artículo"}
                        </button>

                        <p className="mt-2 text-center text-[11px] text-zinc-400">
                          Confirma después de recibir personalmente el artículo.
                        </p>
                      </div>
                    </>
                  )}

                  {/* COMPLETED */}

                  {order.status === "completed" && (
                    <>
                      <div className="flex items-center gap-2 border-t border-zinc-100 bg-zinc-50 px-4 py-3">
                        <CheckCircle2 size={16} className="text-zinc-500" />

                        <p className="text-xs font-semibold text-zinc-500">
                          Pedido completado
                        </p>
                      </div>

                      {tab === "buying" && (
                        <div className="border-t border-zinc-100 p-4">
                          {order.hasReview ? (
                            <div className="flex items-center justify-center gap-2 rounded-xl bg-zinc-100 px-4 py-3 text-sm font-bold text-zinc-500">
                              <Star size={17} fill="currentColor" />
                              Vendedor calificado
                            </div>
                          ) : (
                            <Link
                              href={`/orders/${order.id}/review`}
                              className="flex w-full items-center justify-center gap-2 rounded-xl bg-black px-4 py-3 text-sm font-bold text-white"
                            >
                              <Star size={17} />
                              Calificar vendedor
                            </Link>
                          )}
                        </div>
                      )}
                    </>
                  )}

                  {/* SELLER LINK */}

                  {tab === "selling" &&
                    order.status !== "completed" &&
                    order.status !== "pending_payment" && (
                      <div className="border-t border-zinc-100 p-4">
                        <Link
                          href="/sales"
                          className="flex w-full items-center justify-between rounded-xl bg-zinc-100 px-4 py-3 text-sm font-bold"
                        >
                          Administrar venta
                          <ChevronRight size={18} />
                        </Link>
                      </div>
                    )}
                </article>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}

function fulfillmentLabel(method: string | null) {
  switch (method) {
    case "shipping":
      return "Envío nacional";

    case "local_delivery":
      return "Entrega local";

    case "pickup":
      return "Retiro / encuentro";

    default:
      return "Método de entrega";
  }
}

function StatusBadge({ status }: { status: string }) {
  let label = status;

  if (status === "pending_payment") {
    label = "Pendiente de pago";
  }

  if (status === "paid") {
    label = "Pagado";
  }

  if (status === "shipped") {
    label = "En camino";
  }

  if (status === "ready_for_pickup") {
    label = "Listo para retirar";
  }

  if (status === "completed") {
    label = "Completado";
  }

  if (status === "cancelled") {
    label = "Cancelado";
  }

  if (status === "refunded") {
    label = "Reembolsado";
  }

  return (
    <span className="inline-flex rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide">
      {label}
    </span>
  );
}
