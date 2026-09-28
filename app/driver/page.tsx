"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  Box,
  CheckCircle2,
  KeyRound,
  PackageCheck,
  RefreshCw,
  Truck,
} from "lucide-react";

type Delivery = {
  assignment: {
    id: string;
    status: string;
    assignedAt: string;
    pickedUpAt: string | null;
    completedAt: string | null;
  };

  order: {
    id: string;
    amount: number;
    status: string;
    createdAt: string;
  };

  product: {
    id: string;
    title: string;
    image: string | null;
  } | null;

  seller: {
    id: string;
    username: string | null;
    displayName: string | null;
  } | null;

  buyer: {
    id: string;
    username: string | null;
    displayName: string | null;
  } | null;
};

type Driver = {
  id: string;
  username: string | null;
  displayName: string | null;
};

export default function DriverPage() {
  const [driver, setDriver] =
    useState<Driver | null>(null);

  const [deliveries, setDeliveries] =
    useState<Delivery[]>([]);

  const [codes, setCodes] = useState<
    Record<string, string>
  >({});

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [processingId, setProcessingId] =
    useState<string | null>(null);

  const [message, setMessage] =
    useState("");

  async function loadDeliveries(
    showRefresh = false,
  ) {
    if (showRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setMessage("");

    try {
      const response = await fetch(
        "/api/delivery/my-deliveries",
        {
          cache: "no-store",
        },
      );

      const data = await response.json();

      if (response.status === 401) {
        window.location.href = "/auth";
        return;
      }

      if (!response.ok) {
        setMessage(
          data.error ||
            "No pudimos cargar tus entregas.",
        );

        return;
      }

      setDriver(data.driver || null);

      setDeliveries(
        data.deliveries || [],
      );
    } catch (error) {
      console.error(error);

      setMessage(
        "Ocurrió un error al cargar tus entregas.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    loadDeliveries();
  }, []);

  function updateCode(
    orderId: string,
    value: string,
  ) {
    const digits = value
      .replace(/\D/g, "")
      .slice(0, 6);

    setCodes((current) => ({
      ...current,
      [orderId]: digits,
    }));
  }

  async function verifyPickup(
    orderId: string,
  ) {
    const code = codes[orderId] || "";

    if (!/^\d{6}$/.test(code)) {
      setMessage(
        "Ingresa el código de 6 dígitos.",
      );

      return;
    }

    setProcessingId(orderId);
    setMessage("");

    try {
      const response = await fetch(
        "/api/delivery/verify-pickup",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            orderId,
            code,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(
          data.error ||
            "No pudimos verificar el código.",
        );

        return;
      }

      if (!data.success) {
        if (
          typeof data.attemptsRemaining ===
          "number"
        ) {
          setMessage(
            `Código incorrecto. Te quedan ${data.attemptsRemaining} intento${
              data.attemptsRemaining === 1
                ? ""
                : "s"
            }.`,
          );
        } else {
          setMessage(
            "El código no es correcto.",
          );
        }

        return;
      }

      setCodes((current) => ({
        ...current,
        [orderId]: "",
      }));

      setMessage(
        data.alreadyPickedUp
          ? "La recogida ya estaba confirmada."
          : "Recogida confirmada correctamente.",
      );

      await loadDeliveries();
    } catch (error) {
      console.error(error);

      setMessage(
        "Ocurrió un error al verificar el código.",
      );
    } finally {
      setProcessingId(null);
    }
  }

  const activeDeliveries =
    deliveries.filter(
      (delivery) =>
        delivery.order.status !==
        "completed",
    );

  const completedDeliveries =
    deliveries.filter(
      (delivery) =>
        delivery.order.status ===
        "completed",
    );

  return (
    <main className="min-h-screen bg-zinc-50 text-black">
      <div className="mx-auto max-w-md">
        <header className="sticky top-0 z-40 border-b border-zinc-100 bg-white">
          <div className="flex items-center px-4 py-4">
            <Link
              href="/"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100"
            >
              <ArrowLeft size={20} />
            </Link>

            <div className="ml-4 min-w-0 flex-1">
              <h1 className="text-lg font-black">
                Mis entregas
              </h1>

              <p className="truncate text-xs text-zinc-400">
                {driver
                  ? `Conductor: ${
                      driver.displayName ||
                      driver.username ||
                      "Cuenta de conductor"
                    }`
                  : "Panel del conductor"}
              </p>
            </div>

            <button
              type="button"
              disabled={refreshing}
              onClick={() =>
                loadDeliveries(true)
              }
              className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-100 disabled:opacity-50"
              aria-label="Actualizar entregas"
            >
              <RefreshCw
                size={18}
                className={
                  refreshing
                    ? "animate-spin"
                    : ""
                }
              />
            </button>
          </div>
        </header>

        {message && (
          <div className="mx-4 mt-4 rounded-2xl bg-white p-4 text-sm">
            {message}
          </div>
        )}

        {loading ? (
          <div className="flex min-h-[60vh] items-center justify-center">
            <p className="text-sm text-zinc-400">
              Cargando entregas...
            </p>
          </div>
        ) : activeDeliveries.length ===
            0 ? (
          <div className="flex min-h-[55vh] flex-col items-center justify-center px-6 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white">
              <Truck size={27} />
            </div>

            <h2 className="mt-4 font-black">
              No tienes entregas activas
            </h2>

            <p className="mt-2 max-w-xs text-sm text-zinc-400">
              Cuando un vendedor te asigne
              una entrega, aparecerá aquí.
            </p>
          </div>
        ) : (
          <div className="space-y-3 p-4">
            {activeDeliveries.map(
              (delivery) => (
                <DeliveryCard
                  key={
                    delivery.assignment.id
                  }
                  delivery={delivery}
                  code={
                    codes[
                      delivery.order.id
                    ] || ""
                  }
                  processing={
                    processingId ===
                    delivery.order.id
                  }
                  onCodeChange={(value) =>
                    updateCode(
                      delivery.order.id,
                      value,
                    )
                  }
                  onVerifyPickup={() =>
                    verifyPickup(
                      delivery.order.id,
                    )
                  }
                />
              ),
            )}
          </div>
        )}

        {!loading &&
          completedDeliveries.length >
            0 && (
            <section className="px-4 pb-8">
              <h2 className="mb-3 text-sm font-black">
                Completadas
              </h2>

              <div className="space-y-3">
                {completedDeliveries.map(
                  (delivery) => (
                    <DeliveryCard
                      key={
                        delivery.assignment
                          .id
                      }
                      delivery={delivery}
                      code=""
                      processing={false}
                      onCodeChange={() => {}}
                      onVerifyPickup={() => {}}
                    />
                  ),
                )}
              </div>
            </section>
          )}
      </div>
    </main>
  );
}

function DeliveryCard({
  delivery,
  code,
  processing,
  onCodeChange,
  onVerifyPickup,
}: {
  delivery: Delivery;
  code: string;
  processing: boolean;
  onCodeChange: (
    value: string,
  ) => void;
  onVerifyPickup: () => void;
}) {
  const sellerName =
    delivery.seller?.displayName ||
    delivery.seller?.username ||
    "Vendedor";

  const buyerName =
    delivery.buyer?.displayName ||
    delivery.buyer?.username ||
    "Comprador";

  const status =
    delivery.order.status;

  return (
    <article className="overflow-hidden rounded-2xl bg-white">
      <div className="flex gap-4 p-4">
        <div className="h-24 w-20 shrink-0 overflow-hidden rounded-xl bg-zinc-100">
          {delivery.product?.image ? (
            <img
              src={
                delivery.product.image
              }
              alt={
                delivery.product.title ||
                "Producto"
              }
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <Box
                size={21}
                className="text-zinc-300"
              />
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <DriverStatusBadge
            status={status}
          />

          <h2 className="mt-2 truncate font-bold">
            {delivery.product?.title ||
              "Producto"}
          </h2>

          <p className="mt-1 text-xs text-zinc-400">
            Recoger de: {sellerName}
          </p>

          <p className="mt-1 text-xs text-zinc-400">
            Entregar a: {buyerName}
          </p>

          <p className="mt-2 text-lg font-black">
            $
            {Number(
              delivery.order.amount,
            ).toFixed(2)}
          </p>
        </div>
      </div>

      {status ===
        "ready_for_pickup" && (
        <>
          <div className="border-t border-zinc-100 bg-zinc-50 px-4 py-3">
            <div className="flex items-center gap-2">
              <PackageCheck
                size={16}
                className="text-zinc-500"
              />

              <div>
                <p className="text-xs font-semibold text-zinc-600">
                  Listo para recoger
                </p>

                <p className="mt-1 text-[11px] text-zinc-400">
                  Solicita el código al
                  vendedor cuando tengas el
                  artículo.
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-zinc-100 p-4">
            <label className="text-xs font-bold">
              Código de recogida
            </label>

            <div className="relative mt-2">
              <KeyRound
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400"
              />

              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(event) =>
                  onCodeChange(
                    event.target.value,
                  )
                }
                placeholder="000000"
                className="w-full rounded-xl border border-zinc-200 py-3 pl-11 pr-4 text-center text-xl font-black tracking-[0.3em] outline-none focus:border-black"
              />
            </div>

            <button
              type="button"
              disabled={
                processing ||
                code.length !== 6
              }
              onClick={onVerifyPickup}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-black px-4 py-3 text-sm font-bold text-white disabled:opacity-40"
            >
              <PackageCheck
                size={18}
              />

              {processing
                ? "Verificando..."
                : "Confirmar recogida"}
            </button>
          </div>
        </>
      )}

      {status === "picked_up" && (
        <div className="border-t border-zinc-100 bg-zinc-50 px-4 py-4">
          <div className="flex items-center gap-2">
            <Truck
              size={17}
              className="text-zinc-500"
            />

            <div>
              <p className="text-xs font-bold text-zinc-600">
                Artículo recogido
              </p>

              <p className="mt-1 text-[11px] text-zinc-400">
                El comprador debe generar
                su código de entrega.
              </p>
            </div>
          </div>
        </div>
      )}

      {status ===
        "out_for_delivery" && (
        <div className="border-t border-zinc-100 bg-zinc-50 px-4 py-4">
          <div className="flex items-center gap-2">
            <Truck
              size={17}
              className="text-zinc-500"
            />

            <div>
              <p className="text-xs font-bold text-zinc-600">
                En camino
              </p>

              <p className="mt-1 text-[11px] text-zinc-400">
                Solicita el código de
                entrega al comprador cuando
                entregues el artículo.
              </p>
            </div>
          </div>
        </div>
      )}

      {status === "completed" && (
        <div className="flex items-center gap-2 border-t border-zinc-100 bg-zinc-50 px-4 py-4">
          <CheckCircle2
            size={17}
            className="text-zinc-500"
          />

          <p className="text-xs font-bold text-zinc-600">
            Entrega completada
          </p>
        </div>
      )}
    </article>
  );
}

function DriverStatusBadge({
  status,
}: {
  status: string;
}) {
  let label = status;

  if (status === "paid") {
    label = "Asignado";
  }

  if (
    status === "ready_for_pickup"
  ) {
    label = "Listo para recoger";
  }

  if (status === "picked_up") {
    label = "Recogido";
  }

  if (
    status === "out_for_delivery"
  ) {
    label = "En camino";
  }

  if (status === "completed") {
    label = "Completado";
  }

  return (
    <span className="inline-flex rounded-full bg-zinc-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide">
      {label}
    </span>
  );
}