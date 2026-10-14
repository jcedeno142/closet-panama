"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import DirectDelivery, { type DeliveryRecord } from "@/components/DirectDelivery";

type Sale = DeliveryRecord & { id: string; buyer_id: string; product_id: string; product_title: string; conversation_id: string; amount: number; payment_received_at: string };

export function DirectSalesNotice() {
  return <main className="min-h-screen bg-white px-5 py-12 text-black"><div className="mx-auto max-w-md space-y-5"><h1 className="text-2xl font-bold">Compra y venta directa</h1><p className="text-sm leading-6 text-zinc-600">Por ahora, el comprador y el vendedor acuerdan el pago y la entrega por mensaje. Closet no procesa pagos, no guarda dinero y no organiza envíos.</p><Link href="/inbox" className="block rounded-xl bg-black p-4 text-center text-sm font-bold text-white">Ir a mensajes</Link><Link href="/" className="block text-center text-sm underline">Seguir explorando</Link></div></main>;
}

export default function DirectSales({ role }: { role: "buyer" | "seller" }) {
  const supabase = useMemo(() => createClient(), []);
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const [userId, setUserId] = useState("");
  useEffect(() => {
    let active = true;
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { window.location.replace("/auth"); return; }
      if (active) setUserId(user.id);
      const { data, error } = await supabase.from("direct_sales")
        .select("id, buyer_id, product_id, product_title, conversation_id, amount, payment_received_at, delivery_status, delivery_report, not_received_at, received_at")
        .eq(role === "seller" ? "seller_id" : "buyer_id", user.id)
        .order("payment_received_at", { ascending: false });
      if (!active) return;
      if (error) setError("No pudimos cargar las ventas. Inténtalo nuevamente.");
      else { setSales(data || []); setError(""); }
      setLoading(false);
    }
    void load();
    const timer = window.setInterval(() => { if (!document.hidden) void load(); }, 15000);
    return () => { active = false; window.clearInterval(timer); };
  }, [supabase, role, retry]);
  return <main className="min-h-screen bg-white px-5 py-8 text-black"><div className="mx-auto max-w-md">
    <Link href="/profile" className="text-sm underline">Volver al perfil</Link>
    <h1 className="mt-5 text-2xl font-bold">{role === "seller" ? "Mis ventas" : "Mis compras"}</h1>
    <nav className="mt-4 flex gap-4 text-sm"><Link href="/orders" aria-current={role === "buyer" ? "page" : undefined} className={role === "buyer" ? "font-bold underline" : ""}>Compras</Link><Link href="/sales" aria-current={role === "seller" ? "page" : undefined} className={role === "seller" ? "font-bold underline" : ""}>Ventas</Link></nav>
    <p className="my-5 rounded-xl bg-zinc-100 p-4 text-xs leading-5">Aquí aparecen los pagos externos confirmados por el vendedor. Closet no verifica ni retiene estos fondos. La entrega se coordina directamente por mensaje.</p>
    {loading ? <p role="status">Cargando…</p> : error ? <div role="alert"><p>{error}</p><button onClick={() => { setLoading(true); setRetry(value => value + 1); }} className="mt-3 underline">Reintentar</button></div> : !sales.length ? <div className="py-10 text-center"><p className="font-semibold">Todavía no hay pagos confirmados</p><p className="mt-2 text-sm text-zinc-500">El vendedor puede confirmar el pago recibido desde la conversación con el comprador.</p><Link href="/inbox" className="mt-5 inline-block underline">Ir a mensajes</Link></div> : <div className="space-y-4">{sales.map(sale => <article key={sale.id} className="rounded-2xl border border-zinc-200 p-4">
      <Link href={`/product/${sale.product_id}`} className="font-bold">{sale.product_title}</Link><p className="mt-2 text-xl font-bold">${Number(sale.amount).toFixed(2)}</p><p className="mt-2 text-xs text-zinc-500">Pago confirmado por el vendedor · {new Date(sale.payment_received_at).toLocaleDateString("es-PA")}</p><Link href={`/inbox/${sale.conversation_id}`} className="mt-4 block rounded-xl bg-black p-3 text-center text-sm font-bold text-white">Coordinar entrega</Link>
      <DirectDelivery sale={sale} isBuyer={sale.buyer_id === userId} onUpdated={receipt => setSales(current => current.map(item => item.id === sale.id ? { ...item, ...receipt } : item))} />
    </article>)}</div>}
  </div></main>;
}
