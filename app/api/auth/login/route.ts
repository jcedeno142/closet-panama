import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  try {
    const { identifier, password } = await request.json();
    if (typeof identifier !== "string" || typeof password !== "string" || identifier.length > 254 || password.length > 256) {
      return Response.json({ error: "Datos inválidos." }, { status: 400 });
    }
    let email = identifier.trim().toLowerCase();
    if (!email.includes("@") || email.startsWith("@")) {
      const admin = createAdminClient();
      const { data: profile } = await admin.from("profiles").select("id").eq("username", email.replace(/^@/, "")).maybeSingle();
      if (!profile) return Response.json({ error: "Usuario o contraseña incorrectos." }, { status: 401 });
      const { data } = await admin.auth.admin.getUserById(profile.id);
      email = data.user?.email || "";
    }
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return Response.json({ error: "Usuario o contraseña incorrectos." }, { status: 401 });
    return Response.json({ success: true });
  } catch {
    return Response.json({ error: "No pudimos iniciar sesión. Inténtalo nuevamente." }, { status: 500 });
  }
}
