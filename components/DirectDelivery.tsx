"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type DeliveryRecord = {
  delivery_status: "pending" | "not_received" | "received";
  delivery_report: string | null;
  not_received_at: string | null;
  received_at: string | null;
};

export default function DirectDelivery({ sale, isBuyer, onUpdated }: {
  sale: DeliveryRecord & { id: string };
  isBuyer: boolean;
  onUpdated: (receipt: DeliveryRecord) => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [action, setAction] = useState<"not_received" | "received" | null>(null);
  const [details, setDetails] = useState("");
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [hasReview, setHasReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const pending = useRef(false);
  const canReview = sale.delivery_status === "received" || sale.delivery_status === "not_received";
  useEffect(() => {
    let active = true;
    if (isBuyer) supabase.from("direct_sale_reviews").select("rating, comment").eq("sale_id", sale.id).maybeSingle().then(({ data, error }) => {
      if (!active) return;
      if (error) { setMessage("No pudimos cargar tu calificación anterior."); return; }
      if (data) { setStars(data.rating); setComment(data.comment || ""); setHasReview(true); }
    });
    return () => { active = false; };
  }, [supabase, sale.id, isBuyer]);
  async function save(kind: "delivery" | "review", event: React.FormEvent) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true; setBusy(true); setMessage("");
    try {
      if (kind === "delivery") {
        if (!action) return;
        const { data, error } = await supabase.rpc("set_direct_delivery", { target_sale: sale.id, new_status: action, expected_status: sale.delivery_status, report_details: details });
        if (error) throw error;
        onUpdated(data as DeliveryRecord); setAction(null); setDetails("");
        setMessage("Estado guardado. Ya puedes calificar tu experiencia.");
      } else {
        const { error } = await supabase.rpc("review_direct_sale", { target_sale: sale.id, stars, review_comment: comment });
        if (error) throw error;
        setHasReview(true); setMessage("Tu calificación aparece en el perfil del vendedor.");
      }
    } catch { setMessage("No pudimos guardar el cambio. Actualiza la página e inténtalo nuevamente."); }
    finally { pending.current = false; setBusy(false); }
  }
  return <div className="mt-3 space-y-3 text-xs">
    <div className={`rounded-xl p-3 ${sale.delivery_status === "not_received" ? "bg-red-50 text-red-700" : "bg-zinc-100 text-zinc-600"}`}>
      <p className="font-bold">{sale.delivery_status === "not_received" ? "El comprador reportó: artículo no recibido" : sale.delivery_status === "received" ? "Artículo recibido, confirmado por el comprador" : "Entrega pendiente de confirmación del comprador"}</p>
      {sale.delivery_status === "not_received" && sale.delivery_report && <p className="mt-1 whitespace-pre-wrap break-words">{sale.delivery_report}</p>}
      {sale.delivery_status === "not_received" && <p className="mt-1">Coordinen una solución por mensaje. Este reporte no genera un reembolso automático.</p>}
      {sale.delivery_status === "received" && sale.not_received_at && <p className="mt-1">El comprador confirmó la recepción después de reportar un problema.</p>}
    </div>
    {isBuyer && <>
      <div className="flex flex-wrap gap-2">
        {sale.delivery_status !== "not_received" && <button disabled={busy} onClick={() => { setAction("not_received"); setDetails(""); }} className="rounded-xl border border-zinc-200 p-3 font-semibold">No he recibido el artículo</button>}
        {sale.delivery_status !== "received" && <button disabled={busy} onClick={() => setAction("received")} className="rounded-xl border border-zinc-200 p-3 font-semibold">Artículo recibido</button>}
      </div>
      {action && <form onSubmit={event => save("delivery", event)} className="space-y-3 rounded-xl border border-zinc-200 p-3"><p className="font-semibold">{action === "not_received" ? "¿Quieres reportar que aún no recibiste este artículo?" : "¿Confirmas que ya recibiste este artículo?"}</p>
        {action === "not_received" && <label className="block">Detalles para el vendedor (opcional)<textarea maxLength={1000} rows={3} value={details} onChange={event => setDetails(event.target.value)} className="mt-2 w-full rounded-xl border border-zinc-200 p-3" /></label>}
        <div className="flex gap-3"><button disabled={busy} className="rounded-xl bg-black px-4 py-3 font-bold text-white disabled:opacity-50">{busy ? "Guardando…" : "Confirmar"}</button><button type="button" disabled={busy} onClick={() => setAction(null)} className="underline">Cancelar</button></div>
      </form>}
      {canReview && <details className="rounded-xl border border-zinc-200 p-3"><summary className="cursor-pointer font-bold">{hasReview ? "Editar mi calificación" : "Calificar al vendedor"}</summary><form onSubmit={event => save("review", event)} className="mt-3 space-y-3">
        <p>Tu opinión será pública en el perfil del vendedor. No incluyas datos privados.</p>
        <fieldset disabled={busy}><legend className="mb-2">Tu calificación</legend><div className="flex flex-wrap gap-3">{[1, 2, 3, 4, 5].map(value => <label key={value} className="flex items-center gap-1"><input required type="radio" name={`rating-${sale.id}`} value={value} checked={stars === value} onChange={() => setStars(value)} />{value} ★</label>)}</div></fieldset>
        <label className="block">Cuéntanos tu experiencia (opcional)<textarea disabled={busy} maxLength={1000} rows={3} value={comment} onChange={event => setComment(event.target.value)} className="mt-2 w-full rounded-xl border border-zinc-200 p-3" /></label>
        <button disabled={busy || !stars} className="rounded-xl bg-black px-4 py-3 font-bold text-white disabled:opacity-50">{busy ? "Guardando…" : hasReview ? "Actualizar calificación" : "Publicar calificación"}</button>
      </form></details>}
    </>}
    <p role="status" aria-live="polite">{message}</p>
  </div>;
}
