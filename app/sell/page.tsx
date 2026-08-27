"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Camera,
  ChevronRight,
  ImagePlus,
  MapPin,
} from "lucide-react";
import { useState } from "react";

export default function SellPage() {
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [description, setDescription] = useState("");

  return (
    <main className="min-h-screen bg-white pb-10 text-black">
      <div className="mx-auto max-w-md">

        {/* HEADER */}
        <header className="sticky top-0 z-40 flex items-center justify-between border-b border-zinc-100 bg-white px-4 py-4">
          <Link
            href="/"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100"
          >
            <ArrowLeft size={20} />
          </Link>

          <h1 className="font-bold">Vender artículo</h1>

          <div className="h-10 w-10" />
        </header>

        {/* PHOTOS */}
        <section className="px-5 py-6">
          <h2 className="text-sm font-bold">
            Fotos
          </h2>

          <p className="mt-1 text-xs text-zinc-400">
            Agrega hasta 8 fotos
          </p>

          <div className="mt-4 grid grid-cols-3 gap-3">

            <button className="flex aspect-square flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50">
              <Camera size={24} />

              <span className="mt-2 text-xs font-semibold">
                Cámara
              </span>
            </button>

            <button className="flex aspect-square flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50">
              <ImagePlus size={24} />

              <span className="mt-2 text-xs font-semibold">
                Galería
              </span>
            </button>

          </div>
        </section>

        <Divider />

        {/* TITLE */}
        <section className="px-5 py-5">
          <label className="text-sm font-bold">
            Título
          </label>

          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ej. Vestido Zara satinado"
            className="mt-3 w-full rounded-xl border border-zinc-200 px-4 py-4 text-sm outline-none focus:border-black"
          />
        </section>

        <Divider />

        {/* CATEGORY */}
        <section>
          <OptionRow label="Categoría" value="Seleccionar" />
          <OptionRow label="Marca" value="Seleccionar" />
          <OptionRow label="Talla" value="Seleccionar" />
          <OptionRow label="Color" value="Seleccionar" />
          <OptionRow label="Condición" value="Seleccionar" />
        </section>

        <Divider />

        {/* DESCRIPTION */}
        <section className="px-5 py-5">
          <label className="text-sm font-bold">
            Descripción
          </label>

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe el estado, uso, detalles o cualquier información importante..."
            rows={5}
            className="mt-3 w-full resize-none rounded-xl border border-zinc-200 px-4 py-4 text-sm outline-none focus:border-black"
          />
        </section>

        <Divider />

        {/* PRICE */}
        <section className="px-5 py-5">
          <label className="text-sm font-bold">
            Precio
          </label>

          <div className="mt-3 flex items-center rounded-xl border border-zinc-200 px-4">
            <span className="font-bold">
              $
            </span>

            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="0.00"
              className="w-full px-3 py-4 text-lg font-bold outline-none"
            />
          </div>

          <p className="mt-2 text-xs text-zinc-400">
            Podrás aceptar ofertas de compradores.
          </p>
        </section>

        <Divider />

        {/* LOCATION */}
        <section className="px-5 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold">
                Ubicación
              </h2>

              <div className="mt-2 flex items-center gap-2 text-sm text-zinc-500">
                <MapPin size={15} />
                Panamá
              </div>
            </div>

            <ChevronRight size={19} className="text-zinc-400" />
          </div>
        </section>

        <Divider />

        {/* DELIVERY */}
        <section>
          <OptionRow label="Entrega" value="Configurar" />
        </section>

        {/* PUBLISH */}
        <div className="px-5 py-7">
          <button className="w-full rounded-2xl bg-black py-4 text-sm font-bold text-white">
            Publicar artículo
          </button>

          <p className="mt-3 text-center text-[11px] leading-5 text-zinc-400">
            Al publicar confirmas que el artículo y la información proporcionada son auténticos.
          </p>
        </div>

      </div>
    </main>
  );
}

function OptionRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <button className="flex w-full items-center justify-between border-b border-zinc-100 px-5 py-5 text-left">
      <span className="text-sm font-semibold">
        {label}
      </span>

      <div className="flex items-center gap-2 text-sm text-zinc-400">
        <span>{value}</span>
        <ChevronRight size={18} />
      </div>
    </button>
  );
}

function Divider() {
  return <div className="h-2 bg-zinc-50" />;
}