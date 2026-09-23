"use client";

import Link from "next/link";
import { ArrowLeft, ImagePlus, MapPin, Trash2, X } from "lucide-react";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type ExistingImage = {
  id: string;
  image_url: string;
  position: number;
};

export default function EditProductPage() {
  const params = useParams();
  const productId = String(params.id || "");

  const supabase = useMemo(() => createClient(), []);

  const [currentUserId, setCurrentUserId] = useState("");

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

  const [existingImages, setExistingImages] = useState<ExistingImage[]>([]);
  const [newImages, setNewImages] = useState<File[]>([]);
  const [newPreviews, setNewPreviews] = useState<string[]>([]);

  const [pageLoading, setPageLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [message, setMessage] = useState("");
  const [authorized, setAuthorized] = useState(false);

  /*
   * LOAD PRODUCT
   */
  useEffect(() => {
    async function loadProduct() {
      setPageLoading(true);
      setMessage("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        window.location.href = "/auth";
        return;
      }

      setCurrentUserId(user.id);

      const { data: product, error: productError } = await supabase
        .from("products")
        .select(
          `
          id,
          seller_id,
          title,
          brand,
          category,
          size,
          color,
          condition,
          description,
          price,
          city,
          province
        `,
        )
        .eq("id", productId)
        .maybeSingle();

      if (productError) {
        console.error("Load product error:", productError);
        setMessage("No pudimos cargar el artículo.");
        setPageLoading(false);
        return;
      }

      if (!product) {
        setMessage("Este artículo no existe.");
        setPageLoading(false);
        return;
      }

      /*
       * OWNER CHECK
       */
      if (product.seller_id !== user.id) {
        setMessage("No tienes permiso para editar este artículo.");
        setPageLoading(false);
        return;
      }

      setAuthorized(true);

      /*
       * PREFILL FORM
       */
      setTitle(product.title || "");
      setBrand(product.brand || "");
      setCategory(product.category || "");
      setSize(product.size || "");
      setColor(product.color || "");
      setCondition(product.condition || "like_new");
      setDescription(product.description || "");
      setPrice(String(product.price ?? ""));
      setCity(product.city || "");
      setProvince(product.province || "");

      /*
       * LOAD EXISTING IMAGES
       */
      const { data: imageData, error: imageError } = await supabase
        .from("product_images")
        .select(
          `
          id,
          image_url,
          position
        `,
        )
        .eq("product_id", productId)
        .order("position", {
          ascending: true,
        });

      if (imageError) {
        console.error("Load product images error:", imageError);
      } else {
        setExistingImages((imageData || []) as ExistingImage[]);
      }

      setPageLoading(false);
    }

    if (productId) {
      loadProduct();
    }
  }, [productId, supabase]);

  /*
   * ADD NEW IMAGES
   */
  function handleImages(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files || []);

    const currentTotal = existingImages.length + newImages.length;
    const remaining = Math.max(0, 8 - currentTotal);

    const accepted = selected.slice(0, remaining);

    if (accepted.length === 0) {
      return;
    }

    setNewImages((current) => [...current, ...accepted]);

    const previews = accepted.map((file) => URL.createObjectURL(file));

    setNewPreviews((current) => [...current, ...previews]);

    event.target.value = "";
  }

  /*
   * REMOVE NEW IMAGE
   */
  function removeNewImage(index: number) {
    URL.revokeObjectURL(newPreviews[index]);

    setNewImages((current) => current.filter((_, i) => i !== index));

    setNewPreviews((current) => current.filter((_, i) => i !== index));
  }

  /*
   * REMOVE EXISTING IMAGE
   */
  async function removeExistingImage(image: ExistingImage) {
    if (existingImages.length + newImages.length <= 1) {
      setMessage("El artículo debe tener al menos una foto.");
      return;
    }

    const confirmed = window.confirm("¿Eliminar esta foto?");

    if (!confirmed) return;

    setMessage("");

    /*
     * Extract the file path from the Supabase public URL.
     *
     * Example:
     * .../storage/v1/object/public/product-images/
     * USER_ID/PRODUCT_ID/IMAGE.jpg
     */
    const marker = "/product-images/";
    const markerIndex = image.image_url.indexOf(marker);

    let storagePath: string | null = null;

    if (markerIndex !== -1) {
      storagePath = decodeURIComponent(
        image.image_url.substring(markerIndex + marker.length),
      );
    }

    /*
     * Delete the database record first.
     */
    const { error: deleteRecordError } = await supabase
      .from("product_images")
      .delete()
      .eq("id", image.id)
      .eq("product_id", productId);

    if (deleteRecordError) {
      console.error("Delete image record error:", deleteRecordError);

      setMessage("No pudimos eliminar la foto.");
      return;
    }

    /*
     * Delete the actual file from Storage.
     */
    if (storagePath) {
      const { error: storageError } = await supabase.storage
        .from("product-images")
        .remove([storagePath]);

      if (storageError) {
        console.error("Delete storage image error:", storageError);

        /*
         * Don't stop here because the database record
         * has already been removed.
         */
      }
    }

    /*
     * Remove it from the screen.
     */
    const remaining = existingImages.filter((item) => item.id !== image.id);

    /*
     * Re-number positions so the first remaining
     * image becomes position 0.
     */
    for (let index = 0; index < remaining.length; index++) {
      const { error: positionError } = await supabase
        .from("product_images")
        .update({
          position: index,
        })
        .eq("id", remaining[index].id);

      if (positionError) {
        console.error("Update image position error:", positionError);
      }
    }

    setExistingImages(
      remaining.map((item, index) => ({
        ...item,
        position: index,
      })),
    );

    setMessage("");
  }

  /*
   * SAVE PRODUCT
   */
  async function handleSave(event: React.FormEvent) {
    event.preventDefault();

    if (!currentUserId || !authorized) {
      return;
    }

    setSaving(true);
    setMessage("");

    if (!title.trim()) {
      setMessage("Agrega un título.");
      setSaving(false);
      return;
    }

    if (!price || Number(price) <= 0) {
      setMessage("Agrega un precio válido.");
      setSaving(false);
      return;
    }

    if (existingImages.length + newImages.length === 0) {
      setMessage("Agrega al menos una foto.");
      setSaving(false);
      return;
    }

    /*
     * UPDATE PRODUCT
     *
     * seller_id check protects against attempting
     * to update another seller's product.
     */
    const { error: updateError } = await supabase
      .from("products")
      .update({
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
      })
      .eq("id", productId)
      .eq("seller_id", currentUserId);

    if (updateError) {
      console.error("Update product error:", updateError);
      setMessage(updateError.message);
      setSaving(false);
      return;
    }

    /*
     * UPLOAD NEW IMAGES
     */
    let nextPosition = existingImages.length;

    for (let index = 0; index < newImages.length; index++) {
      const file = newImages[index];

      const extension = file.name.split(".").pop() || "jpg";

      const filePath = `${currentUserId}/${productId}/${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.error("Upload image error:", uploadError);

        setMessage(
          `Los cambios se guardaron, pero una foto no pudo subirse: ${uploadError.message}`,
        );

        setSaving(false);
        return;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("product-images").getPublicUrl(filePath);

      const { error: imageRecordError } = await supabase
        .from("product_images")
        .insert({
          product_id: productId,
          image_url: publicUrl,
          position: nextPosition,
        });

      if (imageRecordError) {
        console.error("Create image record error:", imageRecordError);

        setMessage(
          `La foto se subió, pero no pudo agregarse al artículo: ${imageRecordError.message}`,
        );

        setSaving(false);
        return;
      }

      nextPosition++;
    }

    setMessage("Cambios guardados correctamente.");

    setTimeout(() => {
      window.location.href = `/product/${productId}`;
    }, 500);
  }

  /*
   * DELETE PRODUCT
   */
  async function deleteProduct() {
    if (!currentUserId || !authorized || deleting) {
      return;
    }

    const confirmed = window.confirm(
      "¿Seguro que quieres eliminar esta publicación? Esta acción no se puede deshacer.",
    );

    if (!confirmed) return;

    setDeleting(true);
    setMessage("");

    /*
     * Delete image records first.
     *
     * Product ownership is still verified above and
     * the products delete also includes seller_id.
     */
    const { error: imageDeleteError } = await supabase
      .from("product_images")
      .delete()
      .eq("product_id", productId);

    if (imageDeleteError) {
      console.error("Delete image records error:", imageDeleteError);
      setMessage("No pudimos eliminar las fotos del artículo.");
      setDeleting(false);
      return;
    }

    const { error: productDeleteError } = await supabase
      .from("products")
      .delete()
      .eq("id", productId)
      .eq("seller_id", currentUserId);

    if (productDeleteError) {
      console.error("Delete product error:", productDeleteError);
      setMessage(productDeleteError.message);
      setDeleting(false);
      return;
    }

    window.location.href = "/profile";
  }

  /*
   * LOADING
   */
  if (pageLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white text-black">
        <p className="text-sm text-zinc-400">Cargando publicación...</p>
      </main>
    );
  }

  /*
   * NOT AUTHORIZED / NOT FOUND
   */
  if (!authorized) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-6 text-black">
        <div className="text-center">
          <h1 className="text-lg font-bold">
            No puedes editar esta publicación
          </h1>

          <p className="mt-2 text-sm text-zinc-500">
            {message || "No tienes acceso a este artículo."}
          </p>

          <Link
            href="/"
            className="mt-5 inline-block rounded-xl bg-black px-5 py-3 text-sm font-bold text-white"
          >
            Volver
          </Link>
        </div>
      </main>
    );
  }

  const totalImages = existingImages.length + newImages.length;

  return (
    <main className="min-h-screen bg-white pb-10 text-black">
      <div className="mx-auto max-w-md">
        {/* HEADER */}
        <header className="sticky top-0 z-40 flex items-center justify-between border-b border-zinc-100 bg-white px-4 py-4">
          <Link
            href={`/product/${productId}`}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100"
          >
            <ArrowLeft size={20} />
          </Link>

          <h1 className="font-bold">Editar publicación</h1>

          <div className="h-10 w-10" />
        </header>

        <form onSubmit={handleSave}>
          {/* PHOTOS */}
          <section className="px-5 py-6">
            <h2 className="text-sm font-bold">Fotos</h2>

            <p className="mt-1 text-xs text-zinc-400">
              Puedes tener hasta 8 fotos.
            </p>

            <div className="mt-4 grid grid-cols-3 gap-3">
              {/* EXISTING IMAGES */}
              {existingImages.map((image, index) => (
                <div
                  key={image.id}
                  className="relative aspect-square overflow-hidden rounded-2xl bg-zinc-100"
                >
                  <img
                    src={image.image_url}
                    alt={`Foto ${index + 1}`}
                    className="h-full w-full object-cover"
                  />

                  <button
                    type="button"
                    onClick={() => removeExistingImage(image)}
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

              {/* NEW IMAGES */}
              {newPreviews.map((preview, index) => (
                <div
                  key={preview}
                  className="relative aspect-square overflow-hidden rounded-2xl bg-zinc-100"
                >
                  <img
                    src={preview}
                    alt={`Nueva foto ${index + 1}`}
                    className="h-full w-full object-cover"
                  />

                  <button
                    type="button"
                    onClick={() => removeNewImage(index)}
                    className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white"
                  >
                    <X size={15} />
                  </button>

                  {existingImages.length === 0 && index === 0 && (
                    <span className="absolute bottom-2 left-2 rounded-full bg-black/70 px-2 py-1 text-[9px] font-bold text-white">
                      PORTADA
                    </span>
                  )}
                </div>
              ))}

              {/* ADD IMAGE */}
              {totalImages < 8 && (
                <label className="flex aspect-square cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50">
                  <ImagePlus size={24} />

                  <span className="mt-2 text-xs font-semibold">Agregar</span>

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
              <option value="">Seleccionar</option>
              <option value="women">Mujer</option>
              <option value="men">Hombre</option>
              <option value="shoes">Zapatos</option>
              <option value="bags">Bolsos</option>
              <option value="accessories">Accesorios</option>
              <option value="kids">Niños</option>
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
              <option value="new">Nuevo</option>
              <option value="like_new">Como nuevo</option>
              <option value="good">Buen estado</option>
              <option value="fair">Estado aceptable</option>
            </select>
          </Field>

          <Divider />

          <Field label="Descripción">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe el estado, uso y detalles importantes..."
              rows={5}
              className="input resize-none"
            />
          </Field>

          <Divider />

          <Field label="Precio">
            <div className="mt-3 flex items-center rounded-xl border border-zinc-200 px-4">
              <span className="font-bold">$</span>

              <input
                type="number"
                min="0.01"
                step="0.01"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
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
              onChange={(e) => setProvince(e.target.value)}
              className="input bg-white"
            >
              <option value="">Seleccionar provincia</option>
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
              <MapPin size={16} className="text-zinc-400" />

              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="Ej. San Francisco, David..."
                className="w-full py-4 text-sm outline-none"
              />
            </div>
          </Field>

          {/* MESSAGE */}
          {message && (
            <div className="mx-5 mt-5 rounded-xl bg-zinc-100 p-4 text-sm">
              {message}
            </div>
          )}

          {/* SAVE */}
          <div className="px-5 pb-4 pt-7">
            <button
              type="submit"
              disabled={saving || deleting}
              className="w-full rounded-2xl bg-black py-4 text-sm font-bold text-white disabled:opacity-50"
            >
              {saving ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </form>

        {/* DELETE */}
        <div className="px-5 pb-10">
          <button
            type="button"
            onClick={deleteProduct}
            disabled={saving || deleting}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-red-200 py-4 text-sm font-bold text-red-600 disabled:opacity-50"
          >
            <Trash2 size={17} />

            {deleting ? "Eliminando..." : "Eliminar publicación"}
          </button>
        </div>
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
      <label className="text-sm font-bold">{label}</label>
      {children}
    </section>
  );
}

function Divider() {
  return <div className="h-2 bg-zinc-50" />;
}
