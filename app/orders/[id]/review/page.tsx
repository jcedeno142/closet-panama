"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Star,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type OrderDetails = {
  id: string;
  product_id: string;
  buyer_id: string;
  seller_id: string;
  status: string;
};

type ProductDetails = {
  id: string;
  title: string;
  image: string | null;
};

type SellerDetails = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

export default function ReviewOrderPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const orderId = params.id as string;

  const [order, setOrder] =
    useState<OrderDetails | null>(null);

  const [product, setProduct] =
    useState<ProductDetails | null>(null);

  const [seller, setSeller] =
    useState<SellerDetails | null>(null);

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [alreadyReviewed, setAlreadyReviewed] =
    useState(false);

  const [error, setError] = useState("");

  useEffect(() => {
    async function loadOrder() {
      setLoading(true);
      setError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/auth");
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
            status
          `)
          .eq("id", orderId)
          .maybeSingle();

      if (orderError) {
        console.error("Order error:", orderError);
        setError("No pudimos cargar este pedido.");
        setLoading(false);
        return;
      }

      if (!orderData) {
        setError("Pedido no encontrado.");
        setLoading(false);
        return;
      }

      if (orderData.buyer_id !== user.id) {
        setError(
          "No tienes permiso para calificar este pedido."
        );
        setLoading(false);
        return;
      }

      if (orderData.status !== "completed") {
        setError(
          "Solo puedes calificar pedidos completados."
        );
        setLoading(false);
        return;
      }

      setOrder(orderData);

      const { data: existingReview } = await supabase
        .from("reviews")
        .select("id")
        .eq("order_id", orderData.id)
        .eq("reviewer_id", user.id)
        .maybeSingle();

      if (existingReview) {
        setAlreadyReviewed(true);
        setLoading(false);
        return;
      }

      const [
        { data: productData },
        { data: sellerData },
      ] = await Promise.all([
        supabase
          .from("products")
          .select(`
            id,
            title,
            product_images (
              image_url,
              position
            )
          `)
          .eq("id", orderData.product_id)
          .maybeSingle(),

        supabase
          .from("profiles")
          .select(`
            id,
            username,
            display_name,
            avatar_url
          `)
          .eq("id", orderData.seller_id)
          .maybeSingle(),
      ]);

      if (productData) {
        const images = [
          ...(productData.product_images || []),
        ].sort(
          (a, b) =>
            Number(a.position) - Number(b.position)
        );

        setProduct({
          id: productData.id,
          title: productData.title,
          image: images[0]?.image_url || null,
        });
      }

      if (sellerData) {
        setSeller(sellerData);
      }

      setLoading(false);
    }

    if (orderId) {
      loadOrder();
    }
  }, [orderId, router, supabase]);

  async function submitReview() {
    if (!order) {
      return;
    }

    if (rating < 1 || rating > 5) {
      setError(
        "Selecciona una calificación de 1 a 5 estrellas."
      );
      return;
    }

    if (comment.trim().length > 500) {
      setError(
        "Tu comentario no puede superar 500 caracteres."
      );
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/auth");
        return;
      }

      const { error: reviewError } = await supabase
        .from("reviews")
        .insert({
          order_id: order.id,
          product_id: order.product_id,
          reviewer_id: user.id,
          seller_id: order.seller_id,
          rating,
          comment:
            comment.trim().length > 0
              ? comment.trim()
              : null,
        });

      if (reviewError) {
        console.error(
          "Review submission error:",
          reviewError
        );

        if (reviewError.code === "23505") {
          setAlreadyReviewed(true);
          return;
        }

        setError(
          "No pudimos guardar tu calificación."
        );
        return;
      }

      router.push("/orders");
      router.refresh();
    } catch (submitError) {
      console.error(
        "Review submission error:",
        submitError
      );

      setError(
        "Ocurrió un error al guardar tu calificación."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 text-black">
        <p className="text-sm text-zinc-400">
          Cargando...
        </p>
      </main>
    );
  }

  if (alreadyReviewed) {
    return (
      <main className="min-h-screen bg-zinc-50 text-black">
        <div className="mx-auto max-w-md">
          <header className="flex items-center border-b border-zinc-100 bg-white px-4 py-4">
            <Link
              href="/orders"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100"
            >
              <ArrowLeft size={20} />
            </Link>

            <h1 className="ml-4 font-black">
              Calificación
            </h1>
          </header>

          <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-black text-white">
              <CheckCircle2 size={28} />
            </div>

            <h2 className="mt-5 text-xl font-black">
              Ya calificaste esta compra
            </h2>

            <p className="mt-2 text-sm text-zinc-500">
              Gracias por compartir tu experiencia.
            </p>

            <Link
              href="/orders"
              className="mt-6 rounded-2xl bg-black px-6 py-3 text-sm font-bold text-white"
            >
              Volver a mis pedidos
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (error && !order) {
    return (
      <main className="min-h-screen bg-zinc-50 text-black">
        <div className="mx-auto max-w-md">
          <header className="flex items-center border-b border-zinc-100 bg-white px-4 py-4">
            <Link
              href="/orders"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100"
            >
              <ArrowLeft size={20} />
            </Link>

            <h1 className="ml-4 font-black">
              Calificación
            </h1>
          </header>

          <div className="px-5 py-16 text-center">
            <p className="font-bold">
              {error}
            </p>

            <Link
              href="/orders"
              className="mt-6 inline-block rounded-2xl bg-black px-6 py-3 text-sm font-bold text-white"
            >
              Volver
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const sellerName =
    seller?.display_name ||
    seller?.username ||
    "Vendedor";

  return (
    <main className="min-h-screen bg-zinc-50 pb-10 text-black">
      <div className="mx-auto max-w-md">
        {/* HEADER */}

        <header className="sticky top-0 z-40 flex items-center border-b border-zinc-100 bg-white px-4 py-4">
          <Link
            href="/orders"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100"
          >
            <ArrowLeft size={20} />
          </Link>

          <div className="ml-4">
            <h1 className="font-black">
              Calificar vendedor
            </h1>

            <p className="text-xs text-zinc-400">
              Compra verificada
            </p>
          </div>
        </header>

        {/* ORDER */}

        <section className="p-4">
          <div className="rounded-2xl bg-white p-4">
            <div className="flex gap-4">
              <div className="h-24 w-20 shrink-0 overflow-hidden rounded-xl bg-zinc-100">
                {product?.image ? (
                  <img
                    src={product.image}
                    alt={product.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-xs text-zinc-400">
                    Sin foto
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">
                  Compra completada
                </p>

                <h2 className="mt-2 truncate font-black">
                  {product?.title || "Producto"}
                </h2>

                <p className="mt-2 text-sm text-zinc-500">
                  Vendido por {sellerName}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* REVIEW */}

        <section className="px-4">
          <div className="rounded-2xl bg-white p-5">
            <div className="text-center">
              <h2 className="text-lg font-black">
                ¿Cómo fue tu experiencia?
              </h2>

              <p className="mt-1 text-sm text-zinc-400">
                Califica tu experiencia con el vendedor.
              </p>
            </div>

            {/* STARS */}

            <div
              className="mt-7 flex justify-center gap-2"
              onMouseLeave={() => setHoverRating(0)}
            >
              {[1, 2, 3, 4, 5].map((star) => {
                const active =
                  star <= (hoverRating || rating);

                return (
                  <button
                    key={star}
                    type="button"
                    onMouseEnter={() =>
                      setHoverRating(star)
                    }
                    onClick={() => setRating(star)}
                    className="p-1"
                    aria-label={`${star} estrellas`}
                  >
                    <Star
                      size={38}
                      fill={
                        active
                          ? "currentColor"
                          : "none"
                      }
                      className={
                        active
                          ? "text-black"
                          : "text-zinc-300"
                      }
                    />
                  </button>
                );
              })}
            </div>

            {rating > 0 && (
              <p className="mt-3 text-center text-sm font-bold">
                {rating === 1 && "Mala experiencia"}
                {rating === 2 && "Podría mejorar"}
                {rating === 3 && "Buena"}
                {rating === 4 && "Muy buena"}
                {rating === 5 && "Excelente"}
              </p>
            )}

            {/* COMMENT */}

            <div className="mt-8">
              <div className="flex items-center justify-between">
                <label
                  htmlFor="review-comment"
                  className="text-sm font-bold"
                >
                  Cuéntanos más
                </label>

                <span className="text-xs text-zinc-400">
                  {comment.length}/500
                </span>
              </div>

              <textarea
                id="review-comment"
                value={comment}
                onChange={(event) =>
                  setComment(
                    event.target.value.slice(0, 500)
                  )
                }
                rows={5}
                placeholder="¿Cómo fue la comunicación, entrega y experiencia con el vendedor?"
                className="mt-3 w-full resize-none rounded-2xl border border-zinc-200 bg-white p-4 text-sm outline-none placeholder:text-zinc-400 focus:border-black"
              />

              <p className="mt-2 text-xs text-zinc-400">
                El comentario es opcional.
              </p>
            </div>

            {error && (
              <div className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-600">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={submitReview}
              disabled={submitting || rating === 0}
              className="mt-6 flex w-full items-center justify-center rounded-2xl bg-black py-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting
                ? "Publicando..."
                : "Publicar calificación"}
            </button>

            <p className="mt-3 text-center text-[11px] leading-4 text-zinc-400">
              Solo puedes publicar una calificación por
              compra completada.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}