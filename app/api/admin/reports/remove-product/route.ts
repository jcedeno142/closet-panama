import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    /*
     * Authenticate the current user.
     */
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "No autorizado." },
        { status: 401 },
      );
    }

    /*
     * Verify that the authenticated user is an admin.
     */
    const { data: isAdmin, error: adminCheckError } =
      await supabase.rpc("is_admin");

    if (adminCheckError) {
      console.error(
        "Admin verification error:",
        adminCheckError,
      );

      return NextResponse.json(
        { error: "No pudimos verificar los permisos de administrador." },
        { status: 500 },
      );
    }

    if (!isAdmin) {
      return NextResponse.json(
        { error: "Acceso restringido." },
        { status: 403 },
      );
    }

    /*
     * Read the report ID sent by the dashboard.
     */
    const body = await request.json();
    const reportId = body?.reportId;

    if (!reportId || typeof reportId !== "string") {
      return NextResponse.json(
        { error: "Reporte inválido." },
        { status: 400 },
      );
    }

    const admin = createAdminClient();

    /*
     * Load the report.
     *
     * We get product_id from the database instead of
     * trusting a product ID sent from the browser.
     */
    const { data: report, error: reportError } = await admin
      .from("reports")
      .select("id, product_id, status")
      .eq("id", reportId)
      .maybeSingle();

    if (reportError) {
      console.error(
        "Admin report lookup error:",
        reportError,
      );

      return NextResponse.json(
        { error: "No pudimos cargar el reporte." },
        { status: 500 },
      );
    }

    if (!report) {
      return NextResponse.json(
        { error: "El reporte no existe." },
        { status: 404 },
      );
    }

    /*
     * Product may already have been removed.
     */
    if (!report.product_id) {
      return NextResponse.json(
        { error: "Esta publicación ya no está disponible." },
        { status: 400 },
      );
    }

    /*
     * Require the report to be under review before
     * allowing a destructive moderation action.
     */
    if (report.status !== "reviewing") {
      return NextResponse.json(
        {
          error:
            "El reporte debe estar en revisión antes de eliminar la publicación.",
        },
        { status: 400 },
      );
    }

    /*
     * DELETE THE PRODUCT.
     *
     * .select("id").maybeSingle() lets us verify that
     * PostgreSQL actually deleted a row.
     */
    const { data: deletedProduct, error: deleteError } =
      await admin
        .from("products")
        .delete()
        .eq("id", report.product_id)
        .select("id")
        .maybeSingle();

    if (deleteError) {
      console.error(
        "Admin product delete error:",
        deleteError,
      );

      return NextResponse.json(
        {
          error: `No pudimos eliminar la publicación: ${deleteError.message}`,
        },
        { status: 500 },
      );
    }

    /*
     * Don't report success if zero products were deleted.
     */
    if (!deletedProduct) {
      console.error(
        "Product deletion matched zero rows:",
        report.product_id,
      );

      return NextResponse.json(
        {
          error:
            "La publicación no fue eliminada. No encontramos el artículo en la base de datos.",
        },
        { status: 404 },
      );
    }

    /*
     * Now that deletion succeeded, close the report.
     *
     * Because reports.product_id uses ON DELETE SET NULL,
     * the report remains as moderation history.
     */
    const { error: resolveError } = await admin
      .from("reports")
      .update({
        status: "resolved",
      })
      .eq("id", reportId);

    if (resolveError) {
      console.error(
        "Resolve report error:",
        resolveError,
      );

      return NextResponse.json(
        {
          error:
            "La publicación fue eliminada, pero no pudimos cerrar el reporte.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      deletedProductId: deletedProduct.id,
    });
  } catch (error) {
    console.error(
      "Admin remove product error:",
      error,
    );

    return NextResponse.json(
      { error: "Ocurrió un error inesperado." },
      { status: 500 },
    );
  }
}