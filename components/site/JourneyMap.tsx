import { loc, t } from "@/lib/i18n/core";
import { useEffect, useState } from "react";
import type { ProgramHour } from "@/lib/content";
import { journeyStates } from "@/lib/activity";

/* Visual journey map: program items become checkpoints on a winding path,
   with a small walker that moves to the current item (by time) or loops. */
export function JourneyMap({ hour, tone }: { hour: ProgramHour; tone: "paper" | "oxblood" }) {
  const items = hour.items;
  const n = items.length;
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const states = now ? journeyStates(items, now) : items.map(() => "pending" as const);
  const step = states.indexOf("active");
  if (!n) return null;
  const dark = tone === "oxblood";
  const W = 100;
  // RTL: start on the right
  const pts = items.map((_, i) => {
    const x = n === 1 ? 50 : 92 - (i * 84) / (n - 1);
    const y = i % 2 === 0 ? 30 : 70;
    return { x, y };
  });
  const d = pts
    .map((p, i) => {
      if (i === 0) return `M${p.x} ${p.y}`;
      const q = pts[i - 1];
      if (!q) return "";
      const mx = (q.x + p.x) / 2;
      return `C${mx} ${q.y} ${mx} ${p.y} ${p.x} ${p.y}`;
    })
    .join(" ");
  const cur = pts[step];
  return (
    <div
      className={
        "mt-4 rounded-3xl p-4 ring-1 ring-black/5 " +
        (dark ? "bg-oxblood/90 text-paper" : "bg-panel")
      }
    >
      <p className={"mb-2 text-xs font-bold " + (dark ? "text-gold-soft" : "text-oxblood")}>
        {t("رحلة {0}", [t(hour.title)])}
      </p>
      <div className="relative w-full" style={{ aspectRatio: "100 / 34" }}>
        <svg
          viewBox={`0 0 ${W} 100`}
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
        >
          <path
            d={d}
            fill="none"
            strokeWidth="2.2"
            strokeDasharray="4 3"
            vectorEffect="non-scaling-stroke"
            className={dark ? "stroke-gold-soft" : "stroke-gold"}
            style={{ strokeWidth: 3 }}
          />
        </svg>
        {pts.map((p, i) => (
          <div
            key={(items[i]?.title ?? "") + i}
            className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
            style={{ left: `${p.x}%`, top: `${p.y}%` }}
          >
            <span
              className={
                "grid size-6 place-items-center rounded-full text-[10px] font-black ring-2 transition-colors sm:size-7 " +
                (states[i] !== "pending"
                  ? "bg-gold text-ink ring-gold-soft"
                  : dark
                    ? "bg-oxblood text-paper ring-paper/40"
                    : "bg-paper text-ink-soft ring-line")
              }
            >
              <span
                aria-label={
                  states[i] === "active"
                    ? "الفقرة الحالية"
                    : states[i] === "completed"
                      ? "مكتملة"
                      : "لم تبدأ بعد"
                }
                aria-current={states[i] === "active" ? "step" : undefined}
              >
                {(i + 1).toLocaleString(loc())}
              </span>
            </span>
            <span
              className={
                "absolute w-20 text-center text-[10px] font-semibold leading-tight sm:w-24 sm:text-xs " +
                (p.y < 50 ? "top-full mt-1" : "bottom-full mb-1")
              }
            >
              {items[i]?.title}
            </span>
          </div>
        ))}
        {cur && (
          <div
            className="pointer-events-none absolute -translate-x-1/2 transition-all duration-1000 ease-in-out motion-reduce:transition-none"
            style={{ left: `${cur.x}%`, top: `calc(${cur.y}% - 26px)` }}
            aria-hidden
          >
            <svg
              viewBox="0 0 20 24"
              className="h-5 w-5 animate-bounce motion-reduce:animate-none sm:h-6 sm:w-6"
            >
              <circle cx="10" cy="5" r="4" className="fill-oxblood stroke-paper" strokeWidth="1" />
              <path d="M4 22 L10 10 L16 22 Z" className="fill-gold stroke-ink" strokeWidth="1" />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}
