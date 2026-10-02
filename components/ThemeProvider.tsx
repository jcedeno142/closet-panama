"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Theme = "light" | "black";
const ThemeContext = createContext<{ theme: Theme; setTheme: (theme: Theme) => void } | null>(null);
const storageKey = "closet-theme";

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, updateTheme] = useState<Theme>("light");
  const revision = useRef(0);
  const setTheme = useCallback((value: Theme) => {
    revision.current += 1;
    updateTheme(value);
    document.documentElement.dataset.theme = value;
    try { localStorage.setItem(storageKey, value); } catch { /* Storage may be disabled. */ }
  }, []);

  useEffect(() => {
    let active = true;
    let currentUserId: string | null | undefined;
    // Hydrate React state from the preference applied by the pre-paint document script.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(document.documentElement.dataset.theme === "black" ? "black" : "light");
    const supabase = createClient();
    async function syncAccount(userId: string | null) {
      if (!active || currentUserId === userId) return;
      const previousUser = currentUserId;
      currentUserId = userId;
      if (!userId) {
        if (previousUser) setTheme("light");
        return;
      }
      const startRevision = revision.current;
      const { data } = await supabase.from("profiles").select("theme").eq("id", userId).maybeSingle();
      if (active && currentUserId === userId && revision.current === startRevision && (data?.theme === "black" || data?.theme === "light")) setTheme(data.theme);
    }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      // Run database requests outside the auth callback's lock.
      queueMicrotask(() => { void syncAccount(session?.user.id || null); });
    });
    function onStorage(event: StorageEvent) {
      if (event.key === storageKey) setTheme(event.newValue === "black" ? "black" : "light");
    }
    window.addEventListener("storage", onStorage);
    return () => { active = false; subscription.unsubscribe(); window.removeEventListener("storage", onStorage); };
  }, [setTheme]);

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme requires ThemeProvider");
  return context;
}
