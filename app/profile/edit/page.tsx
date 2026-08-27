"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  city: string | null;
  province: string | null;
  account_type: "personal" | "business";
};

export default function EditProfilePage() {
  const supabase = createClient();

  const [profileId, setProfileId] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [accountType, setAccountType] = useState<
    "personal" | "business"
  >("personal");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/auth";
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();

      if (error || !data) {
        setMessage(
          error?.message || "No se pudo cargar el perfil."
        );
        setLoading(false);
        return;
      }

      const profile = data as Profile;

      setProfileId(profile.id);
      setUsername(profile.username || "");
      setDisplayName(profile.display_name || "");
      setBio(profile.bio || "");
      setCity(profile.city || "");
      setProvince(profile.province || "");
      setAccountType(profile.account_type || "personal");

      setLoading(false);
    }

    loadProfile();
  }, [supabase]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();

    setSaving(true);
    setMessage("");

    const cleanUsername = username
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "");

    const { error } = await supabase
      .from("profiles")
      .update({
        username: cleanUsername,
        display_name: displayName.trim(),
        bio: bio.trim(),
        city: city.trim(),
        province: province.trim(),
        account_type: accountType,
      })
      .eq("id", profileId);

    if (error) {
      setMessage(error.message);
      setSaving(false);
      return;
    }

    setMessage("Perfil actualizado correctamente.");

    setTimeout(() => {
      window.location.href = "/profile";
    }, 700);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white text-black">
        <p className="text-sm text-zinc-500">
          Cargando perfil...
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white pb-12 text-black">
      <div className="mx-auto max-w-md">

        {/* HEADER */}
        <header className="sticky top-0 z-40 flex items-center justify-between border-b border-zinc-100 bg-white px-4 py-4">
          <Link
            href="/profile"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100"
          >
            <ArrowLeft size={20} />
          </Link>

          <h1 className="font-bold">
            Editar perfil
          </h1>

          <div className="h-10 w-10" />
        </header>

        <form
          onSubmit={handleSave}
          className="px-5 py-6"
        >

          {/* ACCOUNT TYPE */}
          <div className="mb-6">
            <label className="text-sm font-bold">
              Tipo de cuenta
            </label>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() =>
                  setAccountType("personal")
                }
                className={`rounded-2xl border p-4 text-left ${
                  accountType === "personal"
                    ? "border-black bg-black text-white"
                    : "border-zinc-200"
                }`}
              >
                <p className="font-bold">
                  Closet personal
                </p>

                <p
                  className={`mt-1 text-xs ${
                    accountType === "personal"
                      ? "text-zinc-300"
                      : "text-zinc-500"
                  }`}
                >
                  Vende tu propia ropa
                </p>
              </button>

              <button
                type="button"
                onClick={() =>
                  setAccountType("business")
                }
                className={`rounded-2xl border p-4 text-left ${
                  accountType === "business"
                    ? "border-black bg-black text-white"
                    : "border-zinc-200"
                }`}
              >
                <p className="font-bold">
                  Boutique / Tienda
                </p>

                <p
                  className={`mt-1 text-xs ${
                    accountType === "business"
                      ? "text-zinc-300"
                      : "text-zinc-500"
                  }`}
                >
                  Vende como negocio
                </p>
              </button>
            </div>
          </div>

          {/* NAME */}
          <div className="mb-5">
            <label className="text-sm font-bold">
              Nombre
            </label>

            <input
              value={displayName}
              onChange={(e) =>
                setDisplayName(e.target.value)
              }
              placeholder="Tu nombre"
              className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-4 text-sm outline-none focus:border-black"
            />
          </div>

          {/* USERNAME */}
          <div className="mb-5">
            <label className="text-sm font-bold">
              Usuario
            </label>

            <div className="mt-2 flex items-center rounded-xl border border-zinc-200 px-4">
              <span className="text-zinc-400">
                @
              </span>

              <input
                value={username}
                onChange={(e) =>
                  setUsername(e.target.value)
                }
                placeholder="usuario"
                required
                className="w-full px-2 py-4 text-sm outline-none"
              />
            </div>
          </div>

          {/* BIO */}
          <div className="mb-5">
            <label className="text-sm font-bold">
              Biografía
            </label>

            <textarea
              value={bio}
              onChange={(e) =>
                setBio(e.target.value)
              }
              placeholder="Cuéntale a los compradores sobre ti o tu tienda..."
              rows={4}
              maxLength={250}
              className="mt-2 w-full resize-none rounded-xl border border-zinc-200 px-4 py-4 text-sm outline-none focus:border-black"
            />

            <p className="mt-1 text-right text-[11px] text-zinc-400">
              {bio.length}/250
            </p>
          </div>

          {/* PROVINCE */}
          <div className="mb-5">
            <label className="text-sm font-bold">
              Provincia
            </label>

            <select
              value={province}
              onChange={(e) =>
                setProvince(e.target.value)
              }
              className="mt-2 w-full rounded-xl border border-zinc-200 bg-white px-4 py-4 text-sm outline-none focus:border-black"
            >
              <option value="">
                Seleccionar provincia
              </option>

              <option value="Panamá">
                Panamá
              </option>

              <option value="Panamá Oeste">
                Panamá Oeste
              </option>

              <option value="Colón">
                Colón
              </option>

              <option value="Chiriquí">
                Chiriquí
              </option>

              <option value="Coclé">
                Coclé
              </option>

              <option value="Veraguas">
                Veraguas
              </option>

              <option value="Herrera">
                Herrera
              </option>

              <option value="Los Santos">
                Los Santos
              </option>

              <option value="Bocas del Toro">
                Bocas del Toro
              </option>

              <option value="Darién">
                Darién
              </option>
            </select>
          </div>

          {/* CITY */}
          <div className="mb-6">
            <label className="text-sm font-bold">
              Ciudad / Área
            </label>

            <input
              value={city}
              onChange={(e) =>
                setCity(e.target.value)
              }
              placeholder="Ej. San Francisco, David, La Chorrera..."
              className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-4 text-sm outline-none focus:border-black"
            />
          </div>

          {message && (
            <div className="mb-5 rounded-xl bg-zinc-100 p-4 text-sm">
              {message}
            </div>
          )}

          {/* SAVE */}
          <button
            type="submit"
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-black py-4 text-sm font-bold text-white disabled:opacity-50"
          >
            <Save size={18} />

            {saving
              ? "Guardando..."
              : "Guardar cambios"}
          </button>
        </form>
      </div>
    </main>
  );
}