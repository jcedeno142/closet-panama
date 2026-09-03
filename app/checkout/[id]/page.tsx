"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  CreditCard,
  MapPin,
  Smartphone,
  Truck,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Order = {
  id: string;
  product_id: string;
  buyer_id: string;
  seller_id: string;
  amount: number;
  status: string;
  fulfillment_method: string | null;
  payment_method: string | null;
};

type ProductImage = {
  image_url: string;
  position: number;
};

type Product = {
  id: string;
  title: string;
  price: number;
  product_images: ProductImage[];
};

type Seller = {
  username: string;
  display_name: string | null;
};

export default function CheckoutPage() {
  const params = useParams();
  const orderId = params.id as string;

  const supabase = createClient();

  const [order, setOrder] = useState<Order | null>(null);
  const [product, setProduct] = useState<Product | null>(null);
  const [seller, setSeller] = useState<Seller | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<
    "yappy" | "card"
  >("yappy");

  const [fulfillmentMethod, setFulfillmentMethod] = useState<
    "shipping" | "local_delivery" | "pickup"
  >("shipping");

  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadCheckout() {
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

      const { data: orderData, error: orderError } =
        await supabase
          .from("orders")
          .select("*")
          .eq("id", orderId)
          .eq("buyer_id", user.id)
          .maybeSingle();

      if (orderError) {
        setMessage(orderError.message);
        setLoading(false);
        return;
      }

      if (!orderData) {
        setMessage("No pudimos encontrar este pedido.");
        setLoading(false);
        return;
      }

      if (orderData.status !== "pending_payment") {
        window.location.href = "/orders";
        return;
      }

      setOrder(orderData);

      if (orderData.payment_method === "card") {
        setPaymentMethod("card");
      } else if (orderData.payment_method === "yappy") {
        setPaymentMethod("yappy");
      }

      if (
        orderData.fulfillment_method === "shipping" ||
        orderData.fulfillment_method === "local_delivery" ||
        orderData.fulfillment_method === "pickup"
      ) {
        setFulfillmentMethod(orderData.fulfillment_method);
      }

      const { data: productData, error: productError } =
        await supabase
          .from("products")
          .select(`
            id,
            title,
            price,
            product_images (
              image_url,
              position
            )
          `)
          .eq("id", orderData.product_id)
          .maybeSingle();

      if (productError) {
        setMessage(productError.message);
        setLoading(false);
        return;
      }

      if (productData) {
        setProduct({
          ...productData,
          product_images: [
            ...(productData.product_images || []),
          ].sort((a, b) => a.position - b.position),
        });
      }

      const { data: sellerData, error: sellerError } =
        await supabase
          .from("profiles")
          .select("username, display_name")
          .eq("id", orderData.seller_id)
          .maybeSingle();

      if (sellerError) {
        setMessage(sellerError.message);
        setLoading(false);
        return;
      }

      setSeller(sellerData);

      setLoading(false);
    }

    loadCheckout();
  }, [orderId, supabase]);

  async function continueToPayment() {
    if (!order) return;

    setProcessing(true);
    setMessage("");

    const { error } = await supabase
      .from("orders")
      .update({
        payment_method: paymentMethod,
        fulfillment_method: fulfillmentMethod,
        updated_at: new Date().toISOString(),
      })
      .eq("id", order.id);

    if (error) {
      setMessage(error.message);
      setProcessing(false);
      return;
    }

    /*
      NEXT STEP:

      This is where we will call our secure backend:

      POST /api/payments/create

      The backend will communicate with Tilopay/Yappy.

      We DO NOT put private payment credentials here.
    */

    if (paymentMethod === "yappy") {
      setMessage(
        "Yappy seleccionado. En el siguiente paso conectaremos el Botón de Pago Yappy."
      );
    } else {
      setMessage(
        "Tarjeta seleccionada. En el siguiente paso conectaremos el checkout seguro de Tilopay."
      );
    }

    setProcessing(false);
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white text-black">
        <p className="text-sm text-zinc-500">
          Preparando checkout...
        </p>
      </main>
    );
  }

  if (!order || message.startsWith("No pudimos encontrar")) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-white px-5 text-black">
        <div className="text-center">
          <p className="font-bold">
            No pudimos abrir este checkout.
          </p>

          <p className="mt-2 text-sm text-zinc-500">
            {message}
          </p>

          <Link
            href="/orders"
            className="mt-5 inline-block rounded-xl bg-black px-5 py-3 text-sm font-bold text-white"
          >
            Ver pedidos
          </Link>
        </div>
      </main>
    );
  }

  const cover =
    product?.product_images?.[0]?.image_url;

  return (
    <main className="min-h-screen bg-zinc-50 pb-32 text-black">
      <div className="mx-auto max-w-md">

        {/* HEADER */}
        <header className="sticky top-0 z-40 flex items-center border-b border-zinc-100 bg-white px-4 py-4">
          <Link
            href="/orders"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100"
          >
            <ArrowLeft size={20} />
          </Link>

          <div className="ml-4">
            <h1 className="text-lg font-bold">
              Checkout
            </h1>

            <p className="text-xs text-zinc-400">
              Completa tu compra
            </p>
          </div>
        </header>

        {/* PRODUCT */}
        <section className="bg-white px-5 py-5">
          <div className="flex gap-4">

            <div className="h-28 w-24 shrink-0 overflow-hidden rounded-xl bg-zinc-100">
              {cover ? (
                <img
                  src={cover}
                  alt={product?.title || "Producto"}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-[10px] text-zinc-400">
                  Sin foto
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-xs text-zinc-400">
                Vendido por
              </p>

              <p className="mt-1 text-sm font-bold">
                @{seller?.username || "vendedor"}
              </p>

              <h2 className="mt-3 truncate font-semibold">
                {product?.title || "Producto"}
              </h2>

              <p className="mt-3 text-2xl font-black">
                ${Number(order.amount).toFixed(2)}
              </p>
            </div>

          </div>
        </section>

        <div className="h-2" />

        {/* DELIVERY */}
        <section className="bg-white px-5 py-6">
          <div className="flex items-center gap-2">
            <Truck size={19} />

            <h2 className="font-bold">
              Método de entrega
            </h2>
          </div>

          <div className="mt-4 space-y-3">

            <Choice
              selected={fulfillmentMethod === "shipping"}
              title="Envío nacional"
              description="Enviar el artículo mediante courier."
              icon={<Truck size={20} />}
              onClick={() =>
                setFulfillmentMethod("shipping")
              }
            />

            <Choice
              selected={
                fulfillmentMethod === "local_delivery"
              }
              title="Entrega local"
              description="Entrega dentro del área acordada."
              icon={<MapPin size={20} />}
              onClick={() =>
                setFulfillmentMethod("local_delivery")
              }
            />

            <Choice
              selected={fulfillmentMethod === "pickup"}
              title="Retiro / encuentro"
              description="Coordina un punto de entrega."
              icon={<MapPin size={20} />}
              onClick={() =>
                setFulfillmentMethod("pickup")
              }
            />

          </div>
        </section>

        <div className="h-2" />

        {/* PAYMENT */}
        <section className="bg-white px-5 py-6">
          <h2 className="font-bold">
            Método de pago
          </h2>

          <p className="mt-1 text-xs text-zinc-400">
            Selecciona cómo deseas pagar.
          </p>

          <div className="mt-4 space-y-3">

            {/* YAPPY */}
            <Choice
              selected={paymentMethod === "yappy"}
              title="Yappy"
              description="Paga rápidamente desde tu celular."
              icon={
                <Smartphone size={21} />
              }
              onClick={() =>
                setPaymentMethod("yappy")
              }
            />

            {/* CARD */}
            <Choice
              selected={paymentMethod === "card"}
              title="Tarjeta"
              description="Visa, Mastercard y tarjetas compatibles."
              icon={
                <CreditCard size={21} />
              }
              onClick={() =>
                setPaymentMethod("card")
              }
            />

          </div>
        </section>

        <div className="h-2" />

        {/* SUMMARY */}
        <section className="bg-white px-5 py-6">
          <h2 className="font-bold">
            Resumen
          </h2>

          <div className="mt-4 space-y-3 text-sm">

            <div className="flex justify-between">
              <span className="text-zinc-500">
                Artículo
              </span>

              <span>
                ${Number(order.amount).toFixed(2)}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-zinc-500">
                Envío
              </span>

              <span>
                Se calculará después
              </span>
            </div>

            <div className="border-t border-zinc-100 pt-4">
              <div className="flex items-center justify-between">
                <span className="font-bold">
                  Total
                </span>

                <span className="text-2xl font-black">
                  ${Number(order.amount).toFixed(2)}
                </span>
              </div>
            </div>

          </div>
        </section>

        {message && (
          <div className="m-5 rounded-xl bg-white p-4 text-sm">
            {message}
          </div>
        )}

      </div>

      {/* PAY BAR */}
      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-200 bg-white p-3">
        <div className="mx-auto max-w-md">

          <button
            type="button"
            onClick={continueToPayment}
            disabled={processing}
            className="flex w-full items-center justify-between rounded-2xl bg-black px-5 py-4 text-white disabled:opacity-50"
          >
            <div className="text-left">
              <p className="text-[10px] text-zinc-300">
                Total
              </p>

              <p className="font-black">
                ${Number(order.amount).toFixed(2)}
              </p>
            </div>

            <div className="flex items-center gap-2 text-sm font-bold">
              {processing
                ? "Procesando..."
                : paymentMethod === "yappy"
                ? "Continuar con Yappy"
                : "Pagar con tarjeta"}

              <ChevronRight size={18} />
            </div>

          </button>

        </div>
      </div>
    </main>
  );
}

function Choice({
  selected,
  title,
  description,
  icon,
  onClick,
}: {
  selected: boolean;
  title: string;
  description: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center rounded-2xl border p-4 text-left ${
        selected
          ? "border-black"
          : "border-zinc-200"
      }`}
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-100">
        {icon}
      </div>

      <div className="ml-3 flex-1">
        <p className="text-sm font-bold">
          {title}
        </p>

        <p className="mt-1 text-xs text-zinc-500">
          {description}
        </p>
      </div>

      <div
        className={`flex h-6 w-6 items-center justify-center rounded-full ${
          selected
            ? "bg-black text-white"
            : "border border-zinc-300"
        }`}
      >
        {selected && <Check size={14} />}
      </div>
    </button>
  );
}