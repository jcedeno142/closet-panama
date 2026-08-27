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

const products = [
  {
    id: 1,
    name: "Vestido Satinado",
    brand: "ZARA",
    size: "S",
    condition: "Como nuevo",
    price: 24,
    seller: "@andreacloset",
    location: "Panamá",
    image:
      "https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=900&q=80",
  },

  {
    id: 2,
    name: "Nike Dunk Low",
    brand: "NIKE",
    size: "US 8",
    condition: "Excelente",
    price: 80,
    seller: "@streetwearpty",
    location: "San Francisco",
    image:
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&w=900&q=80",
  },

  {
    id: 3,
    name: "Blazer Oversized",
    brand: "MANGO",
    size: "M",
    condition: "Como nuevo",
    price: 35,
    seller: "@closetpaula",
    location: "Costa del Este",
    image:
      "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=900&q=80",
  },

  {
    id: 4,
    name: "Bolso Mini",
    brand: "COACH",
    size: "Única",
    condition: "Muy bueno",
    price: 95,
    seller: "@luxurypty",
    location: "Panamá",
    image:
      "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=900&q=80",
  },
];

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
  return (
    <main className="min-h-screen bg-white pb-24 text-black">

      {/* HEADER */}
      <header className="sticky top-0 z-40 border-b border-zinc-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center justify-between px-4 py-4">

          <div>
            <h1 className="text-2xl font-black tracking-[-0.05em]">
              CLOSET
            </h1>

            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-400">
              Panamá
            </p>
          </div>

          <div className="flex gap-2">

            <button className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100">
              <Bell size={19} />
            </button>

            <button className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100">
              <ShoppingBag size={19} />
            </button>

          </div>
        </div>

        {/* SEARCH */}
        <div className="mx-auto max-w-md px-4 pb-3">
          <Link
            href="/search"
            className="flex items-center gap-3 rounded-2xl bg-zinc-100 px-4 py-3"
          >
            <Search
              size={18}
              className="text-zinc-400"
            />

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
            <h2 className="text-xl font-bold">
              Descubre
            </h2>

            <p className="text-xs text-zinc-400">
              Seleccionado para ti
            </p>
          </div>

          <MapPin
            size={18}
            className="text-zinc-400"
          />
        </div>

        <div className="grid grid-cols-2 gap-x-1 gap-y-5">

          {products.map((product) => (
            <article key={product.id}>

              {/* PRODUCT IMAGE */}
              <Link
                href={`/product/${product.id}`}
                className="relative block aspect-[3/4] overflow-hidden bg-zinc-100"
              >
                <img
                  src={product.image}
                  alt={product.name}
                  className="h-full w-full object-cover"
                />

                <button
                  onClick={(event) => {
                    event.preventDefault();
                  }}
                  className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 shadow-sm"
                >
                  <Heart size={18} />
                </button>
              </Link>

              {/* PRODUCT INFO */}
              <div className="px-3 pt-3">

                <p className="text-[10px] font-bold tracking-[0.15em] text-zinc-400">
                  {product.brand}
                </p>

                <Link href={`/product/${product.id}`}>
                  <h3 className="mt-1 truncate text-sm font-semibold">
                    {product.name}
                  </h3>
                </Link>

                <div className="mt-1 flex gap-1 text-[11px] text-zinc-500">
                  <span>
                    {product.size}
                  </span>

                  <span>
                    ·
                  </span>

                  <span>
                    {product.condition}
                  </span>
                </div>

                <p className="mt-2 text-lg font-black">
                  ${product.price}
                </p>

                <div className="mt-2 border-t border-zinc-100 pt-2">

                  <Link
                    href="/seller/andreacloset"
                    className="truncate text-[11px] font-semibold"
                  >
                    {product.seller}
                  </Link>

                  <div className="mt-1 flex items-center gap-1 text-[10px] text-zinc-400">
                    <MapPin size={10} />

                    {product.location}
                  </div>
                </div>
              </div>
            </article>
          ))}

        </div>
      </section>

      {/* BOTTOM NAVIGATION */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-md items-center justify-around px-2 py-2">

          <NavItem
            icon={<Home size={21} />}
            label="Inicio"
            href="/"
            active
          />

          <NavItem
            icon={<Search size={21} />}
            label="Buscar"
            href="/search"
          />

          <Link
            href="/sell"
            className="flex flex-col items-center gap-1"
          >
            <div className="flex h-11 w-14 items-center justify-center rounded-2xl bg-black text-white">
              <Plus size={25} />
            </div>

            <span className="text-[10px] font-medium">
              Vender
            </span>
          </Link>

          <NavItem
            icon={<MessageCircle size={21} />}
            label="Inbox"
            href="/inbox"
          />

          <NavItem
            icon={<User size={21} />}
            label="Perfil"
            href="/profile"
          />

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
        active
          ? "text-black"
          : "text-zinc-400"
      }`}
    >
      {icon}

      <span className="text-[10px] font-medium">
        {label}
      </span>
    </Link>
  );
}