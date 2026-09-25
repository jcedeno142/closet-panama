"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export default function ProfilePage() {
  useEffect(() => {
    async function openMyProfile() {
      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        window.location.replace("/auth");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .maybeSingle();

      if (profileError || !profile?.username) {
        console.error("Profile redirect error:", profileError);
        window.location.replace("/");
        return;
      }

      const username = profile.username.replace(/^@/, "");

      window.location.replace(
        `/seller/${encodeURIComponent(username)}`,
      );
    }

    openMyProfile();
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-white text-black">
      <p className="text-sm text-zinc-400">
        Cargando perfil...
      </p>
    </main>
  );
}