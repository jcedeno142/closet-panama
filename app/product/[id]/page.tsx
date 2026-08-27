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

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [showOfferModal, setShowOfferModal] = useState(false);
  const [offerAmount, setOfferAmount] = useState("");
  const [offerMessage, setOfferMessage] = useState("");
  const [submittingOffer, setSubmittingOffer] = useState(false);

  useEffect(() => {
    async function loadProduct() {
      setLoading(true);
      setError("");

      const { data: productData, error: productError } =
        await supabase
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

      const { data: sellerData, error: sellerError } =
        await supabase
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

      const { data: imageData, error: imageError } =
        await supabase
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

  async function openOfferModal() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/auth";
      return;
    }

    if (!product) return;

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

    const amount = Number(offerAmount);

    if (!offerAmount || amount <= 0) {
      setOfferMessage("Ingresa una oferta válida.");
      return;
    }

    if (amount >= Number(product.price)) {
      setOfferMessage(
        "Tu oferta debe ser menor que el precio publicado. Puedes comprarlo directamente por el precio completo."
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

    const { error } = await supabase
      .from("offers")
      .insert({
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
        <p className="text-sm text-zinc-500">
          Cargando artículo...
        </p>
      </main>
    );
  }

  if (error || !product) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-5 text-black">
        <div className="text-center">
          <p className="font-bold">
            No pudimos cargar el artículo.
          </p>

          <p className="mt-2 text-sm text-zinc-500">
            {error}
          </p>

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

  const conditionLabels: Record<string, string> = {
    new: "Nuevo",
    like_new: "Como nuevo",
    good: "Buen estado",
    fair: "Estado aceptable",
  };

  const location = [
    product.city,
    product.province,
  ]
    .filter(Boolean)
    .join(", ");

  const currentImage =
    images[activeImage]?.image_url;

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

            <div className="absolute left-0 right-0 top-0 flex items-center justify-between p-4">
              <Link
                href="/"
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur"
              >
                <ArrowLeft size={20} />
              </Link>

              <div className="flex gap-2">
                <button className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur">
                  <Heart size={20} />
                </button>

                <button className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-sm backdrop-blur">
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

          <h1 className="mt-2 text-2xl font-bold">
            {product.title}
          </h1>

          <p className="mt-3 text-3xl font-black">
            ${Number(product.price).toFixed(2)}
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {product.size && (
              <InfoPill
                label="Talla"
                value={product.size}
              />
            )}

            <InfoPill
              label="Condición"
              value={
                conditionLabels[product.condition] ||
                product.condition
              }
            />

            {product.color && (
              <InfoPill
                label="Color"
                value={product.color}
              />
            )}
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
          <h2 className="font-bold">
            Descripción
          </h2>

          <p className="mt-3 whitespace-pre-line text-sm leading-6 text-zinc-600">
            {product.description || "Sin descripción."}
          </p>
        </section>

        <div className="h-2 bg-zinc-50" />

        {/* SELLER */}
        {seller && (
          <section className="px-5 py-6">
            <h2 className="mb-4 font-bold">
              Vendido por
            </h2>

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
                  <p className="font-bold">
                    @{seller.username}
                  </p>

                  {seller.verified && (
                    <ShieldCheck size={15} />
                  )}
                </div>

                <div className="mt-1 flex items-center gap-1 text-xs text-zinc-500">
                  <Star size={13} />
                  <span>Nuevo vendedor</span>
                </div>
              </div>

              <span className="text-sm font-semibold">
                Ver closet →
              </span>
            </Link>
          </section>
        )}

        <div className="h-2 bg-zinc-50" />

        {/* BUYER PROTECTION */}
        <section className="px-5 py-6">
          <div className="flex gap-3">
            <ShieldCheck size={22} />

            <div>
              <h3 className="text-sm font-bold">
                Compra protegida
              </h3>

              <p className="mt-1 text-xs leading-5 text-zinc-500">
                Tu pago permanecerá protegido hasta que recibas tu compra.
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* BUY BAR */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-200 bg-white p-3">
        <div className="mx-auto flex max-w-md gap-2">
          <button
            type="button"
            onClick={openOfferModal}
            className="flex-1 rounded-2xl border border-black px-4 py-4 text-sm font-bold"
          >
            Hacer oferta
          </button>

          <button
            type="button"
            className="flex-1 rounded-2xl bg-black px-4 py-4 text-sm font-bold text-white"
          >
            Comprar · ${Number(product.price).toFixed(2)}
          </button>
        </div>
      </div>

      {/* OFFER MODAL */}
      {showOfferModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 sm:items-center">
          <div className="w-full max-w-md rounded-t-3xl bg-white p-5 sm:rounded-3xl">

            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">
                  Hacer oferta
                </h2>

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

            <form
              onSubmit={submitOffer}
              className="mt-6"
            >
              <label className="text-sm font-bold">
                Tu oferta
              </label>

              <div className="mt-2 flex items-center rounded-2xl border border-zinc-200 px-4">
                <span className="text-lg font-bold">
                  $
                </span>

                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={offerAmount}
                  onChange={(e) =>
                    setOfferAmount(e.target.value)
                  }
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
                {submittingOffer
                  ? "Enviando..."
                  : "Enviar oferta"}
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

function InfoPill({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl bg-zinc-100 px-3 py-2">
      <p className="text-[9px] font-semibold uppercase tracking-wide text-zinc-400">
        {label}
      </p>

      <p className="mt-0.5 text-xs font-bold">
        {value}
      </p>
    </div>
  );
}