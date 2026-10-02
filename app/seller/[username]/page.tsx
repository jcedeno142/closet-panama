"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  SlidersHorizontal,
  ShoppingBag,
  Grid3X3,
  Heart,
  LogOut,
  MapPin,
  Pencil,
  ShieldCheck,
  Star,
  Wallet,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type SellerProfile = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
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
  seller_id: string;
  title: string;
  brand: string | null;
  category: string | null;
  size: string | null;
  price: number;
  status: string;
  created_at: string;
  product_images: ProductImage[];
};

type Review = {
  id: string;
  reviewer_id: string;
  rating: number;
  comment: string | null;
  created_at: string;

  reviewer?: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  };
};

type Tab = "closet" | "sold" | "likes" | "reviews";

export default function SellerPage() {
  const params = useParams();
  const supabase = useMemo(() => createClient(), []);

  const username = decodeURIComponent(String(params.username || "")).replace(
    /^@/,
    "",
  );

  const [seller, setSeller] = useState<SellerProfile | null>(null);

  const [products, setProducts] = useState<Product[]>([]);

  const [followersCount, setFollowersCount] = useState(0);

  const [salesCount, setSalesCount] = useState(0);

  const [averageRating, setAverageRating] = useState<number | null>(null);

  const [reviewCount, setReviewCount] = useState(0);

  const [reviews, setReviews] = useState<Review[]>([]);

  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const [isFollowing, setIsFollowing] = useState(false);

  const [followLoading, setFollowLoading] = useState(false);

  const [messageLoading, setMessageLoading] = useState(false);

  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState<Tab>("closet");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [sizeFilter, setSizeFilter] = useState("");
  const [sort, setSort] = useState("newest");
  const [showFilters, setShowFilters] = useState(false);
  const [likedProducts, setLikedProducts] = useState<Product[]>([]);
  const [likesLoading, setLikesLoading] = useState(false);
  const [likesError, setLikesError] = useState("");
  const [likesCount, setLikesCount] = useState<number | null>(null);
  const [removingLikeId, setRemovingLikeId] = useState<string | null>(null);
  const [likeActionMessage, setLikeActionMessage] = useState("");
  const likesBusy = useRef(false);

  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadSeller() {
      setLoading(true);
      setMessage("");

      try {
        /*
         * CURRENT USER
         */
        const {
          data: { user },
        } = await supabase.auth.getUser();

        const loggedInUserId = user?.id || null;

        setCurrentUserId(loggedInUserId);

        /*
         * PROFILE
         */
        const usernameWithAt = `@${username}`;

        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select(
            `
            id,
            username,
            display_name,
            avatar_url,
            bio,
            city,
            province,
            verified
          `,
          )
          .or(`username.eq.${username},username.eq.${usernameWithAt}`)
          .maybeSingle();

        if (profileError) {
          console.error("Seller profile error:", profileError);

          setMessage("No pudimos cargar este closet.");

          setLoading(false);
          return;
        }

        if (!profileData) {
          setSeller(null);
          setLoading(false);
          return;
        }

        setSeller(profileData);
        setLikesCount(null);
        if (loggedInUserId === profileData.id) {
          const { count, error } = await supabase.from("favorites")
            .select("product_id, products!inner(status)", { count: "exact", head: true })
            .eq("user_id", loggedInUserId)
            .in("products.status", ["active", "sold"]);
          if (!error) setLikesCount(count || 0);
        }

        /*SELLER REVIEWS*/
        const { data: reviewData, error: reviewError } = await supabase
          .from("reviews")
          .select(
            `id,
            reviewer_id,
            rating,
            comment,
            created_at`,
          )
          .eq("seller_id", profileData.id)
          .order("created_at", {
            ascending: false,
          });

        if (reviewError) {
          console.error("Seller reviews error:", reviewError);

          setReviews([]);
          setAverageRating(null);
          setReviewCount(0);
        } else {
          const baseReviews = reviewData || [];

          const reviewsWithProfiles: Review[] = await Promise.all(
            baseReviews.map(async (review) => {
              const { data: reviewerData } = await supabase
                .from("profiles")
                .select(
                  `
            id,
            username,
            display_name,
            avatar_url
          `,
                )
                .eq("id", review.reviewer_id)
                .maybeSingle();

              return {
                ...review,
                rating: Number(review.rating),
                reviewer: reviewerData || undefined,
              };
            }),
          );

          setReviews(reviewsWithProfiles);
          setReviewCount(reviewsWithProfiles.length);

          if (reviewsWithProfiles.length > 0) {
            const total = reviewsWithProfiles.reduce(
              (sum, review) => sum + Number(review.rating),
              0,
            );

            setAverageRating(total / reviewsWithProfiles.length);
          } else {
            setAverageRating(null);
          }
        }

        /*
         * PRODUCTS
         */
        const { data: productData, error: productError } = await supabase
          .from("products")
          .select(
            `
            id,
            seller_id,
            title,
            brand,
            category,
            size,
            price,
            status,
            created_at,
            product_images (
              image_url,
              position
            )
          `,
          )
          .eq("seller_id", profileData.id)
          .order("created_at", {
            ascending: false,
          });

        if (productError) {
          console.error("Seller products error:", productError);
        } else {
          const normalizedProducts: Product[] = (productData || []).map(
            (product) => ({
              ...product,

              price: Number(product.price),

              product_images: [...(product.product_images || [])].sort(
                (a, b) => Number(a.position) - Number(b.position),
              ),
            }),
          );

          setProducts(normalizedProducts);
        }

        /*
         * FOLLOWER COUNT
         */
        const { count: followerCount, error: followersError } = await supabase
          .from("follows")
          .select("*", {
            count: "exact",
            head: true,
          })
          .eq("seller_id", profileData.id);

        if (followersError) {
          console.error("Followers error:", followersError);

          setFollowersCount(0);
        } else {
          setFollowersCount(followerCount || 0);
        }

        /*
         * DOES CURRENT USER FOLLOW
         * THIS SELLER?
         */
        if (loggedInUserId && loggedInUserId !== profileData.id) {
          const { data: followData, error: followError } = await supabase
            .from("follows")
            .select(
              `
              follower_id,
              seller_id
            `,
            )
            .eq("follower_id", loggedInUserId)
            .eq("seller_id", profileData.id)
            .maybeSingle();

          if (followError) {
            console.error("Follow lookup error:", followError);

            setIsFollowing(false);
          } else {
            setIsFollowing(!!followData);
          }
        } else {
          setIsFollowing(false);
        }

        /*
         * COMPLETED SALES
         */
        const { count: completedSales, error: salesError } = await supabase
          .from("orders")
          .select("id", {
            count: "exact",
            head: true,
          })
          .eq("seller_id", profileData.id)
          .eq("status", "completed");

        if (salesError) {
          console.error("Completed sales error:", salesError);
          setSalesCount(0);
        } else {
          setSalesCount(completedSales || 0);
        }
      } catch (error) {
        console.error("Seller page error:", error);
        setMessage("Ocurrió un error al cargar este closet.");
      } finally {
        setLoading(false);
      }
    }

    loadSeller();
  }, [username, supabase]);

  /*
   * LOGOUT
   */
  async function handleLogout() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Logout error:", error);
      setMessage("No pudimos cerrar tu sesión.");
      return;
    }

    window.location.href = "/";
  }

  /*
   * FOLLOW / UNFOLLOW
   */
  async function toggleFollow() {
    if (!seller) {
      return;
    }

    if (!currentUserId) {
      window.location.href = "/auth";
      return;
    }

    if (currentUserId === seller.id) {
      return;
    }

    setFollowLoading(true);
    setMessage("");

    try {
      if (isFollowing) {
        /*
         * UNFOLLOW
         */
        const { error } = await supabase
          .from("follows")
          .delete()
          .eq("follower_id", currentUserId)
          .eq("seller_id", seller.id);

        if (error) {
          console.error("Unfollow error:", error);

          setMessage("No pudimos dejar de seguir este closet.");

          return;
        }

        setIsFollowing(false);

        setFollowersCount((current) => Math.max(0, current - 1));
      } else {
        /*
         * FOLLOW
         */
        const { error } = await supabase.from("follows").insert({
          follower_id: currentUserId,

          seller_id: seller.id,
        });

        if (error) {
          console.error("Follow error:", error);

          setMessage("No pudimos seguir este closet.");

          return;
        }

        setIsFollowing(true);

        setFollowersCount((current) => current + 1);
      }
    } catch (error) {
      console.error("Follow action error:", error);

      setMessage("Ocurrió un error. Inténtalo nuevamente.");
    } finally {
      setFollowLoading(false);
    }
  }

  async function startConversation() {
    if (!seller) {
      return;
    }

    if (!currentUserId) {
      window.location.href = "/auth";
      return;
    }

    if (currentUserId === seller.id) {
      return;
    }

    setMessageLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/conversations/start", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          otherUserId: seller.id,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "No pudimos iniciar la conversación.");

        setMessageLoading(false);
        return;
      }

      if (!data.conversationId) {
        setMessage("No pudimos encontrar la conversación.");

        setMessageLoading(false);
        return;
      }

      window.location.href = `/inbox/${data.conversationId}`;
    } catch (error) {
      console.error("Start conversation error:", error);

      setMessage("Ocurrió un error al iniciar la conversación.");

      setMessageLoading(false);
    }
  }

  const isOwner = !!currentUserId && !!seller && currentUserId === seller.id;

  async function openLikes() {
    if (!isOwner || !currentUserId || likesBusy.current) return;
    likesBusy.current = true;
    setTab("likes");
    setLikesLoading(true);
    setLikesError("");
    setLikeActionMessage("");
    try {
      const { data: favorites, error: favoritesError } = await supabase
        .from("favorites")
        .select("product_id")
        .eq("user_id", currentUserId);
      if (favoritesError) throw favoritesError;
      const ids = [...new Set((favorites || []).map(favorite => favorite.product_id))];
      if (!ids.length) {
        setLikedProducts([]);
        setLikesCount(0);
        return;
      }
      const { data, error } = await supabase.from("products")
        .select("id, seller_id, title, brand, category, size, price, status, created_at, product_images(image_url, position)")
        .in("id", ids)
        .in("status", ["active", "sold"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      setLikesCount(data?.length || 0);
      setLikedProducts((data || []).map(product => ({
        ...product,
        price: Number(product.price),
        product_images: [...(product.product_images || [])].sort((a, b) => Number(a.position) - Number(b.position)),
      })));
    } catch {
      setLikesError("No pudimos cargar tus likes. Inténtalo nuevamente.");
    } finally {
      likesBusy.current = false;
      setLikesLoading(false);
    }
  }

  async function removeLike(productId: string) {
    if (!isOwner || !currentUserId || likesBusy.current) return;
    likesBusy.current = true;
    setRemovingLikeId(productId);
    setLikeActionMessage("");
    try {
      const { error } = await supabase.from("favorites").delete()
        .eq("user_id", currentUserId).eq("product_id", productId);
      if (error) throw error;
      setLikedProducts(current => current.filter(product => product.id !== productId));
      setLikesCount(current => current === null ? null : Math.max(0, current - 1));
      setLikeActionMessage("Artículo eliminado de tus likes.");
    } catch {
      setLikeActionMessage("No pudimos quitar el like. Inténtalo nuevamente.");
    } finally {
      likesBusy.current = false;
      setRemovingLikeId(null);
    }
  }

  const displayName =
    seller?.display_name || seller?.username?.replace(/^@/, "") || "Closet";

  const displayUsername = seller?.username?.replace(/^@/, "") || username;

  const initial = displayName.charAt(0).toUpperCase() || "?";

  /*
   * ACTIVE PRODUCTS
   */
  const activeProducts = products.filter(
    (product) => product.status === "active",
  );

  /*
   * SOLD PRODUCTS
   */
  const soldProducts = products.filter((product) => product.status === "sold");

  const sourceProducts = tab === "likes" ? (isOwner ? likedProducts : []) : tab === "closet" ? activeProducts : soldProducts;
  const activeFilterCount = Number(!!query.trim()) + Number(!!categoryFilter) + Number(!!sizeFilter) + Number(sort !== "newest");
  const visibleProducts = sourceProducts.filter(product =>
    `${product.title} ${product.brand || ""}`.toLowerCase().includes(query.trim().toLowerCase()) &&
    (!categoryFilter || product.category === categoryFilter) && (!sizeFilter || product.size === sizeFilter)
  ).sort((a, b) => sort === "price-asc" ? Number(a.price) - Number(b.price) : sort === "price-desc" ? Number(b.price) - Number(a.price) : new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const location = [seller?.city, seller?.province].filter(Boolean).join(", ");

  /*
   * LOADING
   */
  if (loading) {
    return (
      <main className="profile-theme flex min-h-screen items-center justify-center bg-[var(--profile-bg)] text-[var(--profile-fg)]">
        <p className="text-sm text-[var(--profile-muted)]">Cargando closet...</p>
      </main>
    );
  }

  /*
   * NOT FOUND
   */
  if (!seller) {
    return (
      <main className="profile-theme flex min-h-screen items-center justify-center bg-[var(--profile-bg)] px-5 text-[var(--profile-fg)]">
        <div className="text-center">
          <h1 className="text-xl font-black">Closet no encontrado</h1>

          <p className="mt-2 text-sm text-[var(--profile-muted)]">
            Este usuario no existe o ya no está disponible.
          </p>

          <Link
            href="/"
            className="mt-5 inline-block rounded-xl bg-[var(--profile-fg)] px-5 py-3 text-sm font-bold text-[var(--profile-on-accent)]"
          >
            Volver al inicio
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="profile-theme min-h-screen bg-[var(--profile-bg)] pb-10 text-[var(--profile-fg)]">
      <div className="mx-auto max-w-md">
        {/* TOP BAR */}

        <div className="flex items-center justify-between px-4 py-4">
          <Link
            href="/"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--profile-surface)]"
          >
            <ArrowLeft size={20} />
          </Link>

          <p className="max-w-[220px] truncate font-bold">@{displayUsername}</p>

          {isOwner ? (
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Cerrar sesión"
              title="Cerrar sesión"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--profile-surface)] transition hover:bg-[var(--profile-border)]"
            >
              <LogOut size={19} />
            </button>
          ) : (
            <div className="h-10 w-10" />
          )}
        </div>

        {/* PROFILE */}

        <section className="px-5 pt-4">
          <div className="flex items-center">
            {/* AVATAR */}

            {seller.avatar_url ? (
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full bg-[var(--profile-surface)]">
                <img
                  src={seller.avatar_url}
                  alt={displayName}
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-[var(--profile-fg)] text-2xl font-bold text-[var(--profile-on-accent)]">
                {initial}
              </div>
            )}

            {/* STATS */}

            <div className="ml-5 flex flex-1 justify-around text-center">
              <div>
                <p className="text-lg font-black">{activeProducts.length}</p>

                <p className="text-xs text-[var(--profile-muted)]">Productos</p>
              </div>

              <div>
                <p className="text-lg font-black">{followersCount}</p>

                <p className="text-xs text-[var(--profile-muted)]">Seguidores</p>
              </div>

              <div>
                <p className="text-lg font-black">{salesCount}</p>

                <p className="text-xs text-[var(--profile-muted)]">Ventas</p>
              </div>
            </div>
          </div>

          {/* NAME */}

          <div className="mt-5">
            <div className="flex items-center gap-1">
              <h1 className="text-xl font-bold">{displayName}</h1>

              {seller.verified && <ShieldCheck size={17} />}
            </div>

            {/* LOCATION */}

            {location && (
              <div className="mt-2 flex items-center gap-1 text-xs text-[var(--profile-muted)]">
                <MapPin size={13} />

                <span>{location}</span>
              </div>
            )}

            {/* RATING */}

            <div className="mt-3 flex items-center gap-1.5">
              <Star
                size={14}
                fill={averageRating !== null ? "currentColor" : "none"}
                className={
                  averageRating !== null ? "text-[var(--profile-fg)]" : "text-[var(--profile-muted)]"
                }
              />

              {averageRating !== null ? (
                <>
                  <span className="text-sm font-bold">
                    {averageRating.toFixed(1)}
                  </span>

                  <span className="text-xs text-[var(--profile-muted)]">
                    · {reviewCount}{" "}
                    {reviewCount === 1 ? "calificación" : "calificaciones"}
                  </span>
                </>
              ) : (
                <span className="text-xs text-[var(--profile-muted)]">
                  Sin calificaciones todavía
                </span>
              )}
            </div>

            {/* BIO */}

            {seller.bio && (
              <p className="mt-3 whitespace-pre-line text-sm leading-6 text-[var(--profile-secondary)]">
                {seller.bio}
              </p>
            )}
          </div>

          {/* OWNER ACTIONS */}

          {isOwner ? (
            <div className="mt-5 flex gap-2">
              <Link
                href="/profile/edit"
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--profile-border)] py-3 text-sm font-bold"
              >
                <Pencil size={16} />
                Editar perfil
              </Link>

              <Link
                href="/seller/wallet"
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--profile-fg)] py-3 text-sm font-bold text-[var(--profile-on-accent)]"
              >
                <Wallet size={17} />
                Mi billetera
              </Link>
            </div>
          ) : (
            /*
             * VISITOR ACTIONS
             */
            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={toggleFollow}
                disabled={followLoading}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl py-3 text-sm font-bold transition disabled:opacity-50 ${
                  isFollowing
                    ? "border border-[var(--profile-border)] bg-[var(--profile-bg)] text-[var(--profile-fg)]"
                    : "bg-[var(--profile-fg)] text-[var(--profile-on-accent)]"
                }`}
              >
                {isFollowing && <Check size={16} />}

                {followLoading
                  ? "Procesando..."
                  : isFollowing
                    ? "Siguiendo"
                    : "Seguir"}
              </button>

              <button
                type="button"
                onClick={startConversation}
                disabled={messageLoading}
                className="flex flex-1 items-center justify-center rounded-xl border border-[var(--profile-border)] py-3 text-sm font-bold transition disabled:opacity-50"
              >
                {messageLoading ? "Abriendo..." : "Mensaje"}
              </button>
            </div>
          )}

          {/* ERROR MESSAGE */}

          {message && (
            <div className="mt-4 rounded-xl bg-[var(--profile-soft)] p-3 text-xs text-[var(--profile-muted)]">
              {message}
            </div>
          )}
        </section>

        {/* TABS */}

        <div className="mt-7 flex border-b border-[var(--profile-border)]">
          <button
            type="button"
            onClick={() => setTab("closet")}
            className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 border-b-2 py-3 text-xs ${
              tab === "closet"
                ? "border-[var(--profile-fg)] font-bold text-[var(--profile-fg)]"
                : "border-transparent text-[var(--profile-muted)]"
            }`}
          >
            <Grid3X3 size={16} />
            Closet
          </button>

          <button
            type="button"
            onClick={() => setTab("sold")}
            className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 border-b-2 py-3 text-xs ${
              tab === "sold"
                ? "border-[var(--profile-fg)] font-bold text-[var(--profile-fg)]"
                : "border-transparent text-[var(--profile-muted)]"
            }`}
          >
            <ShoppingBag size={16} />
            <span>Vendidos · {soldProducts.length}</span>
          </button>

          {isOwner && <button
            type="button"
            onClick={openLikes}
            disabled={likesLoading || removingLikeId !== null}
            aria-pressed={tab === "likes"}
            className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 border-b-2 py-3 text-xs disabled:opacity-50 ${tab === "likes" ? "border-[var(--profile-fg)] font-bold text-[var(--profile-fg)]" : "border-transparent text-[var(--profile-muted)]"}`}
          >
            <Heart size={16} />
            <span>Likes{likesCount !== null ? ` · ${likesCount}` : ""}</span>
          </button>}

          <button
            type="button"
            onClick={() => setTab("reviews")}
            className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 border-b-2 py-3 text-xs ${
              tab === "reviews"
                ? "border-[var(--profile-fg)] font-bold text-[var(--profile-fg)]"
                : "border-transparent text-[var(--profile-muted)]"
            }`}
          >
            <Star size={15} />
            Calificaciones
          </button>
        </div>

        {tab !== "reviews" && (
          <>
            <section className="space-y-3 px-4 py-4" aria-label="Filtros del closet">
              <div className="flex items-center justify-between text-xs">
                <span>{tab === "likes" && likesLoading ? "Cargando likes…" : `${visibleProducts.length} artículos`}</span>
                <button type="button" aria-expanded={showFilters} aria-controls="profile-filters" onClick={() => setShowFilters(current => !current)} className="flex items-center gap-2 rounded-full border border-[var(--profile-border)] px-3 py-2 font-semibold">
                  <SlidersHorizontal size={14} />{showFilters ? "Ocultar filtros" : "Filtros"}
                  {activeFilterCount > 0 && <span className="rounded-full bg-[var(--profile-fg)] px-1.5 py-0.5 text-[10px] text-[var(--profile-on-accent)]">{activeFilterCount}</span>}
                  <ChevronDown size={14} className={showFilters ? "rotate-180" : ""} />
                </button>
              </div>
              <div id="profile-filters" hidden={!showFilters} className="space-y-3">
              <input aria-label="Buscar en este perfil" placeholder="Buscar artículo o marca" value={query} onChange={e => setQuery(e.target.value)} className="w-full rounded-xl border border-[var(--profile-border)] p-3 text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <select aria-label="Categoría" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="min-w-0 rounded-xl border border-[var(--profile-border)] p-3 text-sm"><option value="">Todas las categorías</option>{[...new Set([...sourceProducts.map(p => p.category), categoryFilter].filter(Boolean))].map(value => <option key={value} value={value!}>{({ women: "Mujer", men: "Hombre", shoes: "Zapatos", accessories: "Accesorios" } as Record<string, string>)[value!] || value}</option>)}</select>
                <select aria-label="Talla" value={sizeFilter} onChange={e => setSizeFilter(e.target.value)} className="min-w-0 rounded-xl border border-[var(--profile-border)] p-3 text-sm"><option value="">Todas las tallas</option>{[...new Set([...sourceProducts.map(p => p.size), sizeFilter].filter(Boolean))].map(value => <option key={value} value={value!}>{value}</option>)}</select>
              </div>
              <select aria-label="Ordenar productos" value={sort} onChange={e => setSort(e.target.value)} className="w-full rounded-xl border border-[var(--profile-border)] p-3 text-sm"><option value="newest">Más recientes</option><option value="price-asc">Menor precio</option><option value="price-desc">Mayor precio</option></select>
              <button type="button" onClick={() => { setQuery(""); setCategoryFilter(""); setSizeFilter(""); setSort("newest"); }} className="text-xs underline">Limpiar filtros</button>
              </div>
            </section>
            {/* EMPTY STATE / PRODUCTS */}
            {tab === "likes" && <p role="status" aria-live="polite" className={likeActionMessage ? "mx-4 mb-3 rounded-xl bg-[var(--profile-surface)] p-3 text-sm" : "sr-only"}>{likeActionMessage}</p>}

            {tab === "likes" && likesLoading ? (
              <p role="status" className="px-6 py-16 text-center text-sm text-[var(--profile-muted)]">Cargando tus artículos favoritos…</p>
            ) : tab === "likes" && likesError ? (
              <div role="alert" className="px-6 py-12 text-center text-sm"><p>{likesError}</p><button onClick={openLikes} className="mt-4 underline">Reintentar</button></div>
            ) : visibleProducts.length === 0 ? (
              <section className="flex min-h-[280px] flex-col items-center justify-center px-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--profile-surface)]">
                  {tab === "closet" ? (
                    <Grid3X3 size={22} className="text-[var(--profile-muted)]" />
                  ) : (
                    <Heart size={22} className="text-[var(--profile-muted)]" />
                  )}
                </div>

                <p className="mt-4 text-sm font-bold">
                  {sourceProducts.length ? "No hay artículos con estos filtros" : tab === "likes" ? "Todavía no tienes likes" : tab === "closet" ? "Este closet está vacío" : "Todavía no hay artículos vendidos"}
                </p>

                <p className="mt-1 text-xs text-[var(--profile-muted)]">
                  {sourceProducts.length ? "Prueba otros filtros o limpia la selección." : tab === "likes" ? "Toca el corazón de un artículo para guardarlo aquí." : tab === "closet"
                    ? isOwner
                      ? "Publica tu primer artículo para comenzar."
                      : "Este vendedor no tiene artículos disponibles."
                    : "Los artículos vendidos aparecerán aquí."}
                </p>

                {tab === "closet" && isOwner && !sourceProducts.length && (
                  <Link
                    href="/sell"
                    className="mt-5 rounded-xl bg-[var(--profile-fg)] px-5 py-3 text-sm font-bold text-[var(--profile-on-accent)]"
                  >
                    Vender un artículo
                  </Link>
                )}
              </section>
            ) : (
              <section className="grid grid-cols-2 gap-x-1 gap-y-5 pt-1">
                {visibleProducts.map((product) => {
                  const cover = product.product_images?.[0]?.image_url || null;

                  const isSold = product.status === "sold";
                  return (
                    <article key={product.id} className="relative">
                      <Link href={`/product/${product.id}`}>
                        <div className="relative aspect-[3/4] overflow-hidden bg-[var(--profile-surface)]">
                          {cover ? (
                            <img
                              src={cover}
                              alt={product.title}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center text-xs text-[var(--profile-muted)]">
                              Sin foto
                            </div>
                          )}

                          {isSold && (
                            <div className="absolute inset-x-0 bottom-0 bg-[#000000]/75 px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-[#ffffff]">
                              Vendido
                            </div>
                          )}
                        </div>

                        <div className="px-3 pt-3">
                          <p className="truncate text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--profile-muted)]">
                            {product.brand || "Sin marca"}
                          </p>

                          <h2 className="mt-1 truncate text-sm font-semibold">
                            {product.title}
                          </h2>

                          <p className="mt-2 text-lg font-black">
                            ${Number(product.price).toFixed(2)}
                          </p>
                        </div>
                      </Link>
                      {tab === "likes" && isOwner && <button
                        type="button"
                        onClick={() => removeLike(product.id)}
                        disabled={removingLikeId !== null}
                        aria-label={`Quitar ${product.title} de mis likes`}
                        aria-busy={removingLikeId === product.id}
                        className="absolute right-2 top-2 flex h-11 w-11 items-center justify-center rounded-full bg-white/95 text-red-500 shadow-sm transition hover:bg-[var(--profile-bg)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black disabled:opacity-50"
                      >
                        <Heart size={20} fill="currentColor" />
                      </button>}
                    </article>
                  );
                })}
              </section>
            )}
          </>
        )}

        {/* REVIEWS */}

        {tab === "reviews" && (
          <section className="px-5 py-6">
            {reviews.length === 0 ? (
              <div className="flex min-h-[280px] flex-col items-center justify-center text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--profile-surface)]">
                  <Star size={22} className="text-[var(--profile-muted)]" />
                </div>

                <p className="mt-4 text-sm font-bold">
                  Sin calificaciones todavía
                </p>

                <p className="mt-1 max-w-[260px] text-xs leading-5 text-[var(--profile-muted)]">
                  Las calificaciones de compras verificadas aparecerán aquí.
                </p>
              </div>
            ) : (
              <>
                {/* RATING SUMMARY */}

                <div className="mb-6 rounded-2xl bg-[var(--profile-soft)] p-5">
                  <div className="flex items-end gap-3">
                    <span className="text-4xl font-black">
                      {averageRating?.toFixed(1)}
                    </span>

                    <div className="pb-1">
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map((star) => {
                          const active =
                            averageRating !== null &&
                            star <= Math.round(averageRating);

                          return (
                            <Star
                              key={star}
                              size={16}
                              fill={active ? "currentColor" : "none"}
                              className={
                                active ? "text-[var(--profile-fg)]" : "text-[var(--profile-muted)]"
                              }
                            />
                          );
                        })}
                      </div>

                      <p className="mt-1 text-xs text-[var(--profile-muted)]">
                        {reviewCount}{" "}
                        {reviewCount === 1 ? "calificación" : "calificaciones"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* REVIEW CARDS */}

                <div className="space-y-4">
                  {reviews.map((review) => {
                    const reviewerName =
                      review.reviewer?.display_name ||
                      review.reviewer?.username?.replace(/^@/, "") ||
                      "Comprador";

                    const reviewerUsername = review.reviewer?.username?.replace(
                      /^@/,
                      "",
                    );

                    const initial = reviewerName.charAt(0).toUpperCase() || "?";

                    const reviewDate = new Intl.DateTimeFormat("es-PA", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    }).format(new Date(review.created_at));

                    return (
                      <article
                        key={review.id}
                        className="border-b border-[var(--profile-border)] pb-5"
                      >
                        <div className="flex items-start gap-3">
                          {review.reviewer?.avatar_url ? (
                            <img
                              src={review.reviewer.avatar_url}
                              alt={reviewerName}
                              className="h-10 w-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--profile-surface)] text-sm font-black">
                              {initial}
                            </div>
                          )}

                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-bold">
                                  {reviewerName}
                                </p>

                                {reviewerUsername && (
                                  <p className="text-xs text-[var(--profile-muted)]">
                                    @{reviewerUsername}
                                  </p>
                                )}
                              </div>

                              <span className="shrink-0 text-[11px] text-[var(--profile-muted)]">
                                {reviewDate}
                              </span>
                            </div>

                            <div className="mt-2 flex items-center gap-2">
                              <div className="flex gap-0.5">
                                {[1, 2, 3, 4, 5].map((star) => (
                                  <Star
                                    key={star}
                                    size={14}
                                    fill={
                                      star <= review.rating
                                        ? "currentColor"
                                        : "none"
                                    }
                                    className={
                                      star <= review.rating
                                        ? "text-[var(--profile-fg)]"
                                        : "text-[var(--profile-muted)]"
                                    }
                                  />
                                ))}
                              </div>

                              <span className="text-[10px] font-bold uppercase tracking-wide text-[var(--profile-muted)]">
                                Compra verificada
                              </span>
                            </div>

                            {review.comment && (
                              <p className="mt-3 whitespace-pre-line text-sm leading-6 text-[var(--profile-secondary)]">
                                {review.comment}
                              </p>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
