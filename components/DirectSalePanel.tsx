"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import DirectDelivery, { type DeliveryRecord } from "@/components/DirectDelivery";

type Item = { id: string; title: string; price: number };
type Sale = DeliveryRecord & { id: string; buyer_id: string; product_title: string; amount: number; seller_id: string; payment_received_at: string };

export default function DirectSalePanel({ conversationId, userId, buyerName }: { conversationId: string; userId: string; buyerName: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [items, setItems] = useState<Item[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [productId, setProductId] = useState("");
  const [amount, setAmount] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState(false);
  const pending = useRef(false);
  const load = useCallback(async () => {
    const [products, records] = await Promise.all([
      supabase.from("products").select("id, title, price").eq("seller_id", userId).eq("status", "active").order("created_at", { ascending: false }),
      supabase.from("direct_sales").select("id, buyer_id, product_title, amount, seller_id, payment_received_at, delivery_status, delivery_report, not_received_at, received_at").eq("conversation_id", conversationId).order("payment_received_at", { ascending: false }),
    ]);
    setLoadError(!!products.error || !!records.error);
    if (!products.error) setItems(products.data || []);
    if (!records.error) setSales(records.data || []);
  }, [supabase, userId, conversationId]);
  useEffect(() => {
    // Synchronize with remote sales; the loader updates state after network responses.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    // Poll only while visible so the buyer sees confirmations without a Realtime configuration change.
    const timer = window.setInterval(() => { if (!document.hidden && !pending.current) void load(); }, 15000);
    return () => window.clearInterval(timer);
  }, [load]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (pending.current || !confirmed || !productId) return;
    pending.current = true; setBusy(true); setMessage("");
    try {
      const { error } = await supabase.rpc("confirm_direct_payment", {
        target_product: productId, target_conversation: conversationId, agreed_amount: Number(amount),
      });
      if (error) throw error;
      setProductId(""); setAmount(""); setConfirmed(false);
      setMessage("Pago registrado por ti y artículo marcado como vendido. Acuerden la entrega por mensaje.");
      await load();
    } catch (error) {
      setMessage(error instanceof Error || (error && typeof error === "object" && "message" in error) ? String(error.message) : "No pudimos registrar el pago. Inténtalo nuevamente.");
    } finally { pending.current = false; setBusy(false); }
  }
  return <section className="border-b border-zinc-200 bg-zinc-50 px-4 py-4">
    <p className="text-xs leading-5 text-zinc-600">Acuerden el precio, el pago y la entrega por mensaje. Closet no cobra ni retiene dinero y no organiza el envío.</p>
    {sales.map(sale => <div key={sale.id} className="mt-3 rounded-xl border border-zinc-200 p-3 text-xs"><p className="font-bold">{sale.product_title} · ${Number(sale.amount).toFixed(2)}</p><p className="mt-1">{sale.seller_id === userId ? "Confirmaste haber recibido el pago." : "El vendedor confirmó haber recibido tu pago."}</p><p className="mt-1 text-zinc-500">Confirmación del vendedor; no verificada por Closet.</p><DirectDelivery sale={sale} isBuyer={sale.buyer_id === userId} onUpdated={receipt => setSales(current => current.map(item => item.id === sale.id ? { ...item, ...receipt } : item))} /></div>)}
    {loadError ? <p role="status" className="mt-3 text-xs">No pudimos cargar el registro de ventas. <button onClick={load} className="underline">Reintentar</button></p> : items.length > 0 && <details className="mt-3"><summary className="cursor-pointer text-sm font-bold">Soy el vendedor: confirmar pago recibido</summary>
      <form onSubmit={submit} className="mt-3 space-y-3"><fieldset disabled={busy} className="space-y-3">
        <label className="block text-xs">Artículo vendido a {buyerName}<select required value={productId} onChange={e => { const item = items.find(item => item.id === e.target.value); setProductId(e.target.value); setAmount(item ? String(item.price) : ""); setConfirmed(false); }} className="mt-1 w-full rounded-xl border border-zinc-200 p-3"><option value="">Selecciona tu artículo</option>{items.map(item => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
        <label className="block text-xs">Precio final acordado (USD)<input required type="number" min="0.01" max="1000000" step="0.01" value={amount} onChange={e => { setAmount(e.target.value); setConfirmed(false); }} className="mt-1 w-full rounded-xl border border-zinc-200 p-3" /></label>
        <label className="flex items-start gap-2 text-xs leading-5"><input required type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} className="mt-1" />Confirmo que recibí ${Number(amount || 0).toFixed(2)} de {buyerName} por mi propio medio de pago. El artículo quedará marcado como vendido.</label>
        <button disabled={busy || !confirmed || !productId} className="w-full rounded-xl bg-black p-3 text-sm font-bold text-white disabled:opacity-50">{busy ? "Guardando…" : "Confirmar pago recibido"}</button>
      </fieldset></form>
    </details>}
    <p role="status" aria-live="polite" className="mt-2 text-xs">{message}</p>
  </section>;
}
