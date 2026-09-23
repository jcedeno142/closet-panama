"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  Eye,
  ShieldCheck,
  User,
  XCircle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type ReportStatus = "pending" | "reviewing" | "resolved" | "dismissed";

type Product = {
  id: string;
  title: string;
  price: number;
  seller_id: string;
};

type Profile = {
  id: string;
  username: string | null;
  display_name: string | null;
};

type Report = {
  id: string;
  reporter_id: string;
  product_id: string | null;
  seller_id: string;
  reason: string;
  details: string | null;
  status: ReportStatus;
  created_at: string;
  product: Product | null;
  reporter: Profile | null;
  seller: Profile | null;
};

type RawReport = {
  id: string;
  reporter_id: string;
  product_id: string | null;
  seller_id: string;
  reason: string;
  details: string | null;
  status: ReportStatus;
  created_at: string;
  products: Product | Product[] | null;
};

const reasonLabels: Record<string, string> = {
  counterfeit: "Artículo falso o imitación",
  scam: "Posible estafa",
  prohibited: "Artículo prohibido",
  inappropriate: "Contenido inapropiado",
  other: "Otro",
};

export default function AdminReportsPage() {
  const supabase = useMemo(() => createClient(), []);

  const [reports, setReports] = useState<Report[]>([]);
  const [activeStatus, setActiveStatus] = useState<ReportStatus>("pending");

  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [updatingId, setUpdatingId] = useState("");

  useEffect(() => {
    loadReports();
  }, []);

  async function loadReports() {
    setLoading(true);
    setError("");

    /*
     * 1. Verify authentication.
     */
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setAuthorized(false);
      setLoading(false);
      return;
    }

    /*
     * 2. Verify admin role.
     *
     * This is for the UI only. Supabase RLS remains the actual
     * security layer protecting reports.
     */
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError) {
      console.error("Admin profile error:", profileError);
      setError("No pudimos verificar tu cuenta.");
      setLoading(false);
      return;
    }

    if (profile?.role !== "admin") {
      setAuthorized(false);
      setLoading(false);
      return;
    }

    setAuthorized(true);

    /*
     * 3. Load reports and their products.
     */
    const { data, error: reportsError } = await supabase
      .from("reports")
      .select(
        `
        id,
        reporter_id,
        product_id,
        seller_id,
        reason,
        details,
        status,
        created_at,
        products (
          id,
          title,
          price,
          seller_id
        )
      `,
      )
      .order("created_at", { ascending: false });

    if (reportsError) {
      console.error("Reports error:", reportsError);
      setError(reportsError.message);
      setLoading(false);
      return;
    }

    const rawReports = (data || []) as RawReport[];

    /*
     * 4. Collect reporter and seller profile IDs.
     */
    const profileIds = Array.from(
      new Set(
        rawReports.flatMap((report) => [report.reporter_id, report.seller_id]),
      ),
    );

    let profiles: Profile[] = [];

    if (profileIds.length > 0) {
      const { data: profileData, error: profilesError } = await supabase
        .from("profiles")
        .select("id, username, display_name")
        .in("id", profileIds);

      if (profilesError) {
        console.error("Profiles error:", profilesError);
        setError(profilesError.message);
        setLoading(false);
        return;
      }

      profiles = profileData || [];
    }

    const profileMap = new Map(
      profiles.map((profile) => [profile.id, profile]),
    );

    /*
     * 5. Normalize the data for the UI.
     */
    const normalizedReports: Report[] = rawReports.map((report) => {
      const product = Array.isArray(report.products)
        ? report.products[0] || null
        : report.products;

      return {
        id: report.id,
        reporter_id: report.reporter_id,
        product_id: report.product_id,
        seller_id: report.seller_id,
        reason: report.reason,
        details: report.details,
        status: report.status,
        created_at: report.created_at,
        product,
        reporter: profileMap.get(report.reporter_id) || null,
        seller: profileMap.get(report.seller_id) || null,
      };
    });

    setReports(normalizedReports);
    setLoading(false);
  }

  async function updateReportStatus(reportId: string, status: ReportStatus) {
    if (updatingId) return;

    setUpdatingId(reportId);
    setError("");

    const { error: updateError } = await supabase
      .from("reports")
      .update({ status })
      .eq("id", reportId);

    if (updateError) {
      console.error("Update report error:", updateError);
      setError("No pudimos actualizar el reporte.");
      setUpdatingId("");
      return;
    }

    setReports((current) =>
      current.map((report) =>
        report.id === reportId ? { ...report, status } : report,
      ),
    );

    setUpdatingId("");
  }

  async function removeReportedProduct(report: Report) {
    if (updatingId) return;

    if (!report.product) {
      setError("Esta publicación ya no está disponible.");
      return;
    }

    const confirmed = window.confirm(
      `¿Eliminar "${report.product.title}"?\n\nEsta acción eliminará permanentemente la publicación y marcará el reporte como resuelto.`,
    );

    if (!confirmed) return;

    setUpdatingId(report.id);
    setError("");

    try {
      const response = await fetch("/api/admin/reports/remove-product", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          reportId: report.id,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "No pudimos eliminar la publicación.");
        return;
      }

      setReports((current) =>
        current.map((item) =>
          item.id === report.id
            ? {
                ...item,
                status: "resolved",
                product_id: null,
                product: null,
              }
            : item,
        ),
      );
    } catch (error) {
      console.error("Remove product error:", error);

      setError("No pudimos comunicarnos con el servidor.");
    } finally {
      setUpdatingId("");
    }
  }

  const filteredReports = reports.filter(
    (report) => report.status === activeStatus,
  );

  const pendingCount = reports.filter(
    (report) => report.status === "pending",
  ).length;

  const reviewingCount = reports.filter(
    (report) => report.status === "reviewing",
  ).length;

  const resolvedCount = reports.filter(
    (report) => report.status === "resolved" || report.status === "dismissed",
  ).length;

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 text-black">
        <p className="text-sm text-zinc-500">Cargando moderación...</p>
      </main>
    );
  }

  if (authorized === false) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 px-5 text-black">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-sm">
          <ShieldCheck size={40} className="mx-auto text-zinc-300" />

          <h1 className="mt-4 text-xl font-bold">Acceso restringido</h1>

          <p className="mt-2 text-sm leading-6 text-zinc-500">
            Esta sección está disponible únicamente para administradores.
          </p>

          <Link
            href="/"
            className="mt-6 inline-flex rounded-2xl bg-black px-6 py-3 text-sm font-bold text-white"
          >
            Volver al inicio
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50 pb-20 text-black">
      <div className="mx-auto max-w-5xl px-4 py-6 md:px-8 md:py-10">
        {/* HEADER */}
        <div className="flex items-center gap-4">
          <Link
            href="/"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-sm"
          >
            <ArrowLeft size={19} />
          </Link>

          <div className="flex-1">
            <div className="flex items-center gap-2">
              <ShieldCheck size={20} />

              <p className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-400">
                Administración
              </p>
            </div>

            <h1 className="mt-1 text-2xl font-black md:text-3xl">Reportes</h1>
          </div>
        </div>

        {/* STATS */}
        <div className="mt-8 grid grid-cols-3 gap-3">
          <StatCard label="Pendientes" value={pendingCount} />

          <StatCard label="En revisión" value={reviewingCount} />

          <StatCard label="Cerrados" value={resolvedCount} />
        </div>

        {/* FILTERS */}
        <div className="mt-8 flex gap-2 overflow-x-auto pb-1">
          <FilterButton
            active={activeStatus === "pending"}
            onClick={() => setActiveStatus("pending")}
          >
            Pendientes
          </FilterButton>

          <FilterButton
            active={activeStatus === "reviewing"}
            onClick={() => setActiveStatus("reviewing")}
          >
            En revisión
          </FilterButton>

          <FilterButton
            active={activeStatus === "resolved"}
            onClick={() => setActiveStatus("resolved")}
          >
            Resueltos
          </FilterButton>

          <FilterButton
            active={activeStatus === "dismissed"}
            onClick={() => setActiveStatus("dismissed")}
          >
            Descartados
          </FilterButton>
        </div>

        {error && (
          <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* REPORTS */}
        <div className="mt-6 space-y-4">
          {filteredReports.length === 0 ? (
            <div className="rounded-3xl bg-white px-6 py-16 text-center shadow-sm">
              <CheckCircle2 size={38} className="mx-auto text-zinc-300" />

              <p className="mt-4 font-bold">No hay reportes aquí</p>

              <p className="mt-1 text-sm text-zinc-500">
                No existen reportes con este estado.
              </p>
            </div>
          ) : (
            filteredReports.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                updating={updatingId === report.id}
                onUpdateStatus={updateReportStatus}
                onRemoveProduct={removeReportedProduct}
              />
            ))
          )}
        </div>
      </div>
    </main>
  );
}

