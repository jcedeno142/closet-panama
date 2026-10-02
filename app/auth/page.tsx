"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AuthPage() {
  const supabase = createClient();

  const [mode, setMode] = useState<"login" | "signup" | "forgot">("signup");
  const [phone, setPhone] = useState("");
  /* const [accountType, setAccountType] = useState<"personal" | "business">(
    "personal"
  );*/

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setLoading(true);
    setMessage("");
    try {
    if (mode === "forgot") {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback?recovery=1`,
      });
      setMessage(error ? error.message : "Si existe una cuenta con ese correo, recibirás un enlace para cambiar la contraseña.");
      return;
    }
    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            username,
            display_name: displayName,
            account_type: "personal",
            phone: phone.replace(/[\s()-]/g, ""),
          },
        },
      });

      if (error) {
        setMessage(error.message);
      } else if (!data.user) {
        setMessage("No se pudo crear la cuenta.");
      } else {
        setMessage(
          "Cuenta creada. Revisa tu correo si se requiere confirmación.",
        );
      }
    } else {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ identifier: email, password }) });
      const result = await response.json();
      if (!response.ok) setMessage(result.error);
      else window.location.href = "/";
    }

    } catch { setMessage("No pudimos conectar. Inténtalo nuevamente."); }
    finally { setLoading(false); }
  }

  return (
    <main className="min-h-screen bg-white px-5 py-10 text-black">
      <div className="mx-auto max-w-md">
        <div className="mb-8">
          <h1 className="text-3xl font-black tracking-tight">
            {mode === "signup" ? "Crear cuenta" : mode === "forgot" ? "Recuperar contraseña" : "Iniciar sesión"}
          </h1>

          <p className="mt-2 text-sm text-zinc-500">
            Compra y vende moda en Panamá.
          </p>
        </div>

        <div className="mb-6 flex rounded-2xl bg-zinc-100 p-1">
          <button
            onClick={() => setMode("signup")}
            className={`flex-1 rounded-xl py-3 text-sm font-bold ${
              mode === "signup" ? "bg-black text-white" : "text-zinc-500"
            }`}
          >
            Crear cuenta
          </button>

          <button
            onClick={() => setMode("login")}
            className={`flex-1 rounded-xl py-3 text-sm font-bold ${
              mode === "login" ? "bg-black text-white" : "text-zinc-500"
            }`}
          >
            Entrar
          </button>
        </div>

        {mode === "signup" && (
          <div className="mb-6">
            <p className="mb-3 text-sm font-bold">Tipo de cuenta</p>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-black bg-black p-4 text-left text-white">
                <p className="font-bold">Closet personal</p>
                <p className="mt-1 text-xs text-zinc-300">
                  Vende tu propia ropa
                </p>
              </div>

              <div className="cursor-not-allowed rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-left opacity-60">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-bold">Boutique / Tienda</p>

                  <span className="rounded-full bg-zinc-200 px-2 py-1 text-[9px] font-bold uppercase tracking-wide text-zinc-600">
                    Próximamente
                  </span>
                </div>

                <p className="mt-1 text-xs text-zinc-500">Vende como negocio</p>
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Nombre"
                required
                className="w-full rounded-xl border border-zinc-200 px-4 py-4 outline-none focus:border-black"
              />

              <input
                value={username}
                onChange={(e) =>
                  setUsername(e.target.value.toLowerCase().replace(/\s+/g, ""))
                }
                placeholder="Usuario"
                required
                className="w-full rounded-xl border border-zinc-200 px-4 py-4 outline-none focus:border-black"
              />
            </>
          )}

          <input
            type={mode === "login" ? "text" : "email"}
            aria-label={mode === "login" ? "Usuario o correo electrónico" : "Correo electrónico"}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={mode === "login" ? "Usuario o correo electrónico" : "Correo electrónico"}
            required
            className="w-full rounded-xl border border-zinc-200 px-4 py-4 outline-none focus:border-black"
          />

          {mode === "signup" && <label className="block text-sm">Número de celular<input type="tel" autoComplete="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+507 6123 4567" pattern="\+[0-9 ()-]{8,20}" required className="mt-2 w-full rounded-xl border border-zinc-200 px-4 py-4" /><span className="mt-2 block text-xs text-zinc-500">Incluye el código del país. Podrás verificarlo en Seguridad del perfil.</span></label>}
          {mode !== "forgot" && <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
            minLength={mode === "signup" ? 8 : 6}
            required
            className="w-full rounded-xl border border-zinc-200 px-4 py-4 outline-none focus:border-black"
          />}

          <button
            disabled={loading}
            className="w-full rounded-2xl bg-black py-4 text-sm font-bold text-white disabled:opacity-50"
          >
            {loading
              ? "Procesando..."
              : mode === "signup"
                ? "Crear cuenta"
                : mode === "forgot" ? "Enviar enlace" : "Iniciar sesión"}
          </button>
        </form>
        {mode === "login" && <button type="button" onClick={() => { setMode("forgot"); setEmail(""); setMessage(""); }} className="mt-5 text-sm underline">¿Olvidaste tu contraseña?</button>}

        {message && (
          <p className="mt-5 rounded-xl bg-zinc-100 p-4 text-sm">{message}</p>
        )}
      </div>
    </main>
  );
}
