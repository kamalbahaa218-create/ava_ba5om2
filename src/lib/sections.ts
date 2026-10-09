import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Reusable "new content" indicator.
 * Any table can bump a section with the DB trigger `bump_section('<key>')`;
 * map the section key to a nav path here and the red dot works automatically.
 */
export const SECTION_BY_PATH: Record<string, string> = {
  "/": "home",
  "/program": "program",
  "/calendar": "calendar",
  "/quizzes": "quizzes",
  "/content": "content",
  "/suggestions": "suggestions",
};

/** Pure rule: a section is new when it changed after the user last saw it (or never saw it). */
export function unseenSections(
  updates: { section: string; updated_at: string }[],
  views: { section: string; seen_at: string }[],
): Set<string> {
  const seen = new Map(views.map((v) => [v.section, Date.parse(v.seen_at)]));
  return new Set(
    updates
      .filter((u) => {
        const s = seen.get(u.section);
        return s === undefined || Date.parse(u.updated_at) > s;
      })
      .map((u) => u.section),
  );
}

const KEY = ["section-indicators"];

export function useNewSections(userId: string | undefined) {
  return useQuery({
    queryKey: [...KEY, userId],
    enabled: !!userId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const [u, v] = await Promise.all([
        supabase.from("section_updates").select("section, updated_at"),
        supabase.from("section_views").select("section, seen_at").eq("user_id", userId!),
      ]);
      if (u.error) throw u.error;
      if (v.error) throw v.error;
      return unseenSections(u.data ?? [], v.data ?? []);
    },
  });
}

/** Marks the section for the current path as seen whenever it shows as new. */
export function useMarkSectionSeen(userId: string | undefined, pathname: string, isNew: boolean) {
  const qc = useQueryClient();
  const section = SECTION_BY_PATH[pathname];
  useEffect(() => {
    if (!userId || !section || !isNew) return;
    supabase
      .from("section_views")
      .upsert({ user_id: userId, section, seen_at: new Date().toISOString() })
      .then(() => qc.invalidateQueries({ queryKey: KEY }));
  }, [userId, section, isNew, qc]);
}
