import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { SECTION_BY_PATH, useMarkSectionSeen, useNewSections } from "@/lib/sections";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { SERVICE_NAME } from "@/lib/brand";
import { supabase } from "@/integrations/supabase/client";
import { useMyProfile, useSession } from "@/lib/auth";
import { getLang, saveLang } from "@/lib/i18n/core";

function LangSwitch() {
  const next = getLang() === "ar" ? "en" : "ar";
  return (
    <button
      type="button"
      lang={next}
      aria-label={next === "en" ? "Switch to English" : "التبديل إلى العربية"}
      onClick={() => {
        saveLang(next);
        window.location.reload();
      }}
      className="rounded-full px-3 py-2 text-sm font-semibold text-ink-soft ring-1 ring-line hover:bg-ink/5"
    >
      {next === "en" ? "EN" : "عربي"}
    </button>
  );
}

const NAV = [
  { to: "/", label: "الرئيسية" },
  { to: "/program", label: "موضوع وفقرات اليوم" },
  { to: "/calendar", label: "التقويم" },
  { to: "/quizzes", label: "المسابقات والامتحانات" },
  { to: "/content", label: "الدروس والمحتوى" },
  { to: "/suggestions", label: "الاقتراحات والأسئلة" },
] as const;

const STAFF_NAV = { to: "/followup", label: "الافتقاد" } as const;

function NewDot({ path, fresh }: { path: string; fresh: Set<string> | undefined }) {
  const s = SECTION_BY_PATH[path];
  if (!s || !fresh?.has(s)) return null;
  return (
    <span
      aria-label="محتوى جديد"
      className="ms-1.5 inline-block size-2 rounded-full bg-destructive align-middle"
    />
  );
}

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const { session } = useSession();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const userId = session?.user.id;
  const fresh = useNewSections(userId).data;
  const type = useMyProfile(userId).data?.user_type;
  const nav = type === "SERVANT" || type === "MAIN_ADMIN" ? [...NAV, STAFF_NAV] : [...NAV];
  const mobileNav = [...nav, { to: "/dashboard", label: "لوحتي" } as const];
  useMarkSectionSeen(userId, pathname, !!fresh?.has(SECTION_BY_PATH[pathname] ?? ""));

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    setOpen(false);
    navigate({ to: "/login", replace: true });
  }

  return (
    <header className="sticky top-0 z-20 animate-rise border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto grid max-w-6xl grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 sm:px-6 xl:flex xl:min-h-16 xl:justify-between xl:py-2">
        <Link to="/" className="flex min-w-0 items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-oxblood font-display text-lg font-black text-gold-soft">
            أ
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate font-display text-sm font-extrabold text-oxblood">
              {SERVICE_NAME}
            </span>
            <span className="block truncate text-[11px] text-ink-soft">
              كنيسة السيدة العذراء مريم
            </span>
          </span>
        </Link>

        <nav className="hidden flex-wrap items-center gap-1 text-sm font-medium xl:flex">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.to === "/" }}
              className="rounded-full px-3 py-2 text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink"
              activeProps={{ className: "bg-ink text-paper hover:bg-ink hover:text-paper" }}
            >
              {item.label}
              <NewDot path={item.to} fresh={fresh} />
            </Link>
          ))}
        </nav>

        <div className="flex shrink-0 items-center gap-2">
          <LangSwitch />
          {session ? (
            <>
              <Link
                to="/dashboard"
                className="rounded-full bg-oxblood px-4 py-2 text-sm font-semibold text-gold-soft transition-transform duration-200 hover:-translate-y-0.5"
              >
                لوحتي
              </Link>
              <button
                type="button"
                onClick={signOut}
                className="hidden rounded-full px-3 py-2 text-sm font-semibold text-ink-soft hover:bg-ink/5 sm:block"
              >
                خروج
              </button>
            </>
          ) : (
            <Link
              to="/login"
              className="rounded-full bg-oxblood px-4 py-2 text-sm font-semibold text-gold-soft transition-transform duration-200 hover:-translate-y-0.5"
            >
              تسجيل الدخول
            </Link>
          )}
          <button
            type="button"
            aria-label="القائمة"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="relative grid size-10 shrink-0 place-items-center rounded-2xl bg-ink/5 text-ink xl:hidden"
          >
            {!!fresh?.size && (
              <span
                aria-label="يوجد محتوى جديد"
                className="absolute -end-1 -top-1 size-2.5 rounded-full bg-destructive ring-2 ring-paper"
              />
            )}
            <span className="space-y-1">
              <span className="block h-0.5 w-5 bg-ink" />
              <span className="block h-0.5 w-5 bg-ink" />
              <span className="block h-0.5 w-5 bg-ink" />
            </span>
          </button>
        </div>
      </div>

      {open && (
        <nav className="animate-rise2 border-t border-line px-4 pb-4 pt-2 text-sm font-medium xl:hidden">
          <div className="mx-auto flex max-w-6xl flex-col gap-1">
            {mobileNav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                activeOptions={{ exact: item.to === "/" }}
                onClick={() => setOpen(false)}
                className="rounded-2xl px-3 py-2.5 text-ink-soft transition-colors hover:bg-ink/5 hover:text-ink"
                activeProps={{ className: "bg-ink text-paper" }}
              >
                {item.label}
                <NewDot path={item.to} fresh={fresh} />
              </Link>
            ))}
            {session && (
              <button
                type="button"
                onClick={signOut}
                className="rounded-2xl px-3 py-2.5 text-start text-oxblood hover:bg-ink/5"
              >
                تسجيل الخروج
              </button>
            )}
          </div>
        </nav>
      )}
    </header>
  );
}
