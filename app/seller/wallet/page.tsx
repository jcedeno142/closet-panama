"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowDownToLine,
  CheckCircle2,
  Clock3,
  DollarSign,
  ReceiptText,
  Wallet,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Balance = {
  seller_id: string;
  pending_balance: number;
  available_balance: number;
  paid_out_balance: number;
  updated_at: string;
};

type Payment = {
  id: string;
  order_id: string;
  amount: number;
  platform_fee: number;
  seller_amount: number;
  status: string;
  created_at: string;
  paid_at: string | null;
};

export default function SellerWalletPage() {
  const supabase = useMemo(() => createClient(), []);

  const [balance, setBalance] = useState<Balance | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function loadWallet() {
    setLoading(true);
    setMessage("");

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      window.location.href = "/auth";
      return;
    }

    const { data: balanceData, error: balanceError } =
      await supabase
        .from("seller_balances")
        .select(`
          seller_id,
          pending_balance,
          available_balance,
          paid_out_balance,
          updated_at
        `)
        .eq("seller_id", user.id)
        .maybeSingle();

    if (balanceError) {
      console.error("Balance error:", balanceError);
      setMessage(
        "No pudimos cargar tu saldo."
      );
      setLoading(false);
      return;
    }

    if (balanceData) {
      setBalance(balanceData);
    } else {
      setBalance({
        seller_id: user.id,
        pending_balance: 0,
        available_balance: 0,
        paid_out_balance: 0,
        updated_at: new Date().toISOString(),
      });
    }

    const { data: paymentData, error: paymentError } =
      await supabase
        .from("payments")
        .select(`
          id,
          order_id,
          amount,
          platform_fee,
          seller_amount,
          status,
          created_at,
          paid_at
        `)
        .eq("seller_id", user.id)
        .eq("status", "paid")
        .order("created_at", {
          ascending: false,
        });

    if (paymentError) {
      console.error("Payments error:", paymentError);
      setMessage(
        "El saldo cargó, pero no pudimos cargar el historial."
      );
    } else {
      setPayments(paymentData || []);
    }

    setLoading(false);
  }

  useEffect(() => {
    loadWallet();
  }, []);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 text-black">
        <p className="text-sm text-zinc-400">
          Cargando billetera...
        </p>
      </main>
    );
  }

  const available =
    Number(balance?.available_balance) || 0;

  const pending =
    Number(balance?.pending_balance) || 0;

  const paidOut =
    Number(balance?.paid_out_balance) || 0;

  return (
    <main className="min-h-screen bg-zinc-50 text-black">
      <div className="mx-auto max-w-md pb-10">

        {/* HEADER */}

        <header className="sticky top-0 z-40 flex items-center border-b border-zinc-100 bg-white px-4 py-4">
          <Link
            href="/sales"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100"
          >
            <ArrowLeft size={20} />
          </Link>

          <div className="ml-4">
            <h1 className="text-lg font-black">
              Mi billetera
            </h1>

            <p className="text-xs text-zinc-400">
              Tus ganancias
            </p>
          </div>
        </header>

        {/* AVAILABLE BALANCE */}

        <section className="p-4">
          <div className="rounded-3xl bg-black p-6 text-white">
            <div className="flex items-center gap-2 text-zinc-300">
              <Wallet size={18} />

              <p className="text-xs font-semibold uppercase tracking-wide">
                Saldo disponible
              </p>
            </div>

            <p className="mt-4 text-4xl font-black">
              ${available.toFixed(2)}
            </p>

            <p className="mt-2 text-xs text-zinc-400">
              Disponible para retirar
            </p>

            <button
              type="button"
              disabled
              className="mt-6 flex w-full cursor-not-allowed items-center justify-center gap-2 rounded-2xl bg-white/15 px-4 py-4 text-sm font-bold text-white opacity-60"
            >
              <ArrowDownToLine size={18} />

              Retirar fondos
            </button>

            <p className="mt-3 text-center text-[11px] text-zinc-500">
              Los retiros estarán disponibles próximamente.
            </p>
          </div>
        </section>

        {/* BALANCE CARDS */}

        <section className="grid grid-cols-2 gap-3 px-4">
          <div className="rounded-2xl bg-white p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100">
              <Clock3 size={17} />
            </div>

            <p className="mt-4 text-xs text-zinc-400">
              Saldo pendiente
            </p>

            <p className="mt-1 text-xl font-black">
              ${pending.toFixed(2)}
            </p>

            <p className="mt-2 text-[11px] leading-4 text-zinc-400">
              Ventas esperando confirmación.
            </p>
          </div>

          <div className="rounded-2xl bg-white p-4">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-100">
              <CheckCircle2 size={17} />
            </div>

            <p className="mt-4 text-xs text-zinc-400">
              Total retirado
            </p>

            <p className="mt-1 text-xl font-black">
              ${paidOut.toFixed(2)}
            </p>

            <p className="mt-2 text-[11px] leading-4 text-zinc-400">
              Fondos enviados a tu cuenta.
            </p>
          </div>
        </section>

        {/* INFO */}

        <section className="px-4 pt-4">
          <div className="rounded-2xl bg-white p-4">
            <div className="flex gap-3">
              <DollarSign
                size={19}
                className="mt-0.5 shrink-0"
              />

              <div>
                <p className="text-sm font-bold">
                  Cómo funcionan tus ganancias
                </p>

                <p className="mt-1 text-xs leading-5 text-zinc-500">
                  Cuando recibes una venta, tus ganancias
                  permanecen pendientes hasta que el comprador
                  confirme que recibió el artículo. Después,
                  pasan a tu saldo disponible.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* MESSAGE */}

        {message && (
          <div className="mx-4 mt-4 rounded-2xl bg-white p-4 text-sm">
            {message}
          </div>
        )}

        {/* HISTORY */}

        <section className="px-4 pt-7">
          <div className="mb-4 flex items-center gap-2">
            <ReceiptText size={18} />

            <h2 className="font-black">
              Historial de ganancias
            </h2>
          </div>

          {payments.length === 0 ? (
            <div className="rounded-2xl bg-white px-5 py-10 text-center">
              <ReceiptText
                size={26}
                className="mx-auto text-zinc-300"
              />

              <p className="mt-3 text-sm font-bold">
                Sin movimientos todavía
              </p>

              <p className="mt-1 text-xs text-zinc-400">
                Tus ventas pagadas aparecerán aquí.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {payments.map((payment) => (
                <div
                  key={payment.id}
                  className="rounded-2xl bg-white p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-bold">
                        Venta
                      </p>

                      <p className="mt-1 text-xs text-zinc-400">
                        {formatDate(
                          payment.paid_at ||
                            payment.created_at
                        )}
                      </p>
                    </div>

                    <p className="text-base font-black">
                      +$
                      {Number(
                        payment.seller_amount
                      ).toFixed(2)}
                    </p>
                  </div>

                  <div className="mt-4 space-y-2 border-t border-zinc-100 pt-3 text-xs">
                    <div className="flex justify-between">
                      <span className="text-zinc-400">
                        Precio de venta
                      </span>

                      <span>
                        $
                        {Number(
                          payment.amount
                        ).toFixed(2)}
                      </span>
                    </div>

                    <div className="flex justify-between">
                      <span className="text-zinc-400">
                        Comisión
                      </span>

                      <span>
                        -$
                        {Number(
                          payment.platform_fee
                        ).toFixed(2)}
                      </span>
                    </div>

                    <div className="flex justify-between font-bold">
                      <span>Tu ganancia</span>

                      <span>
                        $
                        {Number(
                          payment.seller_amount
                        ).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("es-PA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(date));
}