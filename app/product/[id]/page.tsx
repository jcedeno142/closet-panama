"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Heart,
  MapPin,
  MoreHorizontal,
  ShieldCheck,
  Star,
} from "lucide-react";

export default function ProductPage() {
  return (
    <main className="min-h-screen bg-white pb-28 text-black">
      <div className="mx-auto max-w-md">

        {/* PRODUCT IMAGE */}
        <div className="relative aspect-[3/4] overflow-hidden bg-zinc-100">
          <img
            src="https://images.unsplash.com/photo-1595777457583-95e059d581b8?auto=format&fit=crop&w=1000&q=85"
            alt="Vestido Satinado Zara"
            className="h-full w-full object-cover"
          />

          {/* TOP CONTROLS */}
          <div className="absolute left-0 right-0 top-0 flex items-center justify-between p-4">
            <Link
              href="/"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-sm"
            >
              <ArrowLeft size={20} />
            </Link>

            <div className="flex gap-2">
              <button className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-sm">
                <Heart size={20} />
              </button>

              <button className="flex h-10 w-10 items-center justify-center rounded-full bg-white/90 shadow-sm">
                <MoreHorizontal size={20} />
              </button>
            </div>
          </div>

          {/* IMAGE COUNT */}
          <div className="absolute bottom-4 right-4 rounded-full bg-black/70 px-3 py-1.5 text-xs font-semibold text-white">
            1 / 4
          </div>
        </div>

        {/* PRODUCT INFORMATION */}
        <section className="px-5 py-6">
          <p className="text-xs font-bold tracking-[0.18em] text-zinc-400">
            ZARA
          </p>

          <h1 className="mt-2 text-2xl font-bold">
            Vestido Satinado
          </h1>

          <p className="mt-3 text-3xl font-black">
            $24
          </p>

          <div className="mt-5 flex gap-2">
            <InfoPill label="Talla" value="S" />
            <InfoPill label="Condición" value="Como nuevo" />
            <InfoPill label="Color" value="Negro" />
          </div>

          <div className="mt-6 flex items-center gap-2 text-sm text-zinc-500">
            <MapPin size={16} />
            Panamá, Panamá
          </div>
        </section>

        <div className="h-2 bg-zinc-50" />

        {/* DESCRIPTION */}
        <section className="px-5 py-6">
          <h2 className="font-bold">Descripción</h2>

          <p className="mt-3 text-sm leading-6 text-zinc-600">
            Vestido satinado Zara en excelente condición. Usado solamente
            una vez. No tiene manchas ni daños. Perfecto para cenas,
            eventos o salir de noche.
          </p>
        </section>

        <div className="h-2 bg-zinc-50" />

        {/* SELLER */}
        <section className="px-5 py-6">
          <h2 className="mb-4 font-bold">Vendido por</h2>

          <Link
            href="/seller/andreacloset"
            className="flex items-center"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-black text-lg font-bold text-white">
              A
            </div>

            <div className="ml-3 flex-1">
              <div className="flex items-center gap-1">
                <p className="font-bold">@ana'scloset</p>
                <ShieldCheck size={15} />
              </div>

              <div className="mt-1 flex items-center gap-1 text-xs text-zinc-500">
                <Star size={13} fill="currentColor" />
                <span>4.9</span>
                <span>·</span>
                <span>27 ventas</span>
              </div>
            </div>

            <span className="text-sm font-semibold">
              Ver closet →
            </span>
          </Link>
        </section>

        <div className="h-2 bg-zinc-50" />

        {/* PROTECTION */}
        <section className="px-5 py-6">
          <div className="flex gap-3">
            <ShieldCheck size={22} />

            <div>
              <h3 className="text-sm font-bold">
                Compra protegida
              </h3>

              <p className="mt-1 text-xs leading-5 text-zinc-500">
                Tu pago permanece protegido hasta que recibas tu compra.
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* BUY BAR */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-200 bg-white p-3">
        <div className="mx-auto flex max-w-md gap-2">

          <button className="flex-1 rounded-2xl border border-black px-4 py-4 text-sm font-bold">
            Hacer oferta
          </button>

          <button className="flex-1 rounded-2xl bg-black px-4 py-4 text-sm font-bold text-white">
            Comprar · $24
          </button>

        </div>
      </div>
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