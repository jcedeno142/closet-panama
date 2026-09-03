"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Check,
  Clock3,
  MessageCircle,
  Repeat2,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Offer = {
  id: string;
  product_id: string;
  buyer_id: string;
  seller_id: string;
  amount: number;
  accepted_amount: number | null;
  status: string;
  created_at: string;
};

type OfferEvent = {
  id: string;
  offer_id: string;
  actor_id: string;
  event_type:
    | "offer"
    | "counter"
    | "accepted"
    | "declined"
    | "cancelled";
  amount: number | null;
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
  buyer?: Profile;
  seller?: Profile;
  events: OfferEvent[];
};

export default function InboxPage() {
  const supabase = createClient();

  const [currentUserId, setCurrentUserId] = useState("");

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

  const [counterOffer, setCounterOffer] =
    useState<OfferCard | null>(null);

  const [counterAmount, setCounterAmount] =
    useState("");

  const [submittingCounter, setSubmittingCounter] =
    useState(false);

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

    setCurrentUserId(user.id);

    // RECEIVED
    const { data: receivedData, error: receivedError } =
      await supabase
        .from("offers")
        .select(`
          id,
          product_id,
          buyer_id,
          seller_id,
          amount,
          accepted_amount,
          status,
          created_at
        `)
        .eq("seller_id", user.id)
        .order("created_at", {
          ascending: false,
        });

    if (receivedError) {
      setMessage(receivedError.message);
      setLoading(false);
      return;
    }

    // SENT
    const { data: sentData, error: sentError } =
      await supabase
        .from("offers")
        .select(`
          id,
          product_id,
          buyer_id,
          seller_id,
          amount,
          accepted_amount,
          status,
          created_at
        `)
        .eq("buyer_id", user.id)
        .order("created_at", {
          ascending: false,
        });

    if (sentError) {
      setMessage(sentError.message);
      setLoading(false);
      return;
    }

    const allOffers = [
      ...(receivedData || []),
      ...(sentData || []),
    ] as Offer[];

    const offerIds = [
      ...new Set(
        allOffers.map((offer) => offer.id)
      ),
    ];

    const productIds = [
      ...new Set(
        allOffers.map(
          (offer) => offer.product_id
        )
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

    let eventMap: Record<string, OfferEvent[]> =
      {};

    // PRODUCTS
    if (productIds.length > 0) {
      const {
        data: productData,
        error: productError,
      } = await supabase
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
            ].sort(
              (a, b) =>
                a.position - b.position
            ),
          },
        ])
      );
    }

    // PROFILES
    if (profileIds.length > 0) {
      const {
        data: profileData,
        error: profileError,
      } = await supabase
        .from("profiles")
        .select(
          "id, username, display_name"
        )
        .in("id", profileIds);

      if (profileError) {
        setMessage(profileError.message);
        setLoading(false);
        return;
      }

      profileMap = Object.fromEntries(
        (profileData || []).map(
          (profile) => [
            profile.id,
            profile,
          ]
        )
      );
    }

    // NEGOTIATION EVENTS
    if (offerIds.length > 0) {
      const {
        data: eventData,
        error: eventError,
      } = await supabase
        .from("offer_events")
        .select(`
          id,
          offer_id,
          actor_id,
          event_type,
          amount,
          created_at
        `)
        .in("offer_id", offerIds)
        .order("created_at", {
          ascending: true,
        });

      if (eventError) {
        setMessage(eventError.message);
        setLoading(false);
        return;
      }

      for (const event of eventData || []) {
        if (!eventMap[event.offer_id]) {
          eventMap[event.offer_id] = [];
        }

        eventMap[event.offer_id].push(
          event as OfferEvent
        );
      }
    }

    const receivedCards: OfferCard[] = (
      receivedData || []
    ).map((offer) => ({
      ...offer,
      product:
        productMap[offer.product_id],
      buyer:
        profileMap[offer.buyer_id],
      seller:
        profileMap[offer.seller_id],
      events:
        eventMap[offer.id] || [],
    }));

    const sentCards: OfferCard[] = (
      sentData || []
    ).map((offer) => ({
      ...offer,
      product:
        productMap[offer.product_id],
      buyer:
        profileMap[offer.buyer_id],
      seller:
        profileMap[offer.seller_id],
      events:
        eventMap[offer.id] || [],
    }));

    setReceivedOffers(receivedCards);

    setSentOffers(sentCards);

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadInbox();
  }, [loadInbox]);

  function getLatestMoneyEvent(
    offer: OfferCard
  ) {
    return [...offer.events]
      .reverse()
      .find(
        (event) =>
          event.event_type === "offer" ||
          event.event_type === "counter"
      );
  }

  function canCurrentUserRespond(
    offer: OfferCard
  ) {
    if (
      offer.status === "accepted" ||
      offer.status === "declined" ||
      offer.status === "cancelled"
    ) {
      return false;
    }

    const latest =
      getLatestMoneyEvent(offer);

    if (!latest) return false;

    // Person who made the last monetary
    // offer must wait for the other person.
    return (
      latest.actor_id !== currentUserId
    );
  }

  function openCounterModal(
    offer: OfferCard
  ) {
    const latest =
      getLatestMoneyEvent(offer);

    if (!latest?.amount) return;

    setCounterOffer(offer);

    setCounterAmount("");
    setMessage("");
  }

  async function submitCounterOffer(
    event: React.FormEvent
  ) {
    event.preventDefault();

    if (!counterOffer) return;

    const amount =
      Number(counterAmount);

    if (!amount || amount <= 0) {
      setMessage(
        "Ingresa una contraoferta válida."
      );
      return;
    }

    const latest =
      getLatestMoneyEvent(
        counterOffer
      );

    if (!latest?.amount) {
      setMessage(
        "No pudimos encontrar la última oferta."
      );
      return;
    }

    // Prevent offering full listing price
    if (
      counterOffer.product &&
      amount >=
        Number(
          counterOffer.product.price
        )
    ) {
      setMessage(
        "La contraoferta debe ser menor que el precio publicado."
      );
      return;
    }

    if (
      amount === Number(latest.amount)
    ) {
      setMessage(
        "La contraoferta debe ser diferente a la oferta actual."
      );
      return;
    }

    setSubmittingCounter(true);

    setMessage("");

    // Insert new negotiation event
    const { error: eventError } =
      await supabase
        .from("offer_events")
        .insert({
          offer_id:
            counterOffer.id,
          actor_id:
            currentUserId,
          event_type:
            "counter",
          amount,
        });

    if (eventError) {
      setMessage(
        eventError.message
      );

      setSubmittingCounter(false);

      return;
    }

    // Keep main offer open
    const { error: offerError } =
      await supabase
        .from("offers")
        .update({
          status: "countered",
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", counterOffer.id);

    if (offerError) {
      setMessage(
        offerError.message
      );

      setSubmittingCounter(false);

      return;
    }

    setCounterOffer(null);

    setCounterAmount("");

    setSubmittingCounter(false);

    await loadInbox();
  }

  async function acceptCurrentOffer(
    offer: OfferCard
  ) {
    const latest =
      getLatestMoneyEvent(offer);

    if (!latest?.amount) {
      setMessage(
        "No pudimos encontrar la oferta actual."
      );

      return;
    }

    const finalAmount =
      Number(latest.amount);

    const {
      error: eventError,
    } = await supabase
      .from("offer_events")
      .insert({
        offer_id: offer.id,
        actor_id:
          currentUserId,
        event_type:
          "accepted",
        amount: finalAmount,
      });

    if (eventError) {
      setMessage(
        eventError.message
      );

      return;
    }

    const {
      error: offerError,
    } = await supabase
      .from("offers")
      .update({
        status: "accepted",
        accepted_amount:
          finalAmount,
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", offer.id);

    if (offerError) {
      setMessage(
        offerError.message
      );

      return;
    }

    await loadInbox();
  }

  async function declineOffer(
    offer: OfferCard
  ) {
    const {
      error: eventError,
    } = await supabase
      .from("offer_events")
      .insert({
        offer_id: offer.id,
        actor_id:
          currentUserId,
        event_type:
          "declined",
        amount: null,
      });

    if (eventError) {
      setMessage(
        eventError.message
      );

      return;
    }

    const {
      error: offerError,
    } = await supabase
      .from("offers")
      .update({
        status: "declined",
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", offer.id);

    if (offerError) {
      setMessage(
        offerError.message
      );

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
                setActiveTab(
                  "received"
                )
              }
              className={`flex-1 border-b-2 py-3 text-sm font-bold ${
                activeTab ===
                "received"
                  ? "border-black text-black"
                  : "border-transparent text-zinc-400"
              }`}
            >
              Recibidas

              {receivedOffers.length >
                0 && (
                <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px]">
                  {
                    receivedOffers.length
                  }
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() =>
                setActiveTab("sent")
              }
              className={`flex-1 border-b-2 py-3 text-sm font-bold ${
                activeTab ===
                "sent"
                  ? "border-black text-black"
                  : "border-transparent text-zinc-400"
              }`}
            >
              Enviadas

              {sentOffers.length >
                0 && (
                <span className="ml-2 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px]">
                  {
                    sentOffers.length
                  }
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

        {!loading &&
          message && (
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
                {activeTab ===
                "received"
                  ? "No tienes ofertas recibidas"
                  : "No has enviado ofertas"}
              </h2>

            </div>
          )}

        {!loading &&
          offers.length > 0 && (
            <section className="divide-y divide-zinc-100">

              {offers.map(
                (offer) => {
                  const cover =
                    offer.product
                      ?.product_images?.[0]
                      ?.image_url;

                  const otherUser =
                    activeTab ===
                    "received"
                      ? offer.buyer
                      : offer.seller;

                  const latest =
                    getLatestMoneyEvent(
                      offer
                    );

                  const canRespond =
                    canCurrentUserRespond(
                      offer
                    );

                  return (
                    <article
                      key={offer.id}
                      className="px-4 py-5"
                    >

                      {/* PRODUCT */}
                      <div className="flex gap-4">

                        <Link
                          href={`/product/${offer.product_id}`}
                          className="h-28 w-24 shrink-0 overflow-hidden rounded-xl bg-zinc-100"
                        >

                          {cover ? (
                            <img
                              src={
                                cover
                              }
                              alt={
                                offer
                                  .product
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

                        <div className="min-w-0 flex-1">

                          <p className="text-xs text-zinc-400">
                            {activeTab ===
                            "received"
                              ? "Negociación con comprador"
                              : "Negociación con vendedor"}
                          </p>

                          <p className="mt-1 truncate text-sm font-bold">
                            @
                            {otherUser?.username ||
                              "usuario"}
                          </p>

                          <Link
                            href={`/product/${offer.product_id}`}
                          >
                            <h2 className="mt-2 truncate text-sm font-semibold">
                              {offer
                                .product
                                ?.title ||
                                "Producto"}
                            </h2>
                          </Link>

                          {offer.product && (
                            <p className="mt-1 text-xs text-zinc-400">
                              Precio original: $
                              {Number(
                                offer
                                  .product
                                  .price
                              ).toFixed(
                                2
                              )}
                            </p>
                          )}

                        </div>
                      </div>

                      {/* NEGOTIATION HISTORY */}
                      <div className="mt-5 space-y-3">

                        {offer.events
                          .filter(
                            (
                              event
                            ) =>
                              event.event_type ===
                                "offer" ||
                              event.event_type ===
                                "counter"
                          )
                          .map(
                            (
                              event
                            ) => {
                              const isMe =
                                event.actor_id ===
                                currentUserId;

                              return (
                                <div
                                  key={
                                    event.id
                                  }
                                  className={`flex ${
                                    isMe
                                      ? "justify-end"
                                      : "justify-start"
                                  }`}
                                >
                                  <div
                                    className={`max-w-[78%] rounded-2xl px-4 py-3 ${
                                      isMe
                                        ? "bg-black text-white"
                                        : "bg-zinc-100 text-black"
                                    }`}
                                  >
                                    <p
                                      className={`text-[10px] font-semibold ${
                                        isMe
                                          ? "text-zinc-300"
                                          : "text-zinc-500"
                                      }`}
                                    >
                                      {isMe
                                        ? "Tú"
                                        : event.actor_id ===
                                          offer.buyer_id
                                        ? "Comprador"
                                        : "Vendedor"}
                                    </p>

                                    <p className="mt-1 text-lg font-black">
                                      $
                                      {Number(
                                        event.amount
                                      ).toFixed(
                                        2
                                      )}
                                    </p>

                                    <p
                                      className={`mt-1 text-[10px] ${
                                        isMe
                                          ? "text-zinc-300"
                                          : "text-zinc-500"
                                      }`}
                                    >
                                      {event.event_type ===
                                      "offer"
                                        ? "Oferta"
                                        : "Contraoferta"}
                                    </p>
                                  </div>
                                </div>
                              );
                            }
                          )}

                      </div>

                      {/* CURRENT OFFER */}
                      {latest?.amount &&
                        offer.status !==
                          "accepted" &&
                        offer.status !==
                          "declined" && (
                          <div className="mt-5 rounded-xl bg-zinc-50 p-4">

                            <p className="text-xs text-zinc-500">
                              Oferta actual
                            </p>

                            <p className="mt-1 text-2xl font-black">
                              $
                              {Number(
                                latest.amount
                              ).toFixed(
                                2
                              )}
                            </p>

                          </div>
                        )}

                      {/* STATUS */}
                      <div className="mt-4">

                        <StatusBadge
                          status={
                            offer.status
                          }
                        />

                      </div>

                      {/* ACTIONS */}
                      {canRespond && (
                        <div className="mt-4 grid grid-cols-3 gap-2">

                          <button
                            type="button"
                            onClick={() =>
                              acceptCurrentOffer(
                                offer
                              )
                            }
                            className="flex items-center justify-center gap-1 rounded-xl bg-black py-3 text-xs font-bold text-white"
                          >
                            <Check
                              size={
                                15
                              }
                            />

                            Aceptar
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              openCounterModal(
                                offer
                              )
                            }
                            className="flex items-center justify-center gap-1 rounded-xl border border-black py-3 text-xs font-bold"
                          >
                            <Repeat2
                              size={
                                15
                              }
                            />

                            Contraoferta
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              declineOffer(
                                offer
                              )
                            }
                            className="flex items-center justify-center gap-1 rounded-xl border border-zinc-300 py-3 text-xs font-bold"
                          >
                            <X
                              size={
                                15
                              }
                            />

                            Rechazar
                          </button>

                        </div>
                      )}

                      {!canRespond &&
                        offer.status !==
                          "accepted" &&
                        offer.status !==
                          "declined" && (
                          <div className="mt-4 flex items-center gap-2 rounded-xl bg-zinc-50 p-3 text-xs text-zinc-500">

                            <Clock3
                              size={
                                14
                              }
                            />

                            Esperando respuesta de la otra persona.

                          </div>
                        )}

                      {offer.status ===
                        "accepted" && (
                        <div className="mt-4 rounded-xl bg-green-50 p-4">

                          <p className="text-xs font-semibold text-green-700">
                            Oferta aceptada
                          </p>

                          <p className="mt-1 text-xl font-black text-green-900">
                            $
                            {Number(
                              offer.accepted_amount ||
                                latest?.amount ||
                                offer.amount
                            ).toFixed(
                              2
                            )}
                          </p>

                        </div>
                      )}

                    </article>
                  );
                }
              )}

            </section>
          )}
      </div>

      {/* COUNTEROFFER MODAL */}
      {counterOffer && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 sm:items-center">

          <div className="w-full max-w-md rounded-t-3xl bg-white p-5 sm:rounded-3xl">

            <div className="flex items-center justify-between">

              <div>

                <h2 className="text-xl font-bold">
                  Contraofertar
                </h2>

                <p className="mt-1 text-sm text-zinc-500">
                  Última oferta: $
                  {Number(
                    getLatestMoneyEvent(
                      counterOffer
                    )?.amount ||
                      0
                  ).toFixed(2)}
                </p>

              </div>

              <button
                type="button"
                onClick={() => {
                  setCounterOffer(
                    null
                  );

                  setCounterAmount(
                    ""
                  );

                  setMessage("");
                }}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100"
              >
                <X size={18} />
              </button>

            </div>

            <form
              onSubmit={
                submitCounterOffer
              }
              className="mt-6"
            >

              <label className="text-sm font-bold">
                Nueva oferta
              </label>

              <div className="mt-2 flex items-center rounded-2xl border border-zinc-200 px-4">

                <span className="text-lg font-bold">
                  $
                </span>

                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={
                    counterAmount
                  }
                  onChange={(
                    event
                  ) =>
                    setCounterAmount(
                      event
                        .target
                        .value
                    )
                  }
                  placeholder="0.00"
                  className="w-full px-3 py-4 text-xl font-bold outline-none"
                  autoFocus
                />

              </div>

              {message && (
                <div className="mt-4 rounded-xl bg-zinc-100 p-4 text-sm">
                  {message}
                </div>
              )}

              <button
                type="submit"
                disabled={
                  submittingCounter
                }
                className="mt-5 w-full rounded-2xl bg-black py-4 text-sm font-bold text-white disabled:opacity-50"
              >
                {submittingCounter
                  ? "Enviando..."
                  : "Enviar contraoferta"}
              </button>

            </form>

          </div>
        </div>
      )}

    </main>
  );
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const styles: Record<
    string,
    string
  > = {
    pending:
      "bg-amber-50 text-amber-700",

    countered:
      "bg-blue-50 text-blue-700",

    accepted:
      "bg-green-50 text-green-700",

    declined:
      "bg-red-50 text-red-700",

    cancelled:
      "bg-zinc-100 text-zinc-500",
  };

  const labels: Record<
    string,
    string
  > = {
    pending:
      "Negociación abierta",

    countered:
      "Negociación abierta",

    accepted:
      "Aceptada",

    declined:
      "Rechazada",

    cancelled:
      "Cancelada",
  };

  return (
    <span
      className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
        styles[status] ||
        "bg-zinc-100 text-zinc-500"
      }`}
    >
      {labels[status] ||
        status}
    </span>
  );
}