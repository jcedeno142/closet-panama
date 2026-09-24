"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  Heart,
  MapPin,
  MoreHorizontal,
  ShieldCheck,
  Star,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Product = {
  id: string;
  title: string;
  description: string | null;
  brand: string | null;
  category: string | null;
  size: string | null;
  color: string | null;
  condition: string;
  price: number;
  city: string | null;
  province: string | null;
  seller_id: string;
  status: string;
};

type Seller = {
  username: string;
  display_name: string | null;
  verified: boolean;
};

type ProductImage = {
  id: string;
  image_url: string;
  position: number;
};

export default function ProductPage() {
  const supabase = createClient();
  const params = useParams();

  const productId = params.id as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [seller, setSeller] = useState<Seller | null>(null);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [activeImage, setActiveImage] = useState(0);
  const [currentUserId, setCurrentUserId] = useState("");
  const [isFavorite, setIsFavorite] = useState(false);
  const [favoriteLoading, setFavoriteLoading] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [reportMessage, setReportMessage] = useState("");
  const [submittingReport, setSubmittingReport] = useState(false);

  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerAmount, setOfferAmount] = useState("");
  const [offerMessage, setOfferMessage] = useState("");
  const [submittingOffer, setSubmittingOffer] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [shareMessage, setShareMessage] = useState("");

  useEffect(() => {
    async function loadProduct() {
      setLoading(true);
      setError("");
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const user = session?.user ?? null;

      setCurrentUserId(user?.id || "");
      const { data: productData, error: productError } = await supabase
        .from("products")
        .select("*")
        .eq("id", productId)
        .maybeSingle();

      if (productError) {
        setError(productError.message);
        setLoading(false);
        return;
      }

      if (!productData) {
        setError("Este artículo no existe.");
        setLoading(false);
        return;
      }

      setProduct(productData);

      /*
       * LOAD FAVORITE STATUS
       */
      if (user) {
        const { data: favoriteData, error: favoriteError } = await supabase
          .from("favorites")
          .select("user_id, product_id")
          .eq("user_id", user.id)
          .eq("product_id", productId)
          .maybeSingle();

        if (favoriteError) {
          console.error("Load favorite error:", favoriteError);
        }

        setIsFavorite(!!favoriteData);
      } else {
        setIsFavorite(false);
      }

      const { data: sellerData, error: sellerError } = await supabase
        .from("profiles")
        .select("username, display_name, verified")
        .eq("id", productData.seller_id)
        .maybeSingle();

      if (sellerError) {
        setError(sellerError.message);
        setLoading(false);
        return;
      }

      setSeller(sellerData);

      const { data: imageData, error: imageError } = await supabase
        .from("product_images")
        .select("id, image_url, position")
        .eq("product_id", productId)
        .order("position", { ascending: true });

      if (imageError) {
        setError(imageError.message);
        setLoading(false);
        return;
      }

      setImages(imageData || []);
      setActiveImage(0);
      setLoading(false);
    }

    loadProduct();
  }, [productId, supabase]);

  async function toggleFavorite() {
    if (favoriteLoading) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/auth";
      return;
    }

    setFavoriteLoading(true);

    try {
      /*
       * Check the database directly instead of relying only
       * on the local isFavorite state.
       */
      const { data: existingFavorite, error: checkError } = await supabase
        .from("favorites")
        .select("user_id, product_id")
        .eq("user_id", user.id)
        .eq("product_id", productId)
        .maybeSingle();

      if (checkError) {
        console.error("Check favorite error:", checkError);
        return;
      }

      /*
       * Already favorited -> remove it
       */
      if (existingFavorite) {
        const { error: deleteError } = await supabase
          .from("favorites")
          .delete()
          .eq("user_id", user.id)
          .eq("product_id", productId);

        if (deleteError) {
          console.error("Remove favorite error:", deleteError);
          return;
        }

        setIsFavorite(false);
        return;
      }

      /*
       * Not favorited -> add it
       */
      const { error: insertError } = await supabase.from("favorites").insert({
        user_id: user.id,
        product_id: productId,
      });

      if (insertError) {
        console.error("Add favorite error:", insertError);
        return;
      }

      setIsFavorite(true);
    } finally {
      setFavoriteLoading(false);
    }
  }

  async function submitReport(e: React.FormEvent) {
    e.preventDefault();

    if (!product) return;

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const user = session?.user;

    if (!user) {
      window.location.href = "/auth";
      return;
    }

    if (user.id === product.seller_id) {
      setReportMessage("No puedes reportar tu propia publicación.");
      return;
    }

    if (!reportReason) {
      setReportMessage("Selecciona un motivo.");
      return;
    }

    setSubmittingReport(true);
    setReportMessage("");

    const { error } = await supabase.from("reports").insert({
      reporter_id: user.id,
      product_id: product.id,
      seller_id: product.seller_id,
      reason: reportReason,
      details: reportDetails.trim() || null,
    });

    if (error) {
      console.error("Submit report error:", error);

      if (error.code === "23505") {
        setReportMessage(
          "Ya reportaste esta publicación. Nuestro equipo revisará tu reporte.",
        );
      } else {
        setReportMessage("No pudimos enviar el reporte. Inténtalo nuevamente.");
      }

      setSubmittingReport(false);
      return;
    }

    setReportMessage(
      "Reporte enviado. Gracias por ayudarnos a mantener segura la comunidad.",
    );

    setSubmittingReport(false);

    setTimeout(() => {
      setShowReportModal(false);
      setReportReason("");
      setReportDetails("");
      setReportMessage("");
    }, 1500);
  }

  async function shareProduct() {
    if (!product) return;

    const url = window.location.href;

    try {
      if (navigator.share) {
        await navigator.share({
          title: product.title,
          text: `Mira ${product.title} en Closet Panamá`,
          url,
        });

        setShowMoreMenu(false);
        return;
      }

      await navigator.clipboard.writeText(url);

      setShareMessage("Enlace copiado.");
    } catch (error) {
      /*
       * Ignore AbortError because it simply means
       * the user closed the native share window.
       */
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      console.error("Share error:", error);

      try {
        await navigator.clipboard.writeText(url);
        setShareMessage("Enlace copiado.");
      } catch {
        setShareMessage("No pudimos copiar el enlace.");
      }
    }
  }

  async function openOfferModal() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/auth";
      return;
    }

    if (!product) return;

    if (product.status === "sold") {
      return;
    }

    if (user.id === product.seller_id) {
      setOfferMessage("No puedes hacer una oferta por tu propio artículo.");
      return;
    }

    setOfferAmount("");
    setOfferMessage("");
    setShowOfferModal(true);
  }

  async function submitOffer(e: React.FormEvent) {
    e.preventDefault();

    if (!product) return;

    if (product.status === "sold") {
      setOfferMessage("Este artículo ya fue vendido.");
      return;
    }

    const amount = Number(offerAmount);

    if (!offerAmount || amount <= 0) {
      setOfferMessage("Ingresa una oferta válida.");
      return;
    }

    if (amount >= Number(product.price)) {
      setOfferMessage(
        "Tu oferta debe ser menor que el precio publicado. Puedes comprarlo directamente por el precio completo.",
      );
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/auth";
      return;
    }

    setSubmittingOffer(true);
    setOfferMessage("");

    const { error } = await supabase.from("offers").insert({
      product_id: product.id,
      buyer_id: user.id,
      seller_id: product.seller_id,
      amount,
      status: "pending",
    });

    if (error) {
      setOfferMessage(error.message);
      setSubmittingOffer(false);
      return;
    }

    setOfferMessage("Oferta enviada correctamente.");
    setSubmittingOffer(false);

    setTimeout(() => {
      setShowOfferModal(false);
      setOfferAmount("");
      setOfferMessage("");
    }, 900);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white text-black">
        <p className="text-sm text-zinc-500">Cargando artículo...</p>
      </main>
    );
  }

  if (error || !product) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-5 text-black">
        <div className="text-center">
          <p className="font-bold">No pudimos cargar el artículo.</p>

          <p className="mt-2 text-sm text-zinc-500">{error}</p>

          <Link
            href="/"
            className="mt-5 inline-block rounded-xl bg-black px-5 py-3 text-sm font-bold text-white"
          >
            Volver
          </Link>
        </div>
      </main>
    );
  }

  const isOwner = !!currentUserId && currentUserId === product.seller_id;
  const isSold = product.status === "sold";

  const conditionLabels: Record<string, string> = {
    new: "Nuevo",
    like_new: "Como nuevo",
    good: "Buen estado",
    fair: "Estado aceptable",
  };

  const location = [product.city, product.province].filter(Boolean).join(", ");

  const currentImage = images[activeImage]?.image_url;

  return (
    <main className="min-h-screen bg-white pb-28 text-black">
      <div className="mx-auto max-w-md">
        {/* IMAGE AREA */}
        <section>
          <div className="relative aspect-[3/4] overflow-hidden bg-zinc-100">
            {currentImage ? (
              <img
                src={currentImage}
                alt={product.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-zinc-400">
                Sin fotos
              </div>
            )}

            {isSold && (
              <div className="absolute bottom-4 left-4 rounded-full bg-black px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white">
                Vendido
              </div>
            )}

            <div className="absolute left-0 right-0 top-0 flex items-center justify-between p-4">
              <Link
                href="/"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur"
              >
                <ArrowLeft size={20} />
              </Link>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={toggleFavorite}
                  disabled={favoriteLoading}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur transition active:scale-90 disabled:opacity-50"
                  aria-label={
                    isFavorite ? "Quitar de favoritos" : "Guardar en favoritos"
                  }
                >
                  <Heart
                    size={20}
                    className={
                      isFavorite ? "fill-red-500 text-red-500" : "text-black"
                    }
                  />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShareMessage("");
                    setShowMoreMenu(true);
                  }}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur transition active:scale-90"
                  aria-label="Más opciones"
                >
                  <MoreHorizontal size={20} />
                </button>
              </div>
            </div>

            {images.length > 1 && (
              <div className="absolute bottom-4 right-4 rounded-full bg-black/70 px-3 py-1.5 text-xs font-semibold text-white">
                {activeImage + 1} / {images.length}
              </div>
            )}
          </div>

          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto px-4 py-3">
              {images.map((image, index) => (
                <button
                  key={image.id}
                  onClick={() => setActiveImage(index)}
                  className={`relative h-20 w-16 shrink-0 overflow-hidden rounded-lg border-2 ${
                    activeImage === index
                      ? "border-black"
                      : "border-transparent"
                  }`}
                >
                  <img
                    src={image.image_url}
                    alt={`${product.title} ${index + 1}`}
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </section>

        {/* PRODUCT INFO */}
        <section className="px-5 py-6">
          {product.brand && (
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-400">
              {product.brand}
            </p>
          )}

          <h1 className="mt-2 text-2xl font-bold">{product.title}</h1>

          <p className="mt-3 text-3xl font-black">
            ${Number(product.price).toFixed(2)}
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {product.size && <InfoPill label="Talla" value={product.size} />}

            <InfoPill
              label="Condición"
              value={conditionLabels[product.condition] || product.condition}
            />

            {product.color && <InfoPill label="Color" value={product.color} />}
          </div>

          {location && (
            <div className="mt-6 flex items-center gap-2 text-sm text-zinc-500">
              <MapPin size={16} />
              {location}
            </div>
          )}
        </section>

        <div className="h-2 bg-zinc-50" />

        {/* DESCRIPTION */}
        <section className="px-5 py-6">
          <h2 className="font-bold">Descripción</h2>

          <p className="mt-3 whitespace-pre-line text-sm leading-6 text-zinc-600">
            {product.description || "Sin descripción."}
          </p>
        </section>

        <div className="h-2 bg-zinc-50" />

        {/* SELLER */}
        {seller && (
          <section className="px-5 py-6">
            <h2 className="mb-4 font-bold">Vendido por</h2>

            <Link
              href={`/seller/${seller.username}`}
              className="flex items-center"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black text-lg font-bold text-white">
                {(seller.display_name || seller.username)
                  .charAt(0)
                  .toUpperCase()}
              </div>

              <div className="ml-3 flex-1">
                <div className="flex items-center gap-1">
                  <p className="font-bold">@{seller.username}</p>

                  {seller.verified && <ShieldCheck size={15} />}
                </div>

                <div className="mt-1 flex items-center gap-1 text-xs text-zinc-500">
                  <Star size={13} />
                  <span>Nuevo vendedor</span>
                </div>
              </div>

              <span className="text-sm font-semibold">Ver closet →</span>
            </Link>
          </section>
        )}

        <div className="h-2 bg-zinc-50" />

        {/* BUYER PROTECTION */}
        <section className="px-5 py-6">
          <div className="flex gap-3">
            <ShieldCheck size={22} />

            <div>
              <h3 className="text-sm font-bold">Compra protegida</h3>

              <p className="mt-1 text-xs leading-5 text-zinc-500">
                Tu pago permanecerá protegido hasta que recibas tu compra.
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* BOTTOM ACTION BAR */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-200 bg-white p-3">
        <div className="mx-auto flex max-w-md gap-2">
          {isSold ? (
            <div className="flex-1 rounded-2xl bg-zinc-100 px-4 py-4 text-center text-sm font-black uppercase tracking-[0.15em] text-zinc-500">
              Vendido
            </div>
          ) : isOwner ? (
            <Link
              href={`/product/${product.id}/edit`}
              className="flex-1 rounded-2xl bg-black px-4 py-4 text-center text-sm font-bold text-white"
            >
              Editar publicación
            </Link>
          ) : (
            <>
              <button
                type="button"
                onClick={openOfferModal}
                className="flex-1 rounded-2xl border border-black px-4 py-4 text-sm font-bold"
              >
                Hacer oferta
              </button>

              <Link
                href={`/checkout/${product.id}`}
                className="flex flex-1 items-center justify-center rounded-2xl bg-black px-4 py-4 text-center text-sm font-bold text-white"
              >
                Comprar · ${Number(product.price).toFixed(2)}
              </Link>
            </>
          )}
        </div>
      </div>

      {/* MORE OPTIONS MENU */}
      {showMoreMenu && (
        <div
          className="fixed inset-0 z-[110] flex items-end justify-center bg-black/40"
          onClick={() => setShowMoreMenu(false)}
        >
          <div
            className="w-full max-w-md rounded-t-3xl bg-white px-5 pb-8 pt-4"
            onClick={(event) => event.stopPropagation()}
          >
            {/* HANDLE */}
            <div className="mx-auto mb-5 h-1.5 w-10 rounded-full bg-zinc-300" />

            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Opciones</h2>

              <button
                type="button"
                onClick={() => setShowMoreMenu(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100"
              >
                <X size={17} />
              </button>
            </div>

            <div className="mt-5 space-y-2">
              {/* OWNER */}
              {isOwner && (
                <Link
                  href={`/product/${product.id}/edit`}
                  className="flex w-full items-center rounded-2xl bg-zinc-100 px-4 py-4 text-sm font-bold"
                >
                  Editar publicación
                </Link>
              )}

              {/* SHARE */}
              <button
                type="button"
                onClick={shareProduct}
                className="flex w-full items-center rounded-2xl bg-zinc-100 px-4 py-4 text-left text-sm font-bold"
              >
                Compartir publicación
              </button>

              {/* REPORT — ONLY OTHER SELLERS */}
              {!isOwner && (
                <button
                  type="button"
                  onClick={async () => {
                    const {
                      data: { session },
                    } = await supabase.auth.getSession();

                    if (!session?.user) {
                      window.location.href = "/auth";
                      return;
                    }

                    setShowMoreMenu(false);
                    setReportReason("");
                    setReportDetails("");
                    setReportMessage("");
                    setShowReportModal(true);
                  }}
                  className="flex w-full items-center rounded-2xl bg-zinc-100 px-4 py-4 text-left text-sm font-bold text-red-600"
                >
                  Reportar publicación
                </button>
              )}
            </div>

            {shareMessage && (
              <div className="mt-4 rounded-xl bg-zinc-100 p-3 text-center text-sm font-medium">
                {shareMessage}
              </div>
            )}

            <button
              type="button"
              onClick={() => setShowMoreMenu(false)}
              className="mt-5 w-full rounded-2xl border border-zinc-200 py-4 text-sm font-bold"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* REPORT MODAL */}
      {showReportModal && (
        <div
          className="fixed inset-0 z-[120] flex items-end justify-center bg-black/50 sm:items-center"
          onClick={() => {
            if (!submittingReport) {
              setShowReportModal(false);
            }
          }}
        >
          <div
            className="w-full max-w-md rounded-t-3xl bg-white p-5 sm:rounded-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-5 h-1.5 w-10 rounded-full bg-zinc-300 sm:hidden" />

            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">Reportar publicación</h2>

                <p className="mt-1 text-sm text-zinc-500">
                  Cuéntanos qué sucede con este artículo.
                </p>
              </div>

              <button
                type="button"
                disabled={submittingReport}
                onClick={() => setShowReportModal(false)}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={submitReport} className="mt-6">
              <div className="space-y-2">
                <ReportOption
                  value="counterfeit"
                  label="Artículo falso o imitación"
                  selected={reportReason}
                  onChange={setReportReason}
                />

                <ReportOption
                  value="scam"
                  label="Posible estafa"
                  selected={reportReason}
                  onChange={setReportReason}
                />

                <ReportOption
                  value="prohibited"
                  label="Artículo prohibido"
                  selected={reportReason}
                  onChange={setReportReason}
                />

                <ReportOption
                  value="inappropriate"
                  label="Contenido inapropiado"
                  selected={reportReason}
                  onChange={setReportReason}
                />

                <ReportOption
                  value="other"
                  label="Otro"
                  selected={reportReason}
                  onChange={setReportReason}
                />
              </div>

              <div className="mt-5">
                <label className="text-sm font-bold">
                  Detalles adicionales
                </label>

                <textarea
                  value={reportDetails}
                  onChange={(e) => setReportDetails(e.target.value)}
                  rows={4}
                  maxLength={1000}
                  placeholder="Agrega información que nos ayude a revisar el reporte..."
                  className="mt-2 w-full resize-none rounded-2xl border border-zinc-200 p-4 text-sm outline-none focus:border-black"
                />

                <p className="mt-1 text-right text-xs text-zinc-400">
                  {reportDetails.length}/1000
                </p>
              </div>

              {reportMessage && (
                <div className="mt-4 rounded-xl bg-zinc-100 p-4 text-sm">
                  {reportMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={submittingReport || !reportReason}
                className="mt-5 w-full rounded-2xl bg-black py-4 text-sm font-bold text-white disabled:opacity-40"
              >
                {submittingReport ? "Enviando..." : "Enviar reporte"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* OFFER MODAL */}
      {showOfferModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 sm:items-center">
          <div className="w-full max-w-md rounded-t-3xl bg-white p-5 sm:rounded-3xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">Hacer oferta</h2>

                <p className="mt-1 text-sm text-zinc-500">
                  Precio publicado: ${Number(product.price).toFixed(2)}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowOfferModal(false);
                  setOfferMessage("");
                }}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={submitOffer} className="mt-6">
              <label className="text-sm font-bold">Tu oferta</label>

              <div className="mt-2 flex items-center rounded-2xl border border-zinc-200 px-4">
                <span className="text-lg font-bold">$</span>

                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={offerAmount}
                  onChange={(e) => setOfferAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full px-3 py-4 text-xl font-bold outline-none"
                />
              </div>

              <p className="mt-2 text-xs text-zinc-400">
                El vendedor podrá aceptar, rechazar o hacer una contraoferta.
              </p>

              {offerMessage && (
                <div className="mt-4 rounded-xl bg-zinc-100 p-4 text-sm">
                  {offerMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={submittingOffer}
                className="mt-5 w-full rounded-2xl bg-black py-4 text-sm font-bold text-white disabled:opacity-50"
              >
                {submittingOffer ? "Enviando..." : "Enviar oferta"}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-zinc-100 px-3 py-2">
      <p className="text-[9px] font-semibold uppercase tracking-wide text-zinc-400">
        {label}
      </p>

      <p className="mt-0.5 text-xs font-bold">{value}</p>
    </div>
  );
}

function ReportOption({
  value,
  label,
  selected,
  onChange,
}: {
  value: string;
  label: string;
  selected: string;
  onChange: (value: string) => void;
}) {
  const active = selected === value;

  return (
    <button
      type="button"
      onClick={() => onChange(value)}
      className={`flex w-full items-center justify-between rounded-2xl border px-4 py-4 text-left text-sm font-semibold transition ${
        active ? "border-black bg-zinc-50" : "border-zinc-200 bg-white"
      }`}
    >
      <span>{label}</span>

      <span
        className={`flex h-5 w-5 items-center justify-center rounded-full border ${
          active ? "border-black" : "border-zinc-300"
        }`}
      >
        {active && <span className="h-2.5 w-2.5 rounded-full bg-black" />}
      </span>
    </button>
  );
}
