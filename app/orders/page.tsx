"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Package,
  ShoppingBag,
  Truck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Order = {
  id: string;
  product_id: string;
  offer_id: string | null;
  buyer_id: string;
  seller_id: string;
  amount: number;
  status: string;
  fulfillment_method: string | null;
  created_at: string;
};

type ProductImage = {
  image_url: string;
  position: number;
};

type Product = {
  id: string;
  title: string;
  product_images: ProductImage[];
};

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
};

type OrderCard = Order & {
  product?: Product;
  otherUser?: Profile;
};

export default function OrdersPage() {
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<
    "buying" | "selling"
  >("buying");

  const [buyingOrders, setBuyingOrders] = useState<OrderCard[]>([]);
  const [sellingOrders, setSellingOrders] = useState<OrderCard[]>([]);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadOrders = useCallback(async () => {
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

    const { data: buyingData, error: buyingError } =
      await supabase
        .from("orders")
        .select("*")
        .eq("buyer_id", user.id)
        .order("created_at", { ascending: false });

    if (buyingError) {
      setMessage(buyingError.message);
      setLoading(false);
      return;
    }

    const { data: sellingData, error: sellingError } =
      await supabase
        .from("orders")
        .select("*")
        .eq("seller_id", user.id)
        .order("created_at", { ascending: false });

    if (sellingError) {
      setMessage(sellingError.message);
      setLoading(false);
      return;
    }

    const allOrders = [
      ...(buyingData || []),
      ...(sellingData || []),
    ] as Order[];

    const productIds = [
      ...new Set(
        allOrders.map((order) => order.product_id)
      ),
    ];

    const profileIds = [
      ...new Set(
        allOrders.flatMap((order) => [
          order.buyer_id,
          order.seller_id,
        ])
      ),
    ];

    let productMap: Record<string, Product> = {};
    let profileMap: Record<string, Profile> = {};

    if (productIds.length > 0) {
      const { data: productData, error: productError } =
        await supabase
          .from("products")
          .select(`
            id,
            title,
            product_images (
              image_url,
              position
            )
          `)
          .in("id", productIds);

      if (productError) {
        setMessage(productError.message);
        setLoading(false);
        return;
      }

      productMap = Object.fromEntries(
        (productData || []).map((product) => [
          product.id,
          {
            ...product,
            product_images: [
              ...(product.product_images || []),
            ].sort((a, b) => a.position - b.position),
          },
        ])
      );
    }

    if (profileIds.length > 0) {
      const { data: profileData, error: profileError } =
        await supabase
          .from("profiles")
          .select("id, username, display_name")
          .in("id", profileIds);

      if (profileError) {
        setMessage(profileError.message);
        setLoading(false);
        return;
      }

      profileMap = Object.fromEntries(
        (profileData || []).map((profile) => [
          profile.id,
          profile,
        ])
      );
    }

    setBuyingOrders(
      (buyingData || []).map((order) => ({
        ...order,
        product: productMap[order.product_id],
        otherUser: profileMap[order.seller_id],
      }))
    );

    setSellingOrders(
      (sellingData || []).map((order) => ({
        ...order,
        product: productMap[order.product_id],
        otherUser: profileMap[order.buyer_id],
      }))
    );

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const orders =
    activeTab === "buying"
      ? buyingOrders
      : sellingOrders;

  return (
    <main className="min-h-screen bg-white pb-10 text-black">
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
              <h1 className="text-lg font-bold">
                Pedidos
              </h1>

              <p className="text-xs text-zinc-400">
                Compras y ventas
              </p>
            </div>
          </div>

          <div className="flex">
            <button
              onClick={() => setActiveTab("buying")}
              className={`flex-1 border-b-2 py-3 text-sm font-bold ${
                activeTab === "buying"
                  ? "border-black text-black"
                  : "border-transparent text-zinc-400"
              }`}
            >
              Compras
            </button>

            <button
              onClick={() => setActiveTab("selling")}
              className={`flex-1 border-b-2 py-3 text-sm font-bold ${
                activeTab === "selling"
                  ? "border-black text-black"
                  : "border-transparent text-zinc-400"
              }`}
            >
              Ventas
            </button>
          </div>
        </header>

        {loading && (
          <div className="py-16 text-center text-sm text-zinc-500">
            Cargando pedidos...
          </div>
        )}

        {!loading && message && (
          <div className="mx-4 mt-4 rounded-xl bg-zinc-100 p-4 text-sm">
            {message}
          </div>
        )}

        {!loading &&
          !message &&
          orders.length === 0 && (
            <div className="px-5 py-20 text-center">
              <ShoppingBag
                size={34}
                className="mx-auto text-zinc-300"
              />

              <h2 className="mt-4 font-bold">
                No hay pedidos todavía
              </h2>

              <p className="mt-2 text-sm text-zinc-500">
                {activeTab === "buying"
                  ? "Tus compras aparecerán aquí."
                  : "Tus ventas aparecerán aquí."}
              </p>
            </div>
          )}

        {!loading &&
          !message &&
          orders.length > 0 && (
            <section className="divide-y divide-zinc-100">
              {orders.map((order) => {
                const cover =
                  order.product?.product_images?.[0]?.image_url;

                return (
                  <article
                    key={order.id}
                    className="px-4 py-5"
                  >
                    <div className="flex gap-4">
                      <Link
                        href={`/product/${order.product_id}`}
                        className="h-28 w-24 shrink-0 overflow-hidden rounded-xl bg-zinc-100"
                      >
                        {cover ? (
                          <img
                            src={cover}
                            alt={order.product?.title || "Producto"}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-[10px] text-zinc-400">
                            Sin foto
                          </div>
                        )}
                      </Link>

                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-zinc-400">
                          {activeTab === "buying"
                            ? "Vendedor"
                            : "Comprador"}
                        </p>

                        <p className="mt-1 text-sm font-bold">
                          @{order.otherUser?.username || "usuario"}
                        </p>

                        <h2 className="mt-2 truncate text-sm font-semibold">
                          {order.product?.title || "Producto"}
                        </h2>

                        <p className="mt-3 text-xl font-black">
                          ${Number(order.amount).toFixed(2)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4">
                      <OrderStatus status={order.status} />
                    </div>

                    {activeTab === "buying" &&
                      order.status === "pending_payment" && (
                        <Link
                          href={`/checkout/${order.id}`}
                          className="mt-4 block rounded-xl bg-black py-3 text-center text-sm font-bold text-white"
                        >
                          Ir a pagar
                        </Link>
                      )}
                  </article>
                );
              })}
            </section>
          )}
      </div>
    </main>
  );
}

function OrderStatus({
  status,
}: {
  status: string;
}) {
  const labels: Record<string, string> = {
    pending_payment: "Pendiente de pago",
    paid: "Pagado",
    preparing: "Preparando",
    shipped: "Enviado",
    ready_for_pickup: "Listo para retirar",
    completed: "Completado",
    cancelled: "Cancelado",
    refunded: "Reembolsado",
  };

  const icons: Record<string, React.ReactNode> = {
    pending_payment: <Clock3 size={14} />,
    paid: <CheckCircle2 size={14} />,
    preparing: <Package size={14} />,
    shipped: <Truck size={14} />,
    ready_for_pickup: <Package size={14} />,
    completed: <CheckCircle2 size={14} />,
  };

  return (
    <span className="inline-flex items-center gap-2 rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold">
      {icons[status]}
      {labels[status] || status}
    </span>
  );
}