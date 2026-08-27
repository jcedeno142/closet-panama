"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Filter,
  Heart,
  MapPin,
  Search,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type ProductImage = {
  image_url: string;
  position: number;
};

type Product = {
  id: string;
  title: string;
  brand: string | null;
  category: string | null;
  size: string | null;
  condition: string;
  price: number;
  city: string | null;
  province: string | null;
  seller_id: string;
  product_images: ProductImage[];
  seller_username: string;
};

const provinces = [
  "Panamá",
  "Panamá Oeste",
  "Colón",
  "Chiriquí",
  "Coclé",
  "Veraguas",
  "Herrera",
  "Los Santos",
  "Bocas del Toro",
  "Darién",
];

const conditionLabels: Record<string, string> = {
  new: "Nuevo",
  like_new: "Como nuevo",
  good: "Buen estado",
  fair: "Estado aceptable",
};

export default function SearchPage() {
  const supabase = createClient();

  const [products, setProducts] = useState<Product[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(
    new Set()
  );

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [condition, setCondition] = useState("");
  const [size, setSize] = useState("");
  const [province, setProvince] = useState("");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");

  const [showFilters, setShowFilters] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadFavorites = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setFavoriteIds(new Set());
      return;
    }

    const { data, error } = await supabase
      .from("favorites")
      .select("product_id")
      .eq("user_id", user.id);

    if (error) {
      console.error(error);
      return;
    }

    setFavoriteIds(
      new Set(
        (data || []).map((favorite) => favorite.product_id)
      )
    );
  }, [supabase]);

  const loadProducts = useCallback(async () => {
    setLoading(true);
    setError("");

    const { data: productData, error: productError } =
      await supabase
        .from("products")
        .select(`
          id,
          title,
          brand,
          category,
          size,
          condition,
          price,
          city,
          province,
          seller_id,
          product_images (
            image_url,
            position
          )
        `)
        .eq("status", "active")
        .order("created_at", { ascending: false });

    if (productError) {
      setError(productError.message);
      setLoading(false);
      return;
    }

    const sellerIds = [
      ...new Set(
        (productData || []).map(
          (product) => product.seller_id
        )
      ),
    ];

    let sellerMap: Record<string, string> = {};

    if (sellerIds.length > 0) {
      const { data: sellers, error: sellerError } =
        await supabase
          .from("profiles")
          .select("id, username")
          .in("id", sellerIds);

      if (sellerError) {
        setError(sellerError.message);
        setLoading(false);
        return;
      }

      sellerMap = Object.fromEntries(
        (sellers || []).map((seller) => [
          seller.id,
          seller.username,
        ])
      );
    }

    const cleanProducts: Product[] = (productData || []).map(
      (product) => ({
        id: product.id,
        title: product.title,
        brand: product.brand,
        category: product.category,
        size: product.size,
        condition: product.condition,
        price: product.price,
        city: product.city,
        province: product.province,
        seller_id: product.seller_id,
        seller_username:
          sellerMap[product.seller_id] || "vendedor",
        product_images: [
          ...(product.product_images || []),
        ].sort((a, b) => a.position - b.position),
      })
    );

    setProducts(cleanProducts);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    loadProducts();
    loadFavorites();
  }, [loadProducts, loadFavorites]);

  const filteredProducts = useMemo(() => {
    const searchText = query.trim().toLowerCase();

    return products.filter((product) => {
      const searchableText = [
        product.title,
        product.brand,
        product.size,
        product.city,
        product.province,
        product.seller_username,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !searchText ||
        searchableText.includes(searchText);

      const matchesCategory =
        !category ||
        product.category === category;

      const matchesCondition =
        !condition ||
        product.condition === condition;

      const matchesSize =
        !size ||
        product.size
          ?.toLowerCase()
          .includes(size.toLowerCase());

      const matchesProvince =
        !province ||
        product.province === province;

      const minimum =
        minPrice === ""
          ? null
          : Number(minPrice);

      const maximum =
        maxPrice === ""
          ? null
          : Number(maxPrice);

      const matchesMin =
        minimum === null ||
        Number(product.price) >= minimum;

      const matchesMax =
        maximum === null ||
        Number(product.price) <= maximum;

      return (
        matchesSearch &&
        matchesCategory &&
        matchesCondition &&
        matchesSize &&
        matchesProvince &&
        matchesMin &&
        matchesMax
      );
    });
  }, [
    products,
    query,
    category,
    condition,
    size,
    province,
    minPrice,
    maxPrice,
  ]);

  async function toggleFavorite(productId: string) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/auth";
      return;
    }

    if (favoriteIds.has(productId)) {
      const { error } = await supabase
        .from("favorites")
        .delete()
        .eq("user_id", user.id)
        .eq("product_id", productId);

      if (error) {
        console.error(error);
        return;
      }

      setFavoriteIds((current) => {
        const updated = new Set(current);
        updated.delete(productId);
        return updated;
      });
    } else {
      const { error } = await supabase
        .from("favorites")
        .insert({
          user_id: user.id,
          product_id: productId,
        });

      if (error) {
        console.error(error);
        return;
      }

      setFavoriteIds((current) => {
        const updated = new Set(current);
        updated.add(productId);
        return updated;
      });
    }
  }

  function clearFilters() {
    setCategory("");
    setCondition("");
    setSize("");
    setProvince("");
    setMinPrice("");
    setMaxPrice("");
  }

  const hasFilters =
    category ||
    condition ||
    size ||
    province ||
    minPrice ||
    maxPrice;

  return (
    <main className="min-h-screen bg-white pb-10 text-black">
      <div className="mx-auto max-w-md">

        {/* HEADER */}
        <header className="sticky top-0 z-40 border-b border-zinc-100 bg-white">
          <div className="flex items-center gap-3 px-4 py-4">

            <Link
              href="/"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100"
            >
              <ArrowLeft size={20} />
            </Link>

            {/* SEARCH INPUT */}
            <div className="flex flex-1 items-center gap-2 rounded-2xl bg-zinc-100 px-4">
              <Search
                size={18}
                className="shrink-0 text-zinc-400"
              />

              <input
                value={query}
                onChange={(e) =>
                  setQuery(e.target.value)
                }
                autoFocus
                placeholder="Buscar ropa, marcas, tiendas..."
                className="w-full bg-transparent py-3 text-sm outline-none"
              />

              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                >
                  <X
                    size={16}
                    className="text-zinc-400"
                  />
                </button>
              )}
            </div>

            {/* FILTER BUTTON */}
            <button
              type="button"
              onClick={() =>
                setShowFilters(
                  (current) => !current
                )
              }
              className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${
                hasFilters
                  ? "bg-black text-white"
                  : "bg-zinc-100"
              }`}
            >
              <Filter size={18} />

              {hasFilters && (
                <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full border-2 border-white bg-black" />
              )}
            </button>
          </div>

          {/* FILTER PANEL */}
          {showFilters && (
            <div className="border-t border-zinc-100 px-4 py-5">

              <div className="grid grid-cols-2 gap-3">

                <FilterField label="Categoría">
                  <select
                    value={category}
                    onChange={(e) =>
                      setCategory(e.target.value)
                    }
                    className="filter-input"
                  >
                    <option value="">
                      Todas
                    </option>

                    <option value="women">
                      Mujer
                    </option>

                    <option value="men">
                      Hombre
                    </option>

                    <option value="shoes">
                      Zapatos
                    </option>

                    <option value="bags">
                      Bolsos
                    </option>

                    <option value="accessories">
                      Accesorios
                    </option>

                    <option value="kids">
                      Niños
                    </option>
                  </select>
                </FilterField>

                <FilterField label="Condición">
                  <select
                    value={condition}
                    onChange={(e) =>
                      setCondition(e.target.value)
                    }
                    className="filter-input"
                  >
                    <option value="">
                      Todas
                    </option>

                    <option value="new">
                      Nuevo
                    </option>

                    <option value="like_new">
                      Como nuevo
                    </option>

                    <option value="good">
                      Buen estado
                    </option>

                    <option value="fair">
                      Estado aceptable
                    </option>
                  </select>
                </FilterField>

                <FilterField label="Talla">
                  <input
                    value={size}
                    onChange={(e) =>
                      setSize(e.target.value)
                    }
                    placeholder="Ej. S, M, 38"
                    className="filter-input"
                  />
                </FilterField>

                <FilterField label="Provincia">
                  <select
                    value={province}
                    onChange={(e) =>
                      setProvince(e.target.value)
                    }
                    className="filter-input"
                  >
                    <option value="">
                      Todas
                    </option>

                    {provinces.map((item) => (
                      <option
                        key={item}
                        value={item}
                      >
                        {item}
                      </option>
                    ))}
                  </select>
                </FilterField>

                <FilterField label="Precio mínimo">
                  <input
                    type="number"
                    min="0"
                    value={minPrice}
                    onChange={(e) =>
                      setMinPrice(e.target.value)
                    }
                    placeholder="$0"
                    className="filter-input"
                  />
                </FilterField>

                <FilterField label="Precio máximo">
                  <input
                    type="number"
                    min="0"
                    value={maxPrice}
                    onChange={(e) =>
                      setMaxPrice(e.target.value)
                    }
                    placeholder="$500"
                    className="filter-input"
                  />
                </FilterField>

              </div>

              {hasFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-4 text-xs font-bold underline"
                >
                  Limpiar filtros
                </button>
              )}
            </div>
          )}
        </header>

        {/* RESULTS INFO */}
        <section className="px-4 py-5">
          <h1 className="text-xl font-bold">
            {query
              ? `Resultados para "${query}"`
              : "Explorar"}
          </h1>

          {!loading && !error && (
            <p className="mt-1 text-xs text-zinc-400">
              {filteredProducts.length}
              {" "}
              {filteredProducts.length === 1
                ? "artículo"
                : "artículos"}
            </p>
          )}
        </section>

        {/* LOADING */}
        {loading && (
          <div className="py-16 text-center">
            <p className="text-sm text-zinc-500">
              Cargando productos...
            </p>
          </div>
        )}

        {/* ERROR */}
        {!loading && error && (
          <div className="mx-4 rounded-xl bg-zinc-100 p-4 text-sm">
            {error}
          </div>
        )}

        {/* NO RESULTS */}
        {!loading &&
          !error &&
          filteredProducts.length === 0 && (
            <div className="px-5 py-16 text-center">
              <Search
                size={32}
                className="mx-auto text-zinc-300"
              />

              <h2 className="mt-4 font-bold">
                No encontramos resultados
              </h2>

              <p className="mt-2 text-sm text-zinc-500">
                Intenta buscar otra marca,
                artículo o vendedor.
              </p>

              {(query || hasFilters) && (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    clearFilters();
                  }}
                  className="mt-5 rounded-xl bg-black px-5 py-3 text-sm font-bold text-white"
                >
                  Limpiar búsqueda
                </button>
              )}
            </div>
          )}

        {/* PRODUCTS */}
        {!loading &&
          !error &&
          filteredProducts.length > 0 && (
            <section className="grid grid-cols-2 gap-x-1 gap-y-5">

              {filteredProducts.map(
                (product) => {
                  const cover =
                    product.product_images?.[0]
                      ?.image_url;

                  const location = [
                    product.city,
                    product.province,
                  ]
                    .filter(Boolean)
                    .join(", ");

                  const isFavorite =
                    favoriteIds.has(
                      product.id
                    );

                  return (
                    <article key={product.id}>

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

                            toggleFavorite(
                              product.id
                            );
                          }}
                          className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-sm"
                        >
                          <Heart
                            size={18}
                            fill={
                              isFavorite
                                ? "currentColor"
                                : "none"
                            }
                          />
                        </button>
                      </Link>

                      <div className="px-3 pt-3">

                        {product.brand && (
                          <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-zinc-400">
                            {product.brand}
                          </p>
                        )}

                        <Link
                          href={`/product/${product.id}`}
                        >
                          <h2 className="mt-1 truncate text-sm font-semibold">
                            {product.title}
                          </h2>
                        </Link>

                        <div className="mt-1 flex gap-1 text-[11px] text-zinc-500">

                          {product.size && (
                            <>
                              <span>
                                {product.size}
                              </span>

                              <span>
                                ·
                              </span>
                            </>
                          )}

                          <span>
                            {conditionLabels[
                              product.condition
                            ] ||
                              product.condition}
                          </span>
                        </div>

                        <p className="mt-2 text-lg font-black">
                          $
                          {Number(
                            product.price
                          ).toFixed(2)}
                        </p>

                        <div className="mt-2 border-t border-zinc-100 pt-2">

                          <Link
                            href={`/seller/${product.seller_username}`}
                            className="block truncate text-[11px] font-semibold"
                          >
                            @
                            {
                              product.seller_username
                            }
                          </Link>

                          {location && (
                            <div className="mt-1 flex items-center gap-1 text-[10px] text-zinc-400">
                              <MapPin
                                size={10}
                              />

                              {location}
                            </div>
                          )}

                        </div>
                      </div>
                    </article>
                  );
                }
              )}

            </section>
          )}
      </div>

      <style jsx global>{`
        .filter-input {
          margin-top: 0.5rem;
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid rgb(228 228 231);
          background: white;
          padding: 0.8rem;
          font-size: 0.75rem;
          outline: none;
        }

        .filter-input:focus {
          border-color: black;
        }
      `}</style>
    </main>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-[11px] font-bold">
        {label}
      </label>

      {children}
    </div>
  );
}