"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useTheme } from "@/components/ThemeProvider";

type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  city: string | null;
  province: string | null;
  account_type: "personal" | "business";
  theme?: "light" | "black";
};

export default function EditProfilePage() {
  const supabase = createClient();

  const [profileId, setProfileId] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const { theme, setTheme } = useTheme();
  const [accountType, setAccountType] = useState<"personal" | "business">(
    "personal",
  );

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
        setMessage(error?.message || "No se pudo cargar el perfil.");
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

    const cleanUsername = username.toLowerCase().trim().replace(/\s+/g, "");

    const { error } = await supabase
      .from("profiles")
      .update({
        username: cleanUsername,
        display_name: displayName.trim(),
        bio: bio.trim(),
        city: city.trim(),
        province: province.trim(),
        theme,
      })
      .eq("id", profileId);

    if (error) {
      setMessage(error.message.includes("theme") ? "Falta activar los temas en Supabase. Ejecuta la migración profile_theme e inténtalo nuevamente." : error.message);
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
      <main className="profile-theme flex min-h-screen items-center justify-center bg-[var(--profile-bg)] text-[var(--profile-fg)]">
        <p className="text-sm text-[var(--profile-muted)]">Cargando perfil...</p>
      </main>
    );
  }

  return (
    <main className="profile-theme min-h-screen bg-[var(--profile-bg)] pb-12 text-[var(--profile-fg)]">
      <div className="mx-auto max-w-md">
        {/* HEADER */}
        <header className="sticky top-0 z-40 flex items-center justify-between border-b border-[var(--profile-border)] bg-[var(--profile-bg)] px-4 py-4">
          <Link
            href="/profile"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--profile-surface)]"
          >
            <ArrowLeft size={20} />
          </Link>

          <h1 className="font-bold">Editar perfil</h1>

          <div className="h-10 w-10" />
        </header>

        <div className="px-5 pt-6"><Link href="/profile/security" className="block rounded-xl bg-[var(--profile-surface)] p-4 text-sm font-bold">Seguridad: cédula, celular y códigos de verificación →</Link></div>
        <form onSubmit={handleSave} className="px-5 py-6">
          <fieldset className="mb-7" disabled={saving}>
            <legend className="text-sm font-bold">Tema de la aplicación</legend>
            <p className="mt-1 text-xs text-[var(--profile-muted)]">Se aplica a toda tu experiencia en Closet. Guarda los cambios para usarlo también en otros dispositivos.</p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              {([{ value: "light", label: "Claro", background: "#ffffff", foreground: "#09090b", surface: "#f4f4f5" },
                { value: "black", label: "Negro", background: "#09090b", foreground: "#fafafa", surface: "#27272a" }] as const).map(option => (
                <label key={option.value} className={`cursor-pointer rounded-2xl border p-3 ${theme === option.value ? "border-[var(--profile-fg)] ring-1 ring-[var(--profile-fg)]" : "border-[var(--profile-border)]"}`}>
                  <div aria-hidden="true" className="mb-3 rounded-xl border border-zinc-500/30 p-3" style={{ background: option.background, color: option.foreground }}>
                    <div className="flex items-center gap-2"><span className="flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold" style={{ background: option.foreground, color: option.background }}>{displayName.charAt(0).toUpperCase() || "A"}</span><span className="text-xs font-bold">Mi closet</span></div>
                    <div className="mt-3 grid grid-cols-2 gap-2"><div className="h-10 rounded" style={{ background: option.surface }} /><div className="h-10 rounded" style={{ background: option.surface }} /></div>
                  </div>
                  <span className="flex items-center gap-2 text-sm font-semibold"><input type="radio" name="profile-theme" value={option.value} checked={theme === option.value} onChange={() => setTheme(option.value)} className="accent-current" />{option.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {/* ACCOUNT TYPE */}
          <div className="mb-6">
            <label className="text-sm font-bold">Tipo de cuenta</label>

            <div className="mt-3 grid grid-cols-2 gap-3">
              <div
                className={`rounded-2xl border p-4 text-left ${
                  accountType === "personal"
                    ? "border-[var(--profile-fg)] bg-[var(--profile-fg)] text-[var(--profile-on-accent)]"
                    : "border-[var(--profile-border)] bg-[var(--profile-soft)] opacity-60"
                }`}
              >
                <p className="font-bold">Closet personal</p>

                <p
                  className={`mt-1 text-xs ${
                    accountType === "personal"
                      ? "text-[var(--profile-muted)]"
                      : "text-[var(--profile-muted)]"
                  }`}
                >
                  Vende tu propia ropa
                </p>
              </div>

              <div
                className={`rounded-2xl border p-4 text-left ${
                  accountType === "business"
                    ? "border-[var(--profile-fg)] bg-[var(--profile-fg)] text-[var(--profile-on-accent)]"
                    : "border-[var(--profile-border)] bg-[var(--profile-soft)] opacity-60"
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold">Boutique / Tienda</p>

                  {accountType !== "business" && (
                    <span className="rounded-full bg-[var(--profile-border)] px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-[var(--profile-secondary)]">
                      Próximamente
                    </span>
                  )}
                </div>

                <p
                  className={`mt-1 text-xs ${
                    accountType === "business"
                      ? "text-[var(--profile-muted)]"
                      : "text-[var(--profile-muted)]"
                  }`}
                >
                  Vende como negocio
                </p>
              </div>
            </div>

            {accountType === "personal" && (
              <p className="mt-2 text-xs leading-5 text-[var(--profile-muted)]">
                Las cuentas para boutiques y tiendas estarán disponibles
                próximamente.
              </p>
            )}
          </div>

          {/* NAME */}
          <div className="mb-5">
            <label className="text-sm font-bold">Nombre</label>

            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Tu nombre"
              className="mt-2 w-full rounded-xl border border-[var(--profile-border)] px-4 py-4 text-sm outline-none focus:border-[var(--profile-fg)]"
            />
          </div>

          {/* USERNAME */}
          <div className="mb-5">
            <label className="text-sm font-bold">Usuario</label>

            <div className="mt-2 flex items-center rounded-xl border border-[var(--profile-border)] px-4">
              <span className="text-[var(--profile-muted)]">@</span>

              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="usuario"
                required
                className="w-full px-2 py-4 text-sm outline-none"
              />
            </div>
          </div>

          {/* BIO */}
          <div className="mb-5">
            <label className="text-sm font-bold">Biografía</label>

            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Cuéntale a los compradores sobre ti o tu tienda..."
              rows={4}
              maxLength={250}
              className="mt-2 w-full resize-none rounded-xl border border-[var(--profile-border)] px-4 py-4 text-sm outline-none focus:border-[var(--profile-fg)]"
            />

            <p className="mt-1 text-right text-[11px] text-[var(--profile-muted)]">
              {bio.length}/250
            </p>
          </div>

          {/* PROVINCE */}
          <div className="mb-5">
            <label className="text-sm font-bold">Provincia</label>

            <select
              value={province}
              onChange={(e) => setProvince(e.target.value)}
              className="mt-2 w-full rounded-xl border border-[var(--profile-border)] bg-[var(--profile-bg)] px-4 py-4 text-sm outline-none focus:border-[var(--profile-fg)]"
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
          </div>

          {/* CITY */}
          <div className="mb-6">
            <label className="text-sm font-bold">Ciudad / Área</label>

            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Ej. San Francisco, David, La Chorrera..."
              className="mt-2 w-full rounded-xl border border-[var(--profile-border)] px-4 py-4 text-sm outline-none focus:border-[var(--profile-fg)]"
            />
          </div>

          {message && (
            <div className="mb-5 rounded-xl bg-[var(--profile-surface)] p-4 text-sm">
              {message}
            </div>
          )}

          {/* SAVE */}
          <button
            type="submit"
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--profile-fg)] py-4 text-sm font-bold text-[var(--profile-on-accent)] disabled:opacity-50"
          >
            <Save size={18} />

            {saving ? "Guardando..." : "Guardar cambios"}
          </button>
        </form>
      </div>
    </main>
  );
}
