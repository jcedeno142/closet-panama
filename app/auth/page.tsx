"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function AuthPage() {
  const supabase = createClient();

  const [mode, setMode] = useState<"login" | "signup">("signup");
  const [accountType, setAccountType] = useState<"personal" | "business">(
    "personal"
  );

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

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
  email,
  password,
  options: {
    data: {
      username,
      display_name: displayName,
      account_type: accountType,
    },
  },
});

console.log("SIGNUP DATA:", data);
console.log("SIGNUP ERROR:", error);

if (error) {
  setMessage(error.message);
} else if (!data.user) {
  setMessage("No user was created. Check Supabase Auth settings.");
} else {
  setMessage("Account created successfully.");
}

      if (error) {
        setMessage(error.message);
      } else {
        setMessage(
          "Cuenta creada. Revisa tu correo si Supabase requiere confirmación."
        );
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setMessage(error.message);
      } else {
        window.location.href = "/";
      }
    }

    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-white px-5 py-10 text-black">
      <div className="mx-auto max-w-md">
        <div className="mb-8">
          <h1 className="text-3xl font-black tracking-tight">
            {mode === "signup" ? "Crear cuenta" : "Iniciar sesión"}
          </h1>

          <p className="mt-2 text-sm text-zinc-500">
            Compra y vende moda en Panamá.
          </p>
        </div>

        <div className="mb-6 flex rounded-2xl bg-zinc-100 p-1">
          <button
            onClick={() => setMode("signup")}
            className={`flex-1 rounded-xl py-3 text-sm font-bold ${
              mode === "signup"
                ? "bg-black text-white"
                : "text-zinc-500"
            }`}
          >
            Crear cuenta
          </button>

          <button
            onClick={() => setMode("login")}
            className={`flex-1 rounded-xl py-3 text-sm font-bold ${
              mode === "login"
                ? "bg-black text-white"
                : "text-zinc-500"
            }`}
          >
            Entrar
          </button>
        </div>

        {mode === "signup" && (
          <div className="mb-6">
            <p className="mb-3 text-sm font-bold">Tipo de cuenta</p>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setAccountType("personal")}
                className={`rounded-2xl border p-4 text-left ${
                  accountType === "personal"
                    ? "border-black bg-black text-white"
                    : "border-zinc-200"
                }`}
              >
                <p className="font-bold">Closet personal</p>
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
                onClick={() => setAccountType("business")}
                className={`rounded-2xl border p-4 text-left ${
                  accountType === "business"
                    ? "border-black bg-black text-white"
                    : "border-zinc-200"
                }`}
              >
                <p className="font-bold">Boutique / Tienda</p>
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
                  setUsername(
                    e.target.value.toLowerCase().replace(/\s+/g, "")
                  )
                }
                placeholder="Usuario"
                required
                className="w-full rounded-xl border border-zinc-200 px-4 py-4 outline-none focus:border-black"
              />
            </>
          )}

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Correo electrónico"
            required
            className="w-full rounded-xl border border-zinc-200 px-4 py-4 outline-none focus:border-black"
          />

          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
            minLength={6}
            required
            className="w-full rounded-xl border border-zinc-200 px-4 py-4 outline-none focus:border-black"
          />

          <button
            disabled={loading}
            className="w-full rounded-2xl bg-black py-4 text-sm font-bold text-white disabled:opacity-50"
          >
            {loading
              ? "Procesando..."
              : mode === "signup"
              ? "Crear cuenta"
              : "Iniciar sesión"}
          </button>
        </form>

        {message && (
          <p className="mt-5 rounded-xl bg-zinc-100 p-4 text-sm">
            {message}
          </p>
        )}
      </div>
    </main>
  );
}