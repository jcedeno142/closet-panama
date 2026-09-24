"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  Grid3X3,
  Heart,
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

type Tab = "closet" | "sold" | "reviews";

export default function SellerPage() {
  const params = useParams();
  const supabase = useMemo(() => createClient(), []);

  const username = decodeURIComponent(String(params.username || "")).replace(
    /^@/,
    "",
  );

  const [seller, setSeller] = useState<SellerProfile | null>(null);

  const [products, setProducts] = useState<Product[]>([]);

  const [soldProductIds, setSoldProductIds] = useState<string[]>([]);

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
        const { data: completedOrders, error: salesError } = await supabase
          .from("orders")
          .select(
            `
            id,
            product_id
          `,
          )
          .eq("seller_id", profileData.id)
          .eq("status", "completed");

        if (salesError) {
          console.error("Completed sales error:", salesError);

          setSalesCount(0);
          setSoldProductIds([]);
        } else {
          const completed = completedOrders || [];

          setSalesCount(completed.length);

          setSoldProductIds(
            Array.from(
              new Set(
                completed.map((order) => order.product_id).filter(Boolean),
              ),
            ),
          );
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
  const soldProducts = products.filter((product) =>
    soldProductIds.includes(product.id),
  );

  const visibleProducts = tab === "closet" ? activeProducts : soldProducts;

  const location = [seller?.city, seller?.province].filter(Boolean).join(", ");

  /*
   * LOADING
   */
  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white text-black">
        <p className="text-sm text-zinc-400">Cargando closet...</p>
      </main>
    );
  }

  /*
   * NOT FOUND
   */
  if (!seller) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-5 text-black">
        <div className="text-center">
          <h1 className="text-xl font-black">Closet no encontrado</h1>

          <p className="mt-2 text-sm text-zinc-500">
            Este usuario no existe o ya no está disponible.
          </p>

          <Link
            href="/"
            className="mt-5 inline-block rounded-xl bg-black px-5 py-3 text-sm font-bold text-white"
          >
            Volver al inicio
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white pb-10 text-black">
      <div className="mx-auto max-w-md">
        {/* TOP BAR */}

        <div className="flex items-center justify-between px-4 py-4">
          <Link
            href="/"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100"
          >
            <ArrowLeft size={20} />
          </Link>

          <p className="max-w-[220px] truncate font-bold">@{displayUsername}</p>

          <div className="h-10 w-10" />
        </div>

        {/* PROFILE */}

        <section className="px-5 pt-4">
          <div className="flex items-center">
            {/* AVATAR */}

            {seller.avatar_url ? (
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-full bg-zinc-100">
                <img
                  src={seller.avatar_url}
                  alt={displayName}
                  className="h-full w-full object-cover"
                />
              </div>
            ) : (
              <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-black text-2xl font-bold text-white">
                {initial}
              </div>
            )}

            {/* STATS */}

            <div className="ml-5 flex flex-1 justify-around text-center">
              <div>
                <p className="text-lg font-black">{activeProducts.length}</p>

                <p className="text-xs text-zinc-500">Productos</p>
              </div>

              <div>
                <p className="text-lg font-black">{followersCount}</p>

                <p className="text-xs text-zinc-500">Seguidores</p>
              </div>

              <div>
                <p className="text-lg font-black">{salesCount}</p>

                <p className="text-xs text-zinc-500">Ventas</p>
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
              <div className="mt-2 flex items-center gap-1 text-xs text-zinc-500">
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
                  averageRating !== null ? "text-black" : "text-zinc-400"
                }
              />

              {averageRating !== null ? (
                <>
                  <span className="text-sm font-bold">
                    {averageRating.toFixed(1)}
                  </span>

                  <span className="text-xs text-zinc-400">
                    · {reviewCount}{" "}
                    {reviewCount === 1 ? "calificación" : "calificaciones"}
                  </span>
                </>
              ) : (
                <span className="text-xs text-zinc-400">
                  Sin calificaciones todavía
                </span>
              )}
            </div>

            {/* BIO */}

            {seller.bio && (
              <p className="mt-3 whitespace-pre-line text-sm leading-6 text-zinc-600">
                {seller.bio}
              </p>
            )}
          </div>

          {/* OWNER ACTIONS */}

          {isOwner ? (
            <div className="mt-5 flex gap-2">
              <Link
                href="/profile/edit"
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-300 py-3 text-sm font-bold"
              >
                <Pencil size={16} />
                Editar perfil
              </Link>

              <Link
                href="/seller/wallet"
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-black py-3 text-sm font-bold text-white"
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
                    ? "border border-zinc-300 bg-white text-black"
                    : "bg-black text-white"
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
                className="flex flex-1 items-center justify-center rounded-xl border border-zinc-300 py-3 text-sm font-bold transition disabled:opacity-50"
              >
                {messageLoading ? "Abriendo..." : "Mensaje"}
              </button>
            </div>
          )}

          {/* ERROR MESSAGE */}

          {message && (
            <div className="mt-4 rounded-xl bg-zinc-50 p-3 text-xs text-zinc-500">
              {message}
            </div>
          )}
        </section>

        {/* TABS */}

        <div className="mt-7 flex border-b border-zinc-200">
          <button
            type="button"
            onClick={() => setTab("closet")}
            className={`flex flex-1 items-center justify-center gap-2 border-b-2 py-3 text-xs ${
              tab === "closet"
                ? "border-black font-bold text-black"
                : "border-transparent text-zinc-400"
            }`}
          >
            <Grid3X3 size={16} />
            Closet
          </button>

          <button
            type="button"
            onClick={() => setTab("sold")}
            className={`flex flex-1 items-center justify-center gap-2 border-b-2 py-3 text-xs ${
              tab === "sold"
                ? "border-black font-bold text-black"
                : "border-transparent text-zinc-400"
            }`}
          >
            <Heart size={16} />
            Vendidos
          </button>

          <button
            type="button"
            onClick={() => setTab("reviews")}
            className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 py-3 text-xs ${
              tab === "reviews"
                ? "border-black font-bold text-black"
                : "border-transparent text-zinc-400"
            }`}
          >
            <Star size={15} />
            Calificaciones
          </button>
        </div>

        {tab !== "reviews" && (
          <>
            {/* EMPTY STATE / PRODUCTS */}

            {visibleProducts.length === 0 ? (
              <section className="flex min-h-[280px] flex-col items-center justify-center px-6 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100">
                  {tab === "closet" ? (
                    <Grid3X3 size={22} className="text-zinc-400" />
                  ) : (
                    <Heart size={22} className="text-zinc-400" />
                  )}
                </div>

                <p className="mt-4 text-sm font-bold">
                  {tab === "closet"
                    ? "Este closet está vacío"
                    : "Todavía no hay artículos vendidos"}
                </p>

                <p className="mt-1 text-xs text-zinc-400">
                  {tab === "closet"
                    ? isOwner
                      ? "Publica tu primer artículo para comenzar."
                      : "Este vendedor no tiene artículos disponibles."
                    : "Los artículos vendidos aparecerán aquí."}
                </p>

                {tab === "closet" && isOwner && (
                  <Link
                    href="/sell"
                    className="mt-5 rounded-xl bg-black px-5 py-3 text-sm font-bold text-white"
                  >
                    Vender un artículo
                  </Link>
                )}
              </section>
            ) : (
              <section className="grid grid-cols-2 gap-x-1 gap-y-5 pt-1">
                {visibleProducts.map((product) => {
                  const cover = product.product_images?.[0]?.image_url || null;

                  const isSold = tab === "sold";
                  return (
                    <Link key={product.id} href={`/product/${product.id}`}>
                      <article>
                        <div className="relative aspect-[3/4] overflow-hidden bg-zinc-100">
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

                          {isSold && (
                            <div className="absolute inset-x-0 bottom-0 bg-black/75 px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wider text-white">
                              Vendido
                            </div>
                          )}
                        </div>

                        <div className="px-3 pt-3">
                          <p className="truncate text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400">
                            {product.brand || "Sin marca"}
                          </p>

                          <h2 className="mt-1 truncate text-sm font-semibold">
                            {product.title}
                          </h2>

                          <p className="mt-2 text-lg font-black">
                            ${Number(product.price).toFixed(2)}
                          </p>
                        </div>
                      </article>
                    </Link>
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
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-100">
                  <Star size={22} className="text-zinc-400" />
                </div>

                <p className="mt-4 text-sm font-bold">
                  Sin calificaciones todavía
                </p>

                <p className="mt-1 max-w-[260px] text-xs leading-5 text-zinc-400">
                  Las calificaciones de compras verificadas aparecerán aquí.
                </p>
              </div>
            ) : (
              <>
                {/* RATING SUMMARY */}

                <div className="mb-6 rounded-2xl bg-zinc-50 p-5">
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
                                active ? "text-black" : "text-zinc-300"
                              }
                            />
                          );
                        })}
                      </div>

                      <p className="mt-1 text-xs text-zinc-400">
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
                        className="border-b border-zinc-100 pb-5"
                      >
                        <div className="flex items-start gap-3">
                          {review.reviewer?.avatar_url ? (
                            <img
                              src={review.reviewer.avatar_url}
                              alt={reviewerName}
                              className="h-10 w-10 rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm font-black">
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
                                  <p className="text-xs text-zinc-400">
                                    @{reviewerUsername}
                                  </p>
                                )}
                              </div>

                              <span className="shrink-0 text-[11px] text-zinc-400">
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
                                        ? "text-black"
                                        : "text-zinc-300"
                                    }
                                  />
                                ))}
                              </div>

                              <span className="text-[10px] font-bold uppercase tracking-wide text-zinc-400">
                                Compra verificada
                              </span>
                            </div>

                            {review.comment && (
                              <p className="mt-3 whitespace-pre-line text-sm leading-6 text-zinc-600">
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
