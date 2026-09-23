"use client";

import Link from "next/link";
import {
  Bell,
  Heart,
  Home,
  MapPin,
  MessageCircle,
  Plus,
  Search,
  ShoppingBag,
  User,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ProductImage = {
  image_url: string;
  position: number;
};

type SellerProfile = {
  id: string;
  username: string | null;
  display_name: string | null;
};

type Product = {
  id: string;
  title: string;
  brand: string | null;
  size: string | null;
  condition: string | null;
  price: number;
  city: string | null;
  province: string | null;
  seller_id: string;
  created_at: string;
  product_images: ProductImage[];
  seller?: SellerProfile | null;
};

const categories = [
  "Para ti",
  "Mujer",
  "Hombre",
  "Sneakers",
  "Boutiques",
  "Vintage",
  "Lujo",
];

export default function HomePage() {
  const supabase = useMemo(() => createClient(), []);

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [favoriteLoading, setFavoriteLoading] = useState<Set<string>>(
    new Set(),
  );

  const loadFavorites = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setCurrentUserId("");
      setFavoriteIds(new Set());
      return;
    }

    setCurrentUserId(user.id);

    const { data, error } = await supabase
      .from("favorites")
      .select("product_id")
      .eq("user_id", user.id);

    if (error) {
      console.error("Load favorites error:", error);
      return;
    }

    setFavoriteIds(
      new Set((data || []).map((favorite) => favorite.product_id)),
    );
  }, [supabase]);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    /*
     * LOAD REAL MARKETPLACE PRODUCTS
     */
    const { data: productData, error: productError } = await supabase
      .from("products")
      .select(
        `
        id,
        title,
        brand,
        size,
        condition,
        price,
        city,
        province,
        seller_id,
        created_at,
        product_images (
          image_url,
          position
        )
      `,
      )
      .order("created_at", {
        ascending: false,
      });

    if (productError) {
      console.error("Homepage products error:", productError);

      setErrorMessage("No pudimos cargar los productos.");

      setLoading(false);
      return;
    }

    const rawProducts = productData || [];

    /*
     * GET SELLER PROFILES
     */
    const sellerIds = [
      ...new Set(rawProducts.map((product) => product.seller_id)),
    ];

    let sellerMap: Record<string, SellerProfile> = {};

    if (sellerIds.length > 0) {
      const { data: profileData, error: profileError } = await supabase
        .from("profiles")
        .select(
          `
          id,
          username,
          display_name
        `,
        )
        .in("id", sellerIds);

      if (profileError) {
        console.error("Homepage seller profiles error:", profileError);
      } else {
        sellerMap = Object.fromEntries(
          (profileData || []).map((profile) => [profile.id, profile]),
        );
      }
    }

    /*
     * FORMAT PRODUCTS
     */
    const formattedProducts: Product[] = rawProducts.map((product) => ({
      ...product,

      price: Number(product.price),

      product_images: [...(product.product_images || [])].sort(
        (a, b) => Number(a.position) - Number(b.position),
      ),

      seller: sellerMap[product.seller_id] || null,
    }));

    setProducts(formattedProducts);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadProducts();
    loadFavorites();
  }, [loadProducts, loadFavorites]);

  async function toggleFavorite(productId: string) {
    if (!currentUserId) {
      window.location.href = "/auth";
      return;
    }

    if (favoriteLoading.has(productId)) {
      return;
    }

    setFavoriteLoading((current) => {
      const next = new Set(current);
      next.add(productId);
      return next;
    });

    const isFavorite = favoriteIds.has(productId);

    if (isFavorite) {
      const { error } = await supabase
        .from("favorites")
        .delete()
        .eq("user_id", currentUserId)
        .eq("product_id", productId);

      if (error) {
        console.error("Remove favorite error:", error);
      } else {
        setFavoriteIds((current) => {
          const next = new Set(current);
          next.delete(productId);
          return next;
        });
      }
    } else {
      const { error } = await supabase.from("favorites").insert({
        user_id: currentUserId,
        product_id: productId,
      });

      if (error) {
        console.error("Add favorite error:", error);
      } else {
        setFavoriteIds((current) => {
          const next = new Set(current);
          next.add(productId);
          return next;
        });
      }
    }

    setFavoriteLoading((current) => {
      const next = new Set(current);
      next.delete(productId);
      return next;
    });
  }

  return (
    <main className="min-h-screen bg-white pb-24 text-black">
      {/* HEADER */}
      <header className="sticky top-0 z-40 border-b border-zinc-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-4">
          <div>
            <h1 className="text-2xl font-black tracking-[-0.05em]">CLOSET</h1>

            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-400">
              Panamá
            </p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100"
            >
              <Bell size={19} />
            </button>

            <Link
              href="/orders"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100"
            >
              <ShoppingBag size={19} />
            </Link>
          </div>
        </div>

        {/* SEARCH */}
        <div className="mx-auto max-w-md px-4 pb-3">
          <Link
            href="/search"
            className="flex items-center gap-3 rounded-2xl bg-zinc-100 px-4 py-3"
          >
            <Search size={18} className="text-zinc-400" />

            <span className="text-sm text-zinc-400">
              Buscar marcas, ropa, tiendas...
            </span>
          </Link>
        </div>

        {/* CATEGORIES */}
        <div className="mx-auto max-w-md overflow-x-auto px-4 pb-3">
          <div className="flex w-max gap-2">
            {categories.map((category, index) => (
              <button
                key={category}
                type="button"
                className={
                  index === 0
                    ? "rounded-full bg-black px-4 py-2 text-xs font-semibold text-white"
                    : "rounded-full border border-zinc-200 px-4 py-2 text-xs font-semibold text-zinc-600"
                }
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* FEED */}
      <section className="mx-auto max-w-md">
        <div className="flex items-center justify-between px-4 py-5">
          <div>
            <h2 className="text-xl font-bold">Descubre</h2>

            <p className="text-xs text-zinc-400">Lo último en el marketplace</p>
          </div>

          <MapPin size={18} className="text-zinc-400" />
        </div>

        {/* LOADING */}
        {loading && (
          <div className="grid grid-cols-2 gap-x-1 gap-y-5">
            {Array.from({
              length: 4,
            }).map((_, index) => (
              <div key={index} className="animate-pulse">
                <div className="aspect-[3/4] bg-zinc-100" />

                <div className="px-3 pt-3">
                  <div className="h-2 w-12 rounded bg-zinc-100" />

                  <div className="mt-3 h-3 w-28 rounded bg-zinc-100" />

                  <div className="mt-2 h-2 w-20 rounded bg-zinc-100" />

                  <div className="mt-3 h-5 w-14 rounded bg-zinc-100" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ERROR */}
        {!loading && errorMessage && (
          <div className="mx-4 rounded-2xl bg-zinc-100 p-5 text-center">
            <p className="text-sm font-semibold">{errorMessage}</p>

            <button
              type="button"
              onClick={loadProducts}
              className="mt-4 rounded-xl bg-black px-5 py-3 text-xs font-bold text-white"
            >
              Intentar de nuevo
            </button>
          </div>
        )}

        {/* EMPTY */}
        {!loading && !errorMessage && products.length === 0 && (
          <div className="px-6 py-20 text-center">
            <ShoppingBag size={34} className="mx-auto text-zinc-300" />

            <h2 className="mt-4 font-bold">Aún no hay productos</h2>

            <p className="mt-2 text-sm text-zinc-400">
              Sé el primero en publicar algo en Closet Panamá.
            </p>

            <Link
              href="/sell"
              className="mt-5 inline-block rounded-xl bg-black px-5 py-3 text-sm font-bold text-white"
            >
              Vender
            </Link>
          </div>
        )}

        {/* REAL PRODUCTS */}
        {!loading && !errorMessage && products.length > 0 && (
          <div className="grid grid-cols-2 gap-x-1 gap-y-5">
            {products.map((product) => {
              const cover = product.product_images?.[0]?.image_url;

              const username =
                product.seller?.username?.replace(/^@/, "") || "usuario";

              const location = product.city || product.province || "Panamá";

              return (
                <article key={product.id}>
                  {/* PRODUCT IMAGE */}
                  <Link
                    href={`/product/${product.id}`}
                    className="relative block aspect-[3/4] overflow-hidden bg-zinc-100"
                  >
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

                    <button
                      type="button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        toggleFavorite(product.id);
                      }}
                      disabled={favoriteLoading.has(product.id)}
                      className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-sm transition active:scale-90 disabled:opacity-50"
                      aria-label={
                        favoriteIds.has(product.id)
                          ? "Quitar de favoritos"
                          : "Guardar en favoritos"
                      }
                    >
                      <Heart
                        size={18}
                        className={
                          favoriteIds.has(product.id)
                            ? "fill-red-500 text-red-500"
                            : "text-black"
                        }
                      />
                    </button>
                  </Link>

                  {/* PRODUCT INFO */}
                  <div className="px-3 pt-3">
                    <p className="truncate text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400">
                      {product.brand || "SIN MARCA"}
                    </p>

                    <Link href={`/product/${product.id}`}>
                      <h3 className="mt-1 truncate text-sm font-semibold">
                        {product.title}
                      </h3>
                    </Link>

                    <div className="mt-1 flex min-w-0 gap-1 text-[11px] text-zinc-500">
                      {product.size && (
                        <span className="truncate">{product.size}</span>
                      )}

                      {product.size && product.condition && <span>·</span>}

                      {product.condition && (
                        <span className="truncate">{product.condition}</span>
                      )}
                    </div>

                    <p className="mt-2 text-lg font-black">
                      ${Number(product.price).toFixed(2)}
                    </p>

                    <div className="mt-2 border-t border-zinc-100 pt-2">
                      <Link
                        href={`/seller/${username}`}
                        className="block truncate text-[11px] font-semibold"
                      >
                        @{username}
                      </Link>

                      <div className="mt-1 flex items-center gap-1 text-[10px] text-zinc-400">
                        <MapPin size={10} />

                        <span className="truncate">{location}</span>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {/* BOTTOM NAVIGATION */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-md items-center justify-around px-2 py-2">
          <NavItem icon={<Home size={21} />} label="Inicio" href="/" active />

          <NavItem icon={<Search size={21} />} label="Buscar" href="/search" />

          <Link href="/sell" className="flex flex-col items-center gap-1">
            <div className="flex h-11 w-14 items-center justify-center rounded-2xl bg-black text-white">
              <Plus size={25} />
            </div>

            <span className="text-[10px] font-medium">Vender</span>
          </Link>

          <NavItem
            icon={<MessageCircle size={21} />}
            label="Inbox"
            href="/inbox"
          />

          <NavItem icon={<User size={21} />} label="Perfil" href="/profile" />
        </div>
      </nav>
    </main>
  );
}

function NavItem({
  icon,
  label,
  active = false,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={`flex min-w-[50px] flex-col items-center gap-1 ${
        active ? "text-black" : "text-zinc-400"
      }`}
    >
      {icon}

      <span className="text-[10px] font-medium">{label}</span>
    </Link>
  );
}
