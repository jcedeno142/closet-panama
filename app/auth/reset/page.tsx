"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const supabase = createClient();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setReady(true);
    });
    supabase.auth.getUser().then(({ data }) => {
      setReady(!!data.user);
      if (!data.user) setMessage("El enlace expiró. Solicita otro desde Iniciar sesión.");
    });
    return () => subscription.unsubscribe();
  }, []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirmation) { setMessage("Las contraseñas no coinciden."); return; }
    setBusy(true);
    try {
      const { error } = await createClient().auth.updateUser({ password });
      if (error) setMessage(error.message);
      else { await createClient().auth.signOut(); window.location.href = "/auth"; }
    } catch { setMessage("No pudimos cambiar la contraseña."); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto max-w-md px-5 py-10"><h1 className="text-2xl font-bold">Nueva contraseña</h1><form onSubmit={submit} className="mt-6 space-y-4"><input aria-label="Nueva contraseña" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={e => setPassword(e.target.value)} className="w-full rounded-xl border p-4" /><input aria-label="Confirmar contraseña" type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={e => setConfirmation(e.target.value)} className="w-full rounded-xl border p-4" /><button disabled={!ready || busy} className="w-full rounded-xl bg-black p-4 text-white disabled:opacity-50">Guardar contraseña</button></form><p role="status" className="mt-4">{message}</p><a href="/auth" className="mt-5 block underline">Volver a iniciar sesión</a></main>;
}
