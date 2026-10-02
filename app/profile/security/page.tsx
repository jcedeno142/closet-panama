"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SecurityPage() {
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [channel, setChannel] = useState<"email" | "sms">("email");
  const [sent, setSent] = useState<"email" | "sms" | null>(null);
  const [code, setCode] = useState("");
  const [userId, setUserId] = useState("");
  const [emailVerified, setEmailVerified] = useState(false);
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [identityStatus, setIdentityStatus] = useState("");
  const [cedula, setCedula] = useState("");
  const [front, setFront] = useState<File | null>(null);
  const [back, setBack] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.replace("/auth"); return; }
      setUserId(user.id); setEmail(user.email || "");
      setPhone(user.phone ? `+${user.phone}` : user.user_metadata.phone || "+507");
      setEmailVerified(!!user.email_confirmed_at); setPhoneVerified(!!user.phone_confirmed_at);
      const { data, error } = await supabase.from("identity_verifications").select("status").eq("user_id", user.id).maybeSingle();
      if (error) setMessage("La verificación de cédula aún no está disponible.");
      setIdentityStatus(data?.status || "");
    }
    load();
  }, [supabase]);
  async function run(action: () => Promise<void>) {
    setBusy(true); setMessage("");
    try { await action(); } catch (error) { setMessage(error instanceof Error ? error.message : "No pudimos completar la solicitud."); }
    finally { setBusy(false); }
  }
  async function sendCode() {
    await run(async () => {
      const cleanPhone = phone.replace(/[\s()-]/g, "");
      if (!/^\+[1-9]\d{7,14}$/.test(cleanPhone)) throw new Error("Ingresa un celular válido con código de país.");
      const { error: saveError } = await supabase.auth.updateUser({ data: { phone: cleanPhone } });
      if (saveError) throw saveError;
      const { error } = channel === "sms"
        ? await supabase.auth.updateUser({ phone: cleanPhone })
        : await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
      if (error) throw error;
      setSent(channel); setCode("");
      setMessage(channel === "sms" ? "Código enviado por SMS." : "Revisa tu correo. Ingresa el código que recibiste.");
    });
  }
  async function verify(e: React.FormEvent) {
    e.preventDefault();
    await run(async () => {
      if (!sent) return;
      const { error } = sent === "sms"
        ? await supabase.auth.verifyOtp({ phone: phone.replace(/[\s()-]/g, ""), token: code.trim(), type: "phone_change" })
        : await supabase.auth.verifyOtp({ email, token: code.trim(), type: "email" });
      if (error) throw error;
      if (sent === "sms") setPhoneVerified(true); else setEmailVerified(true);
      setSent(null); setCode("");
      setMessage(sent === "sms" ? "Celular verificado." : "Correo verificado. El celular está registrado; su verificación por SMS sigue pendiente.");
    });
  }
  async function submitIdentity(e: React.FormEvent) {
    e.preventDefault();
    await run(async () => {
      if (!front || !back || !consent) throw new Error("Adjunta ambos lados y acepta la revisión de identidad.");
      for (const file of [front, back]) {
        if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) throw new Error("Usa fotos JPG, PNG o WebP de hasta 5 MB.");
      }
      const submission = crypto.randomUUID();
      const paths: string[] = [];
      try {
        for (const [side, file] of [["front", front], ["back", back]] as const) {
          const path = `${userId}/${submission}/${side}`;
          const { error } = await supabase.storage.from("identity-documents").upload(path, file, { contentType: file.type });
          if (error) throw error;
          paths.push(path);
        }
        const { error } = await supabase.from("identity_verifications").upsert({ user_id: userId, cedula: cedula.trim(), front_path: paths[0], back_path: paths[1], status: "pending", submitted_at: new Date().toISOString() }, { onConflict: "user_id" });
        if (error) throw error;
      } catch (error) {
        if (paths.length) await supabase.storage.from("identity-documents").remove(paths);
        throw error;
      }
      setIdentityStatus("pending"); setFront(null); setBack(null);
      setMessage("Cédula enviada para revisión. Esto todavía no significa que tu identidad esté verificada.");
    });
  }
  const field = "mt-2 w-full rounded-xl border border-zinc-200 p-3";
  return <main className="mx-auto max-w-md space-y-6 px-5 py-8 text-black">
    <Link href="/profile/edit" className="text-sm underline">Volver al perfil</Link>
    <h1 className="text-2xl font-bold">Seguridad y verificación</h1>
    <section className="space-y-4 rounded-2xl border p-5"><h2 className="font-bold">Contacto</h2><p className="text-sm">Correo: {emailVerified ? "Verificado" : "Pendiente"} · Celular: {phoneVerified ? "Verificado" : "Pendiente"}</p>
      <label className="block text-sm">Número de celular<input type="tel" autoComplete="tel" value={phone} disabled={busy || !!sent} onChange={e => { setPhone(e.target.value); setPhoneVerified(false); }} className={field} /></label>
      <label className="block text-sm">Recibir código por<select disabled={busy || !!sent} value={channel} onChange={e => setChannel(e.target.value as "email" | "sms")} className={field}><option value="email">Correo electrónico ({email})</option><option value="sms">SMS al celular</option></select></label>
      <button disabled={busy || !userId} onClick={sendCode} className="rounded-xl bg-black p-3 text-sm text-white disabled:opacity-50">{sent ? "Reenviar código" : "Registrar celular y enviar código"}</button>
      {sent && <form onSubmit={verify} className="space-y-3"><label className="block text-sm">Código de verificación<input required autoComplete="one-time-code" inputMode="numeric" pattern="[0-9]{6,10}" value={code} onChange={e => setCode(e.target.value)} className={field} /></label><button disabled={busy} className="rounded-xl bg-black p-3 text-white">Verificar código</button><button type="button" disabled={busy} onClick={() => setSent(null)} className="ml-3 underline">Cambiar método</button></form>}
    </section>
    <form onSubmit={submitIdentity} className="space-y-4 rounded-2xl border p-5"><h2 className="font-bold">Verificación de cédula</h2><p className="text-sm text-zinc-600">Las fotos son privadas y se usarán para revisar tu identidad. Estado: {identityStatus === "approved" ? "Aprobada" : identityStatus === "pending" ? "Pendiente de revisión" : identityStatus === "rejected" ? "Rechazada; envía nuevas fotos" : "Sin enviar"}.</p>
      {identityStatus !== "pending" && identityStatus !== "approved" && <><label className="block text-sm">Número de cédula<input required maxLength={30} value={cedula} onChange={e => setCedula(e.target.value)} className={field} /></label>
      {(["front", "back"] as const).map(side => <label key={side} className="block text-sm">{side === "front" ? "Foto del frente" : "Foto del reverso"}<input required type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={e => (side === "front" ? setFront : setBack)(e.target.files?.[0] || null)} className={field} /></label>)}
      <label className="flex gap-2 text-sm"><input type="checkbox" required checked={consent} onChange={e => setConsent(e.target.checked)} />Acepto el uso privado de mi cédula para revisar mi identidad.</label><button disabled={busy || !userId} className="w-full rounded-xl bg-black p-3 text-white disabled:opacity-50">Enviar para revisión</button></>}
    </form><p role="status" aria-live="polite" className="text-sm">{busy ? "Procesando…" : message}</p>
  </main>;
}
