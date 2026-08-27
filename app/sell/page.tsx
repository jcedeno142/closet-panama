"use client";

import Link from "next/link";
import {
  ArrowLeft,
  ImagePlus,
  MapPin,
  X,
} from "lucide-react";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SellPage() {
  const supabase = createClient();

  const [title, setTitle] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const [condition, setCondition] = useState("like_new");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");

  const [images, setImages] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  function handleImages(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files || []);

    const remaining = 8 - images.length;
    const accepted = selected.slice(0, remaining);

    setImages((current) => [...current, ...accepted]);

    const newPreviews = accepted.map((file) =>
      URL.createObjectURL(file)
    );

    setPreviews((current) => [...current, ...newPreviews]);
  }

  function removeImage(index: number) {
    URL.revokeObjectURL(previews[index]);

    setImages((current) =>
      current.filter((_, i) => i !== index)
    );

    setPreviews((current) =>
      current.filter((_, i) => i !== index)
    );
  }

  async function handlePublish(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);
    setMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      setMessage("Debes iniciar sesión para publicar.");
      setLoading(false);
      return;
    }

    if (!title.trim()) {
      setMessage("Agrega un título.");
      setLoading(false);
      return;
    }

    if (!price || Number(price) <= 0) {
      setMessage("Agrega un precio válido.");
      setLoading(false);
      return;
    }

    if (images.length === 0) {
      setMessage("Agrega al menos una foto.");
      setLoading(false);
      return;
    }

    // CREATE PRODUCT
    const { data: product, error: productError } =
      await supabase
        .from("products")
        .insert({
          seller_id: user.id,
          title: title.trim(),
          description: description.trim() || null,
          brand: brand.trim() || null,
          category: category || null,
          size: size.trim() || null,
          color: color.trim() || null,
          condition,
          price: Number(price),
          city: city.trim() || null,
          province: province || null,
          status: "active",
        })
        .select()
        .single();

    if (productError || !product) {
      setMessage(
        productError?.message ||
          "No se pudo crear el artículo."
      );
      setLoading(false);
      return;
    }

    // UPLOAD IMAGES
    for (let index = 0; index < images.length; index++) {
      const file = images[index];

      const extension =
        file.name.split(".").pop() || "jpg";

      const filePath =
        `${user.id}/${product.id}/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } =
        await supabase.storage
          .from("product-images")
          .upload(filePath, file, {
            cacheControl: "3600",
            upsert: false,
          });

      if (uploadError) {
        setMessage(
          `El artículo se creó, pero una foto no pudo subirse: ${uploadError.message}`
        );

        setLoading(false);
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage
        .from("product-images")
        .getPublicUrl(filePath);

      const { error: imageRecordError } =
        await supabase
          .from("product_images")
          .insert({
            product_id: product.id,
            image_url: publicUrl,
            position: index,
          });

      if (imageRecordError) {
        setMessage(
          `La foto se subió, pero no pudo guardarse en el producto: ${imageRecordError.message}`
        );

        setLoading(false);
        return;
      }
    }

    setMessage("Artículo publicado correctamente.");

    setTimeout(() => {
      window.location.href = `/product/${product.id}`;
    }, 500);
  }

  return (
    <main className="min-h-screen bg-white pb-10 text-black">
      <div className="mx-auto max-w-md">

        <header className="sticky top-0 z-40 flex items-center justify-between border-b border-zinc-100 bg-white px-4 py-4">
          <Link
            href="/"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100"
          >
            <ArrowLeft size={20} />
          </Link>

          <h1 className="font-bold">
            Vender artículo
          </h1>

          <div className="h-10 w-10" />
        </header>

        <form onSubmit={handlePublish}>

          {/* PHOTOS */}
          <section className="px-5 py-6">
            <h2 className="text-sm font-bold">
              Fotos
            </h2>

            <p className="mt-1 text-xs text-zinc-400">
              Agrega hasta 8 fotos. La primera será la portada.
            </p>

            <div className="mt-4 grid grid-cols-3 gap-3">
              {previews.map((preview, index) => (
                <div
                  key={preview}
                  className="relative aspect-square overflow-hidden rounded-2xl bg-zinc-100"
                >
                  <img
                    src={preview}
                    alt={`Vista previa ${index + 1}`}
                    className="h-full w-full object-cover"
                  />

                  <button
                    type="button"
                    onClick={() => removeImage(index)}
                    className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white"
                  >
                    <X size={15} />
                  </button>

                  {index === 0 && (
                    <span className="absolute bottom-2 left-2 rounded-full bg-black/70 px-2 py-1 text-[9px] font-bold text-white">
                      PORTADA
                    </span>
                  )}
                </div>
              ))}

              {images.length < 8 && (
                <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50">
                  <ImagePlus size={24} />

                  <span className="mt-2 text-xs font-semibold">
                    Agregar
                  </span>

                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleImages}
                    className="hidden"
                  />
                </label>
              )}
            </div>
          </section>

          <Divider />

          <Field label="Título">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ej. Vestido Zara satinado"
              required
              className="input"
            />
          </Field>

          <Divider />

          <Field label="Marca">
            <input
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="Ej. Zara, Nike, Mango"
              className="input"
            />
          </Field>

          <Divider />

          <Field label="Categoría">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="input bg-white"
            >
              <option value="">
                Seleccionar
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
          </Field>

          <Divider />

          <Field label="Talla">
            <input
              value={size}
              onChange={(e) => setSize(e.target.value)}
              placeholder="Ej. S, M, L, 8, 38"
              className="input"
            />
          </Field>

          <Divider />

          <Field label="Color">
            <input
              value={color}
              onChange={(e) => setColor(e.target.value)}
              placeholder="Ej. Negro"
              className="input"
            />
          </Field>

          <Divider />

          <Field label="Condición">
            <select
              value={condition}
              onChange={(e) => setCondition(e.target.value)}
              className="input bg-white"
            >
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
          </Field>

          <Divider />

          <Field label="Descripción">
            <textarea
              value={description}
              onChange={(e) =>
                setDescription(e.target.value)
              }
              placeholder="Describe el estado, uso y detalles importantes..."
              rows={5}
              className="input resize-none"
            />
          </Field>

          <Divider />

          <Field label="Precio">
            <div className="mt-3 flex items-center rounded-xl border border-zinc-200 px-4">
              <span className="font-bold">
                $
              </span>

              <input
                type="number"
                min="0"
                step="0.01"
                value={price}
                onChange={(e) =>
                  setPrice(e.target.value)
                }
                placeholder="0.00"
                required
                className="w-full px-3 py-4 text-lg font-bold outline-none"
              />
            </div>
          </Field>

          <Divider />

          <Field label="Provincia">
            <select
              value={province}
              onChange={(e) =>
                setProvince(e.target.value)
              }
              className="input bg-white"
            >
              <option value="">
                Seleccionar provincia
              </option>
              <option value="Panamá">Panamá</option>
              <option value="Panamá Oeste">Panamá Oeste</option>
              <option value="Colón">Colón</option>
              <option value="Chiriquí">Chiriquí</option>
              <option value="Coclé">Coclé</option>
              <option value="Veraguas">Veraguas</option>
              <option value="Herrera">Herrera</option>
              <option value="Los Santos">Los Santos</option>
              <option value="Bocas del Toro">Bocas del Toro</option>
              <option value="Darién">Darién</option>
            </select>
          </Field>

          <Divider />

          <Field label="Ciudad / Área">
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-zinc-200 px-4">
              <MapPin
                size={16}
                className="text-zinc-400"
              />

              <input
                value={city}
                onChange={(e) =>
                  setCity(e.target.value)
                }
                placeholder="Ej. San Francisco, David..."
                className="w-full py-4 text-sm outline-none"
              />
            </div>
          </Field>

          {message && (
            <div className="mx-5 mt-5 rounded-xl bg-zinc-100 p-4 text-sm">
              {message}
            </div>
          )}

          <div className="px-5 py-7">
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-2xl bg-black py-4 text-sm font-bold text-white disabled:opacity-50"
            >
              {loading
                ? "Publicando..."
                : "Publicar artículo"}
            </button>
          </div>

        </form>
      </div>

      <style jsx global>{`
        .input {
          margin-top: 0.75rem;
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid rgb(228 228 231);
          padding: 1rem;
          font-size: 0.875rem;
          outline: none;
        }

        .input:focus {
          border-color: black;
        }
      `}</style>
    </main>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="px-5 py-5">
      <label className="text-sm font-bold">
        {label}
      </label>

      {children}
    </section>
  );
}

function Divider() {
  return <div className="h-2 bg-zinc-50" />;
}