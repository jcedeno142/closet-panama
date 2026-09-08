"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Box,
  CheckCircle2,
  MapPin,
  PackageCheck,
  Truck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Sale = {
  id: string;
  product_id: string;
  buyer_id: string;
  seller_id: string;
  amount: number;
  status: string;
  fulfillment_method: string | null;
  created_at: string;
};

type ProductInfo = {
  id: string;
  title: string;
  image: string | null;
};

type BuyerInfo = {
  id: string;
  username: string | null;
  display_name: string | null;
};

type SaleWithDetails = Sale & {
  product?: ProductInfo;
  buyer?: BuyerInfo;
};

type Tab = "active" | "completed";

export default function SalesPage() {
  const supabase = createClient();

  const [sales, setSales] = useState<SaleWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] =
    useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [tab, setTab] = useState<Tab>("active");

  async function loadSales() {
    setLoading(true);
    setMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      window.location.href = "/auth";
      return;
    }

    const { data: orderData, error: orderError } =
      await supabase
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
        .eq("seller_id", user.id)
        .in("status", [
          "paid",
          "shipped",
          "ready_for_pickup",
          "completed",
        ])
        .order("created_at", {
          ascending: false,
        });

    if (orderError) {
      setMessage(orderError.message);
      setLoading(false);
      return;
    }

    const orders = orderData || [];

    const detailedSales: SaleWithDetails[] =
      await Promise.all(
        orders.map(async (sale) => {
          const { data: productData } = await supabase
            .from("products")
            .select(`
              id,
              title,
              product_images (
                image_url,
                position
              )
            `)
            .eq("id", sale.product_id)
            .maybeSingle();

          const images = [
            ...(productData?.product_images || []),
          ].sort(
            (a, b) =>
              Number(a.position) - Number(b.position)
          );

          const { data: buyerData } = await supabase
            .from("profiles")
            .select(`
              id,
              username,
              display_name
            `)
            .eq("id", sale.buyer_id)
            .maybeSingle();

          return {
            ...sale,

            product: productData
              ? {
                  id: productData.id,
                  title: productData.title,
                  image:
                    images[0]?.image_url || null,
                }
              : undefined,

            buyer: buyerData || undefined,
          };
        })
      );

    setSales(detailedSales);
    setLoading(false);
  }

  useEffect(() => {
    loadSales();
  }, []);

  async function updateSale(
    orderId: string,
    action: "ship" | "ready_for_pickup"
  ) {
    setProcessingId(orderId);
    setMessage("");

    try {
      const response = await fetch(
        "/api/orders/seller-status",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            orderId,
            action,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(
          data.error ||
            "No pudimos actualizar la venta."
        );
        return;
      }

      await loadSales();
    } catch (error) {
      console.error(error);

      setMessage(
        "Ocurrió un error al actualizar la venta."
      );
    } finally {
      setProcessingId(null);
    }
  }

  const visibleSales = sales.filter((sale) => {
    if (tab === "completed") {
      return sale.status === "completed";
    }

    return sale.status !== "completed";
  });

  return (
    <main className="min-h-screen bg-zinc-50 text-black">
      <div className="mx-auto max-w-md">
        <header className="sticky top-0 z-40 border-b border-zinc-100 bg-white">
          <div className="flex items-center px-4 py-4">
            <Link
              href="/"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100"
            >
              <ArrowLeft size={20} />
            </Link>

            <div className="ml-4">
              <h1 className="text-lg font-black">
                Mis ventas
              </h1>

              <p className="text-xs text-zinc-400">
                Administra tus pedidos
              </p>
            </div>
          </div>

          <div className="flex px-4">
            <button
              type="button"
              onClick={() => setTab("active")}
              className={`flex-1 border-b-2 py-3 text-sm font-bold ${
                tab === "active"
                  ? "border-black text-black"
                  : "border-transparent text-zinc-400"
              }`}
            >
              Activas
            </button>

            <button
              type="button"
              onClick={() => setTab("completed")}
              className={`flex-1 border-b-2 py-3 text-sm font-bold ${
                tab === "completed"
                  ? "border-black text-black"
                  : "border-transparent text-zinc-400"
              }`}
            >
              Completadas
            </button>
          </div>
        </header>

        {message && (
          <div className="mx-4 mt-4 rounded-xl bg-white p-4 text-sm">
            {message}
          </div>
        )}

        {loading ? (
          <div className="flex min-h-[60vh] items-center justify-center">
            <p className="text-sm text-zinc-400">
              Cargando ventas...
            </p>
          </div>
        ) : visibleSales.length === 0 ? (
          <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white">
              <Box size={26} />
            </div>

            <h2 className="mt-4 font-black">
              {tab === "active"
                ? "No tienes ventas activas"
                : "No tienes ventas completadas"}
            </h2>

            <p className="mt-2 text-sm text-zinc-400">
              Tus ventas aparecerán aquí.
            </p>
          </div>
        ) : (
          <div className="space-y-3 p-4">
            {visibleSales.map((sale) => {
              const buyerName =
                sale.buyer?.display_name ||
                sale.buyer?.username ||
                "Comprador";

              return (
                <article
                  key={sale.id}
                  className="overflow-hidden rounded-2xl bg-white"
                >
                  <div className="flex gap-4 p-4">
                    <div className="h-24 w-20 shrink-0 overflow-hidden rounded-xl bg-zinc-100">
                      {sale.product?.image ? (
                        <img
                          src={sale.product.image}
                          alt={
                            sale.product.title ||
                            "Producto"
                          }
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Box
                            size={20}
                            className="text-zinc-300"
                          />
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <StatusBadge
                        status={sale.status}
                      />

                      <h2 className="mt-2 truncate font-bold">
                        {sale.product?.title ||
                          "Producto"}
                      </h2>

                      <p className="mt-1 text-xs text-zinc-400">
                        Comprador: {buyerName}
                      </p>

                      <p className="mt-2 text-lg font-black">
                        $
                        {Number(
                          sale.amount
                        ).toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-zinc-100 px-4 py-3">
                    <div className="flex items-center gap-2 text-xs text-zinc-500">
                      {sale.fulfillment_method ===
                      "pickup" ? (
                        <MapPin size={15} />
                      ) : (
                        <Truck size={15} />
                      )}

                      <span>
                        {fulfillmentLabel(
                          sale.fulfillment_method
                        )}
                      </span>
                    </div>
                  </div>

                  {sale.status === "paid" && (
                    <div className="border-t border-zinc-100 p-4">
                      {sale.fulfillment_method ===
                      "pickup" ? (
                        <button
                          type="button"
                          disabled={
                            processingId === sale.id
                          }
                          onClick={() =>
                            updateSale(
                              sale.id,
                              "ready_for_pickup"
                            )
                          }
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-black px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
                        >
                          <PackageCheck size={18} />

                          {processingId === sale.id
                            ? "Actualizando..."
                            : "Listo para retirar"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={
                            processingId === sale.id
                          }
                          onClick={() =>
                            updateSale(
                              sale.id,
                              "ship"
                            )
                          }
                          className="flex w-full items-center justify-center gap-2 rounded-xl bg-black px-4 py-3 text-sm font-bold text-white disabled:opacity-50"
                        >
                          <Truck size={18} />

                          {processingId === sale.id
                            ? "Actualizando..."
                            : "Marcar como enviado"}
                        </button>
                      )}
                    </div>
                  )}

                  {(sale.status === "shipped" ||
                    sale.status ===
                      "ready_for_pickup") && (
                    <div className="border-t border-zinc-100 bg-zinc-50 px-4 py-3">
                      <p className="text-xs font-semibold text-zinc-500">
                        Esperando confirmación del
                        comprador.
                      </p>
                    </div>
                  )}

                  {sale.status === "completed" && (
                    <div className="flex items-center gap-2 border-t border-zinc-100 bg-zinc-50 px-4 py-3 text-xs font-semibold text-zinc-500">
                      <CheckCircle2 size={16} />

                      Venta completada
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

function fulfillmentLabel(
  method: string | null
) {
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

function StatusBadge({
  status,
}: {
  status: string;
}) {
  let label = status;

  if (status === "paid") {
    label = "Por preparar";
  }

  if (status === "shipped") {
    label = "Enviado";
  }

  if (status === "ready_for_pickup") {
    label = "Listo para retirar";
  }

  if (status === "completed") {
    label = "Completado";
  }

  return (
    <span className="inline-flex rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide">
      {label}
    </span>
  );
}