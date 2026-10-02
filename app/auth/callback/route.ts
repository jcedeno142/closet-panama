import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return Response.redirect(new URL(url.searchParams.get("recovery") === "1" ? "/auth/reset" : "/profile/security", url.origin));
  }
  return Response.redirect(new URL("/auth?error=expired", url.origin));
}