function ReportCard({
  report,
  updating,
  onUpdateStatus,
  onRemoveProduct,
}: {
  report: Report;
  updating: boolean;
  onUpdateStatus: (reportId: string, status: ReportStatus) => Promise<void>;
  onRemoveProduct: (report: Report) => Promise<void>;
}) {
  const date = new Intl.DateTimeFormat("es-PA", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(report.created_at));

  return (
    <article className="overflow-hidden rounded-3xl bg-white shadow-sm">
      <div className="p-5 md:p-6">
        {/* STATUS */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <StatusBadge status={report.status} />

          <span className="text-xs text-zinc-400">{date}</span>
        </div>

        {/* PRODUCT */}
        <div className="mt-5">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">
            Publicación reportada
          </p>

          <div className="mt-2 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold">
                {report.product?.title || "Publicación no disponible"}
              </h2>

              {report.product && (
                <p className="mt-1 text-sm font-semibold text-zinc-500">
                  ${Number(report.product.price).toFixed(2)}
                </p>
              )}
            </div>

            {report.product && (
              <Link
                href={`/product/${report.product.id}`}
                target="_blank"
                className="flex shrink-0 items-center gap-2 rounded-xl bg-zinc-100 px-3 py-2 text-xs font-bold"
              >
                <Eye size={14} />
                Ver
              </Link>
            )}
          </div>
        </div>

        {/* REASON */}
        <div className="mt-5 rounded-2xl bg-zinc-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={18} className="mt-0.5 shrink-0" />

            <div>
              <p className="text-sm font-bold">
                {reasonLabels[report.reason] || report.reason}
              </p>

              {report.details && (
                <p className="mt-2 whitespace-pre-line text-sm leading-6 text-zinc-600">
                  {report.details}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* USERS */}
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          <UserBox
            label="Vendedor"
            profile={report.seller}
            userId={report.seller_id}
          />

          <UserBox
            label="Reportado por"
            profile={report.reporter}
            userId={report.reporter_id}
          />
        </div>

        {/* ACTIONS */}
        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          {report.status === "pending" && (
            <>
              <button
                type="button"
                disabled={updating}
                onClick={() => onUpdateStatus(report.id, "reviewing")}
                className="flex-1 rounded-2xl bg-black px-4 py-3.5 text-sm font-bold text-white disabled:opacity-50"
              >
                {updating ? "Actualizando..." : "Marcar en revisión"}
              </button>

              <button
                type="button"
                disabled={updating}
                onClick={() => onUpdateStatus(report.id, "dismissed")}
                className="flex-1 rounded-2xl border border-zinc-200 px-4 py-3.5 text-sm font-bold disabled:opacity-50"
              >
                Descartar reporte
              </button>
            </>
          )}

          {report.status === "reviewing" && (
            <>
              <button
                type="button"
                disabled={updating}
                onClick={() => onUpdateStatus(report.id, "resolved")}
                className="flex-1 rounded-2xl bg-black px-4 py-3.5 text-sm font-bold text-white disabled:opacity-50"
              >
                Resolver reporte
              </button>

              {report.product && (
                <button
                  type="button"
                  disabled={updating}
                  onClick={() => onRemoveProduct(report)}
                  className="flex-1 rounded-2xl bg-red-600 px-4 py-3.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  Eliminar publicación
                </button>
              )}

              <button
                type="button"
                disabled={updating}
                onClick={() => onUpdateStatus(report.id, "dismissed")}
                className="flex-1 rounded-2xl border border-zinc-200 px-4 py-3.5 text-sm font-bold disabled:opacity-50"
              >
                Descartar
              </button>
            </>
          )}
        </div>
      </div>
    </article>
  );
}

function UserBox({
  label,
  profile,
  userId,
}: {
  label: string;
  profile: Profile | null;
  userId: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-100 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-zinc-400">
        {label}
      </p>

      <div className="mt-2 flex items-center gap-2">
        <User size={16} />

        <div>
          <p className="text-sm font-bold">
            {profile?.display_name || profile?.username || "Usuario"}
          </p>

          {profile?.username && (
            <p className="text-xs text-zinc-500">@{profile.username}</p>
          )}
        </div>
      </div>

      <p className="mt-2 truncate text-[10px] text-zinc-300">{userId}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: ReportStatus }) {
  const labels: Record<ReportStatus, string> = {
    pending: "Pendiente",
    reviewing: "En revisión",
    resolved: "Resuelto",
    dismissed: "Descartado",
  };

  return (
    <div className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-bold">
      <Clock size={13} />
      {labels[status]}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="text-2xl font-black">{value}</p>

      <p className="mt-1 text-xs font-semibold text-zinc-500">{label}</p>
    </div>
  );
}

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-4 py-2.5 text-sm font-bold transition ${
        active ? "bg-black text-white" : "bg-white text-zinc-500"
      }`}
    >
      {children}
    </button>
  );
}
