"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Grid3X3,
  Heart,
  MapPin,
  ShieldCheck,
  Star,
} from "lucide-react";

const sellerProducts = [
  {
    id: 1,
    name: "Vestido Satinado",
    brand: "ZARA",
    price: 24,
    image:
      "https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: 5,
    name: "Top Negro",
    brand: "MANGO",
    price: 18,
    image:
      "https://images.unsplash.com/photo-1434389677669-e08b4cac3105?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: 6,
    name: "Jeans Straight",
    brand: "ZARA",
    price: 28,
    image:
      "https://images.unsplash.com/photo-1542272604-787c3835535d?auto=format&fit=crop&w=900&q=80",
  },
  {
    id: 7,
    name: "Blazer Beige",
    brand: "H&M",
    price: 30,
    image:
      "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?auto=format&fit=crop&w=900&q=80",
  },
];

export default function SellerPage() {
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

          <p className="font-bold">@ana'scloset</p>

          <div className="h-10 w-10" />
        </div>

        {/* PROFILE */}
        <section className="px-5 pt-4">
          <div className="flex items-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-black text-2xl font-bold text-white">
              A
            </div>

            <div className="ml-5 flex flex-1 justify-around text-center">
              <div>
                <p className="text-lg font-black">12</p>
                <p className="text-xs text-zinc-500">Productos</p>
              </div>

              <div>
                <p className="text-lg font-black">482</p>
                <p className="text-xs text-zinc-500">Seguidores</p>
              </div>

              <div>
                <p className="text-lg font-black">27</p>
                <p className="text-xs text-zinc-500">Ventas</p>
              </div>
            </div>
          </div>

          <div className="mt-5">
            <div className="flex items-center gap-1">
              <h1 className="text-xl font-bold">Ana's Closet</h1>
              <ShieldCheck size={17} />
            </div>

            <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
              <div className="flex items-center gap-1">
                <Star size={13} fill="currentColor" />
                <span>4.9</span>
              </div>

              <span>·</span>

              <div className="flex items-center gap-1">
                <MapPin size={13} />
                Panamá
              </div>
            </div>

            <p className="mt-3 text-sm leading-6 text-zinc-600">
              Ropa que ya no uso y algunas piezas nuevas. Envíos y entregas
              disponibles en Panamá.
            </p>
          </div>

          {/* ACTIONS */}
          <div className="mt-5 flex gap-2">
            <button className="flex-1 rounded-xl bg-black py-3 text-sm font-bold text-white">
              Seguir
            </button>

            <button className="flex-1 rounded-xl border border-zinc-300 py-3 text-sm font-bold">
              Mensaje
            </button>
          </div>
        </section>

        {/* TABS */}
        <div className="mt-7 flex border-b border-zinc-200">
          <button className="flex flex-1 items-center justify-center gap-2 border-b-2 border-black py-3 text-sm font-bold">
            <Grid3X3 size={16} />
            Closet
          </button>

          <button className="flex flex-1 items-center justify-center gap-2 py-3 text-sm text-zinc-400">
            <Heart size={16} />
            Vendidos
          </button>
        </div>

        {/* PRODUCTS */}
        <section className="grid grid-cols-2 gap-x-1 gap-y-5 pt-1">
          {sellerProducts.map((product) => (
            <Link key={product.id} href={`/product/${product.id}`}>
              <article>
                <div className="aspect-[3/4] overflow-hidden bg-zinc-100">
                  <img
                    src={product.image}
                    alt={product.name}
                    className="h-full w-full object-cover"
                  />
                </div>

                <div className="px-3 pt-3">
                  <p className="text-[10px] font-bold tracking-[0.15em] text-zinc-400">
                    {product.brand}
                  </p>

                  <h2 className="mt-1 truncate text-sm font-semibold">
                    {product.name}
                  </h2>

                  <p className="mt-2 text-lg font-black">
                    ${product.price}
                  </p>
                </div>
              </article>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}