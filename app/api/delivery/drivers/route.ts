import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "No autorizado." },
        { status: 401 },
      );
    }

    const admin = createAdminClient();

    /*
     * Return only approved driver accounts.
     *
     * We expose only the information the seller needs
     * to choose a driver.
     */
    const { data: drivers, error: driversError } =
      await admin
        .from("profiles")
        .select(`
          id,
          username,
          display_name
        `)
        .eq("is_driver", true)
        .order("display_name", {
          ascending: true,
        });

    if (driversError) {
      console.error(
        "Approved drivers lookup error:",
        driversError,
      );

      return NextResponse.json(
        {
          error:
            "No pudimos cargar los conductores.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,

      drivers: (drivers || []).map((driver) => ({
        id: driver.id,
        username: driver.username,
        displayName: driver.display_name,
      })),
    });
  } catch (error) {
    console.error(
      "Drivers API unexpected error:",
      error,
    );

    return NextResponse.json(
      {
        error:
          "Ocurrió un error al cargar los conductores.",
      },
      { status: 500 },
    );
  }
}