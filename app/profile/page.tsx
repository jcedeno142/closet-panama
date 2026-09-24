"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  LogOut,
  MapPin,
  ShieldCheck,
  Star,
  Wallet,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  account_type: "personal" | "business";
  city: string | null;
  province: string | null;
  verified: boolean;
};

type ProductImage = {
  image_url: string;
  position: number;
};

type Product = {
  id: string;
  title: string;
  brand: string | null;
  price: number;
  status: string;
  product_images: ProductImage[];
};

export default function ProfilePage() {
  const supabase = createClient();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [products, setProducts] = useState<Product[]>([]);

  const [averageRating, setAverageRating] = useState<number | null>(null);
  const [reviewCount, setReviewCount] = useState(0);
  const [completedSalesCount, setCompletedSalesCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadProfile() {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        window.location.href = "/auth";
        return;
      }

      // LOAD PROFILE
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError) {
        setError(profileError.message);
        setLoading(false);
        return;
      }

      if (!profileData) {
        setError("No profile exists for this account.");
        setLoading(false);
        return;
      }

      setProfile(profileData);

      // LOAD SELLER RATINGS
      const { data: reviewData, error: reviewError } = await supabase
        .from("reviews")
        .select("rating")
        .eq("seller_id", user.id);

      if (reviewError) {
        console.error("Reviews error:", reviewError);
      } else {
        const ratings = (reviewData || []).map((review) =>
          Number(review.rating),
        );

        setReviewCount(ratings.length);

        if (ratings.length > 0) {
          const total = ratings.reduce((sum, rating) => sum + rating, 0);

          setAverageRating(total / ratings.length);
        } else {
          setAverageRating(null);
        }
      }

      // LOAD COMPLETED SALES
      const { count: completedSales, error: salesError } = await supabase
        .from("orders")
        .select("id", {
          count: "exact",
          head: true,
        })
        .eq("seller_id", user.id)
        .eq("status", "completed");

      if (salesError) {
        console.error("Completed sales error:", salesError);
        setCompletedSalesCount(0);
      } else {
        setCompletedSalesCount(completedSales || 0);
      }

      // LOAD USER'S PRODUCTS
      const { data: productData, error: productError } = await supabase
        .from("products")
        .select(
          `
            id,
            title,
            brand,
            price,
            status,
            product_images (
              image_url,
              position
            )
          `,
        )
        .eq("seller_id", user.id)
        .order("created_at", { ascending: false });

      if (productError) {
        setError(productError.message);
        setLoading(false);
        return;
      }

      const cleanProducts = (productData || []).map((product) => ({
        ...product,
        product_images: [...(product.product_images || [])].sort(
          (a, b) => a.position - b.position,
        ),
      }));

      setProducts(cleanProducts);
      setLoading(false);
    }

    loadProfile();
  }, [supabase]);

  async function handleLogout() {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white text-black">
        <p className="text-sm text-zinc-500">Cargando perfil...</p>
      </main>
    );
  }

  if (error || !profile) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-5 text-black">
        <div className="max-w-md text-center">
          <p className="font-bold">No pudimos cargar tu perfil.</p>

          <p className="mt-2 text-sm text-zinc-500">{error}</p>
        </div>
      </main>
    );
  }

  const initial =
    profile.display_name?.charAt(0).toUpperCase() ||
    profile.username.charAt(0).toUpperCase();

  const activeProducts = products.filter(
    (product) => product.status === "active",
  );

  return (
    <main className="min-h-screen bg-white pb-10 text-black">
      <div className="mx-auto max-w-md">
        {/* HEADER */}
        <header className="flex items-center justify-between px-4 py-4">
          <Link
            href="/"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100"
          >
            <ArrowLeft size={20} />
          </Link>

          <p className="font-bold">Mi perfil</p>

          <button
            onClick={handleLogout}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100"
          >
            <LogOut size={18} />
          </button>
        </header>

        {/* PROFILE */}
        <section className="px-5 pt-5">
          <div className="flex items-center">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={profile.username}
                className="h-20 w-20 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-black text-2xl font-bold text-white">
                {initial}
              </div>
            )}

            <div className="ml-5">
              <div className="flex items-center gap-1">
                <h1 className="text-xl font-bold">
                  {profile.display_name || profile.username}
                </h1>

                {profile.verified && <ShieldCheck size={17} />}
              </div>

              <p className="mt-1 text-sm text-zinc-500">@{profile.username}</p>

              <span className="mt-2 inline-block rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold">
                {profile.account_type === "business"
                  ? "Boutique / Tienda"
                  : "Closet personal"}
              </span>
            </div>
          </div>

          {/* REAL STATS */}
          <div className="mt-6 flex gap-8">
            <div>
              <p className="text-lg font-black">{activeProducts.length}</p>

              <p className="text-xs text-zinc-500">Productos</p>
            </div>

            <div>
              <p className="text-lg font-black">0</p>

              <p className="text-xs text-zinc-500">Seguidores</p>
            </div>

            <div>
              <p className="text-lg font-black">{completedSalesCount}</p>

              <p className="text-xs text-zinc-500">Ventas</p>
            </div>
          </div>

          {profile.bio ? (
            <p className="mt-5 text-sm leading-6 text-zinc-600">
              {profile.bio}
            </p>
          ) : (
            <p className="mt-5 text-sm text-zinc-400">
              Agrega una biografía para que los compradores conozcan más sobre
              ti.
            </p>
          )}

          {(profile.city || profile.province) && (
            <div className="mt-4 flex items-center gap-2 text-xs text-zinc-500">
              <MapPin size={14} />

              {[profile.city, profile.province].filter(Boolean).join(", ")}
            </div>
          )}

          <div className="mt-4 flex items-center gap-1.5 text-sm">
            <Star
              size={15}
              fill={averageRating !== null ? "currentColor" : "none"}
              className={
                averageRating !== null ? "text-black" : "text-zinc-400"
              }
            />

            {averageRating !== null ? (
              <>
                <span className="font-bold">{averageRating.toFixed(1)}</span>

                <span className="text-zinc-400">
                  · {reviewCount}{" "}
                  {reviewCount === 1 ? "calificación" : "calificaciones"}
                </span>
              </>
            ) : (
              <span className="text-xs text-zinc-500">
                Sin calificaciones todavía
              </span>
            )}
          </div>

          <div className="mt-6 space-y-3">
            <Link
              href="/profile/edit"
              className="block w-full rounded-2xl bg-black py-4 text-center text-sm font-bold text-white"
            >
              Editar perfil
            </Link>

            <Link
              href="/seller/wallet"
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white py-4 text-sm font-bold text-black"
            >
              <Wallet size={18} />
              Mi billetera
            </Link>
          </div>
        </section>

        <div className="mt-8 h-2 bg-zinc-50" />

        {/* CLOSET */}
        <section className="px-5 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">
                {profile.account_type === "business"
                  ? "Tu tienda"
                  : "Tu closet"}
              </h2>

              <p className="mt-1 text-xs text-zinc-400">
                {activeProducts.length} artículos activos
              </p>
            </div>

            <Link
              href="/sell"
              className="rounded-xl bg-black px-4 py-2 text-xs font-bold text-white"
            >
              + Publicar
            </Link>
          </div>

          {activeProducts.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm font-semibold">
                Todavía no tienes artículos publicados.
              </p>

              <Link
                href="/sell"
                className="mt-4 inline-block rounded-2xl border border-black px-5 py-3 text-sm font-bold"
              >
                Publicar artículo
              </Link>
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-2 gap-x-2 gap-y-6">
              {activeProducts.map((product) => {
                const cover = product.product_images?.[0]?.image_url;

                return (
                  <Link key={product.id} href={`/product/${product.id}`}>
                    <article>
                      <div className="aspect-[3/4] overflow-hidden rounded-xl bg-zinc-100">
                        {cover ? (
                          <img
                            src={cover}
                            alt={product.title}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center text-xs text-zinc-400">
                            Sin foto
                          </div>
                        )}
                      </div>

                      <div className="pt-3">
                        {product.brand && (
                          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400">
                            {product.brand}
                          </p>
                        )}

                        <h3 className="mt-1 truncate text-sm font-semibold">
                          {product.title}
                        </h3>

                        <p className="mt-2 text-lg font-black">
                          ${Number(product.price).toFixed(2)}
                        </p>
                      </div>
                    </article>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
