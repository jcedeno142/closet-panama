"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Clock3,
  MessageCircle,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Offer = {
  id: string;
  product_id: string;
  buyer_id: string;
  seller_id: string;
  amount: number;
  status: string;
  created_at: string;
};

type ProductImage = {
  image_url: string;
  position: number;
};

type Product = {
  id: string;
  title: string;
  price: number;
  product_images: ProductImage[];
};

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
};

type OfferCard = Offer & {
  product?: Product;
  otherUser?: Profile;
};

export default function InboxPage() {
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<
    "received" | "sent"
  >("received");

  const [receivedOffers, setReceivedOffers] = useState<
    OfferCard[]
  >([]);

  const [sentOffers, setSentOffers] = useState<
    OfferCard[]
  >([]);

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const loadInbox = useCallback(async () => {
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

    const { data: receivedData, error: receivedError } =
      await supabase
        .from("offers")
        .select("*")
        .eq("seller_id", user.id)
        .order("created_at", { ascending: false });

    if (receivedError) {
      setMessage(receivedError.message);
      setLoading(false);
      return;
    }

    const { data: sentData, error: sentError } =
      await supabase
        .from("offers")
        .select("*")
        .eq("buyer_id", user.id)
        .order("created_at", { ascending: false });

    if (sentError) {
      setMessage(sentError.message);
      setLoading(false);
      return;
    }

    const allOffers = [
      ...(receivedData || []),
      ...(sentData || []),
    ] as Offer[];

    const productIds = [
      ...new Set(
        allOffers.map((offer) => offer.product_id)
      ),
    ];

    const profileIds = [
      ...new Set(
        allOffers.flatMap((offer) => [
          offer.buyer_id,
          offer.seller_id,
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
            price,
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

    const receivedCards: OfferCard[] = (
      receivedData || []
    ).map((offer) => ({
      ...offer,
      product: productMap[offer.product_id],
      otherUser: profileMap[offer.buyer_id],
    }));

    const sentCards: OfferCard[] = (
      sentData || []
    ).map((offer) => ({
      ...offer,
      product: productMap[offer.product_id],
      otherUser: profileMap[offer.seller_id],
    }));

    setReceivedOffers(receivedCards);
    setSentOffers(sentCards);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadInbox();
  }, [loadInbox]);

  async function updateOfferStatus(
    offerId: string,
    status: "accepted" | "declined"
  ) {
    setMessage("");

    const { error } = await supabase
      .from("offers")
      .update({
        status,
        updated_at: new Date().toISOString(),
      })
      .eq("id", offerId);

    if (error) {
      setMessage(error.message);
      return;
    }

    await loadInbox();
  }

  const offers =
    activeTab === "received"
      ? receivedOffers
      : sentOffers;

  return (
    <main className="min-h-screen bg-white pb-10 text-black">
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
              <h1 className="text-lg font-bold">
                Inbox
              </h1>

              <p className="text-xs text-zinc-400">
                Ofertas y negociaciones
              </p>
            </div>
          </div>

          {/* TABS */}
          <div className="flex">
            <button
              type="button"
              onClick={() =>
                setActiveTab("received")
              }
              className={`flex-1 border-b-2 py-3 text-sm font-bold ${
                activeTab === "received"
                  ? "border-black text-black"
                  : "border-transparent text-zinc-400"
              }`}
            >
              Recibidas
              {receivedOffers.length > 0 && (
                <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px]">
                  {receivedOffers.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() =>
                setActiveTab("sent")
              }
              className={`flex-1 border-b-2 py-3 text-sm font-bold ${
                activeTab === "sent"
                  ? "border-black text-black"
                  : "border-transparent text-zinc-400"
              }`}
            >
              Enviadas
              {sentOffers.length > 0 && (
                <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px]">
                  {sentOffers.length}
                </span>
              )}
            </button>
          </div>
        </header>

        {loading && (
          <div className="py-16 text-center text-sm text-zinc-500">
            Cargando ofertas...
          </div>
        )}

        {!loading && message && (
          <div className="mx-4 mt-4 rounded-xl bg-zinc-100 p-4 text-sm">
            {message}
          </div>
        )}

        {!loading &&
          !message &&
          offers.length === 0 && (
            <div className="px-5 py-20 text-center">
              <MessageCircle
                size={34}
                className="mx-auto text-zinc-300"
              />

              <h2 className="mt-4 font-bold">
                {activeTab === "received"
                  ? "No tienes ofertas recibidas"
                  : "No has enviado ofertas"}
              </h2>

              <p className="mt-2 text-sm text-zinc-500">
                {activeTab === "received"
                  ? "Cuando alguien haga una oferta por uno de tus artículos, aparecerá aquí."
                  : "Las ofertas que hagas a otros vendedores aparecerán aquí."}
              </p>
            </div>
          )}

        {!loading &&
          !message &&
          offers.length > 0 && (
            <section className="divide-y divide-zinc-100">
              {offers.map((offer) => {
                const cover =
                  offer.product
                    ?.product_images?.[0]
                    ?.image_url;

                const otherName =
                  offer.otherUser
                    ?.display_name ||
                  offer.otherUser
                    ?.username ||
                  "Usuario";

                return (
                  <article
                    key={offer.id}
                    className="px-4 py-5"
                  >
                    <div className="flex gap-4">

                      {/* IMAGE */}
                      <Link
                        href={`/product/${offer.product_id}`}
                        className="h-28 w-24 shrink-0 overflow-hidden rounded-xl bg-zinc-100"
                      >
                        {cover ? (
                          <img
                            src={cover}
                            alt={
                              offer.product
                                ?.title ||
                              "Producto"
                            }
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-[10px] text-zinc-400">
                            Sin foto
                          </div>
                        )}
                      </Link>

                      {/* INFO */}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-zinc-400">
                          {activeTab ===
                          "received"
                            ? "Oferta de"
                            : "Oferta para"}
                        </p>

                        <p className="mt-1 truncate text-sm font-bold">
                          @{offer.otherUser?.username ||
                            "usuario"}
                        </p>

                        <Link
                          href={`/product/${offer.product_id}`}
                        >
                          <h2 className="mt-2 truncate text-sm font-semibold">
                            {offer.product?.title ||
                              "Producto"}
                          </h2>
                        </Link>

                        <div className="mt-2 flex items-end justify-between">
                          <div>
                            <p className="text-xs text-zinc-400">
                              Oferta
                            </p>

                            <p className="text-xl font-black">
                              $
                              {Number(
                                offer.amount
                              ).toFixed(2)}
                            </p>
                          </div>

                          {offer.product && (
                            <div className="text-right">
                              <p className="text-[10px] text-zinc-400">
                                Precio
                              </p>

                              <p className="text-sm font-semibold">
                                $
                                {Number(
                                  offer.product
                                    .price
                                ).toFixed(2)}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* STATUS */}
                    <div className="mt-4">
                      <StatusBadge
                        status={offer.status}
                      />
                    </div>

                    {/* SELLER ACTIONS */}
                    {activeTab ===
                      "received" &&
                      offer.status ===
                        "pending" && (
                        <div className="mt-4 grid grid-cols-2 gap-2">

                          <button
                            type="button"
                            onClick={() =>
                              updateOfferStatus(
                                offer.id,
                                "accepted"
                              )
                            }
                            className="flex items-center justify-center gap-2 rounded-xl bg-black py-3 text-sm font-bold text-white"
                          >
                            <Check size={16} />
                            Aceptar
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              updateOfferStatus(
                                offer.id,
                                "declined"
                              )
                            }
                            className="flex items-center justify-center gap-2 rounded-xl border border-zinc-300 py-3 text-sm font-bold"
                          >
                            <X size={16} />
                            Rechazar
                          </button>

                        </div>
                      )}

                    {/* BUYER INFO */}
                    {activeTab ===
                      "sent" &&
                      offer.status ===
                        "pending" && (
                        <div className="mt-4 flex items-center gap-2 rounded-xl bg-zinc-50 p-3 text-xs text-zinc-500">
                          <Clock3 size={14} />

                          Esperando respuesta del vendedor.
                        </div>
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

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const styles: Record<string, string> = {
    pending:
      "bg-amber-50 text-amber-700",
    accepted:
      "bg-green-50 text-green-700",
    declined:
      "bg-red-50 text-red-700",
    countered:
      "bg-blue-50 text-blue-700",
    expired:
      "bg-zinc-100 text-zinc-500",
    cancelled:
      "bg-zinc-100 text-zinc-500",
  };

  const labels: Record<string, string> = {
    pending: "Pendiente",
    accepted: "Aceptada",
    declined: "Rechazada",
    countered: "Contraoferta",
    expired: "Expirada",
    cancelled: "Cancelada",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
        styles[status] ||
        "bg-zinc-100 text-zinc-500"
      }`}
    >
      {labels[status] || status}
    </span>
  );
}