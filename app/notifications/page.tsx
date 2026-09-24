"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Bell,
  CheckCheck,
  MessageCircle,
  ShoppingBag,
  Tag,
  UserPlus,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Notification = {
  id: string;
  user_id: string;
  actor_id: string | null;
  type: string;
  title: string;
  message: string;
  link: string | null;
  product_id: string | null;
  read_at: string | null;
  created_at: string;
};

export default function NotificationsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    loadNotifications();
  }, []);

  async function loadNotifications() {
    setLoading(true);
    setErrorMessage("");

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      window.location.href = "/auth";
      return;
    }

    const { data, error } = await supabase
      .from("notifications")
      .select(`
        id,
        user_id,
        actor_id,
        type,
        title,
        message,
        link,
        product_id,
        read_at,
        created_at
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Load notifications error:", error);
      setErrorMessage("No pudimos cargar tus notificaciones.");
      setLoading(false);
      return;
    }

    setNotifications(data || []);
    setLoading(false);
  }

  async function markAsRead(notification: Notification) {
    if (notification.read_at) {
      return;
    }

    const now = new Date().toISOString();

    const { error } = await supabase
      .from("notifications")
      .update({
        read_at: now,
      })
      .eq("id", notification.id);

    if (error) {
      console.error("Mark notification read error:", error);
      return;
    }

    setNotifications((current) =>
      current.map((item) =>
        item.id === notification.id
          ? {
              ...item,
              read_at: now,
            }
          : item,
      ),
    );
  }

  async function markAllAsRead() {
    if (markingAll) return;

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = "/auth";
      return;
    }

    setMarkingAll(true);

    const now = new Date().toISOString();

    const { error } = await supabase
      .from("notifications")
      .update({
        read_at: now,
      })
      .eq("user_id", user.id)
      .is("read_at", null);

    if (error) {
      console.error("Mark all notifications read error:", error);
      setMarkingAll(false);
      return;
    }

    setNotifications((current) =>
      current.map((notification) => ({
        ...notification,
        read_at: notification.read_at || now,
      })),
    );

    setMarkingAll(false);
  }

  const unreadCount = notifications.filter(
    (notification) => !notification.read_at,
  ).length;

  return (
    <main className="min-h-screen bg-zinc-50 pb-10 text-black">
      {/* HEADER */}
      <header className="sticky top-0 z-40 border-b border-zinc-100 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 py-4">
          <Link
            href="/"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100"
          >
            <ArrowLeft size={19} />
          </Link>

          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-black">
              Notificaciones
            </h1>

            <p className="text-xs text-zinc-400">
              {unreadCount > 0
                ? `${unreadCount} sin leer`
                : "Todo al día"}
            </p>
          </div>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllAsRead}
              disabled={markingAll}
              className="flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-2 text-xs font-bold disabled:opacity-50"
            >
              <CheckCheck size={15} />

              {markingAll ? "..." : "Leer todo"}
            </button>
          )}
        </div>
      </header>

      <section className="mx-auto max-w-md">
        {/* LOADING */}
        {loading && (
          <div className="space-y-2 px-4 py-5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div
                key={index}
                className="flex animate-pulse gap-3 rounded-2xl bg-white p-4"
              >
                <div className="h-11 w-11 shrink-0 rounded-full bg-zinc-100" />

                <div className="flex-1">
                  <div className="h-3 w-32 rounded bg-zinc-100" />
                  <div className="mt-3 h-2 w-full rounded bg-zinc-100" />
                  <div className="mt-2 h-2 w-20 rounded bg-zinc-100" />
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ERROR */}
        {!loading && errorMessage && (
          <div className="mx-4 mt-6 rounded-2xl bg-white p-6 text-center">
            <p className="text-sm font-semibold">
              {errorMessage}
            </p>

            <button
              type="button"
              onClick={loadNotifications}
              className="mt-4 rounded-xl bg-black px-5 py-3 text-xs font-bold text-white"
            >
              Intentar de nuevo
            </button>
          </div>
        )}

        {/* EMPTY */}
        {!loading &&
          !errorMessage &&
          notifications.length === 0 && (
            <div className="px-8 py-24 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-white">
                <Bell
                  size={27}
                  className="text-zinc-300"
                />
              </div>

              <h2 className="mt-5 font-bold">
                No tienes notificaciones
              </h2>

              <p className="mt-2 text-sm leading-6 text-zinc-400">
                Tus ofertas, ventas, mensajes y otras
                novedades aparecerán aquí.
              </p>
            </div>
          )}

        {/* NOTIFICATIONS */}
        {!loading &&
          !errorMessage &&
          notifications.length > 0 && (
            <div className="divide-y divide-zinc-100 bg-white">
              {notifications.map((notification) => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onRead={markAsRead}
                />
              ))}
            </div>
          )}
      </section>
    </main>
  );
}

function NotificationItem({
  notification,
  onRead,
}: {
  notification: Notification;
  onRead: (notification: Notification) => Promise<void>;
}) {
  const unread = !notification.read_at;

  const content = (
    <div
      className={`relative flex gap-3 px-4 py-4 transition ${
        unread ? "bg-zinc-50" : "bg-white"
      }`}
    >
      <NotificationIcon type={notification.type} />

      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <p
            className={`text-sm ${
              unread ? "font-black" : "font-bold"
            }`}
          >
            {notification.title}
          </p>

          {unread && (
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-red-500" />
          )}
        </div>

        <p className="mt-1 text-sm leading-5 text-zinc-500">
          {notification.message}
        </p>

        <p className="mt-2 text-[11px] font-medium text-zinc-400">
          {formatNotificationDate(notification.created_at)}
        </p>
      </div>
    </div>
  );

  if (notification.link) {
    return (
      <Link
        href={notification.link}
        onClick={() => {
          void onRead(notification);
        }}
        className="block"
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        void onRead(notification);
      }}
      className="block w-full text-left"
    >
      {content}
    </button>
  );
}

function NotificationIcon({
  type,
}: {
  type: string;
}) {
  let icon = <Bell size={18} />;

  if (
    type === "offer_received" ||
    type === "offer_countered" ||
    type === "offer_accepted" ||
    type === "offer_declined"
  ) {
    icon = <Tag size={18} />;
  }

  if (type === "message") {
    icon = <MessageCircle size={18} />;
  }

  if (
    type === "sale" ||
    type === "order_shipped" ||
    type === "order_completed"
  ) {
    icon = <ShoppingBag size={18} />;
  }

  if (type === "follow") {
    icon = <UserPlus size={18} />;
  }

  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-zinc-100">
      {icon}
    </div>
  );
}

function formatNotificationDate(value: string) {
  const date = new Date(value);

  return new Intl.DateTimeFormat("es-PA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}