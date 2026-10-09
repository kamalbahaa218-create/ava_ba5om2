import { loc, t } from "@/lib/i18n/core";
/* Visual yearly growth tree — purely derived from existing point totals. */
export const TREE_STAGES: { name: string; min: number }[] = [
  { name: "بذرة صغيرة", min: 0 },
  { name: "بذرة في التربة", min: 10 },
  { name: "بذرة تشرب الماء", min: 25 },
  { name: "أول جذر", min: 45 },
  { name: "نبتة صغيرة", min: 70 },
  { name: "نبتة بورقتين", min: 100 },
  { name: "نبتة خضراء", min: 140 },
  { name: "شتلة", min: 190 },
  { name: "شتلة قوية", min: 250 },
  { name: "شجيرة", min: 320 },
  { name: "شجرة صغيرة", min: 400 },
  { name: "شجرة نامية", min: 490 },
  { name: "شجرة مورقة", min: 590 },
  { name: "شجرة ظليلة", min: 700 },
  { name: "براعم الزهر", min: 820 },
  { name: "شجرة مزهرة", min: 950 },
  { name: "إزهار كامل", min: 1100 },
  { name: "أول ثمرة", min: 1270 },
  { name: "شجرة مثمرة", min: 1450 },
  { name: "ثمر كثير", min: 1650 },
  { name: "شجرة عامرة", min: 1870 },
  { name: "شجرة كبيرة", min: 2100 },
  { name: "شجرة راسخة", min: 2350 },
  { name: "شجرة ناضجة عظيمة", min: 2650 },
];

export function stageFor(points: number) {
  let i = 0;
  TREE_STAGES.forEach((s, idx) => {
    if (points >= s.min) i = idx;
  });
  return i;
}

function TreeArt({ stage }: { stage: number }) {
  const p = stage / (TREE_STAGES.length - 1);
  if (stage < 4) {
    return (
      <g>
        <path
          d="M93 168 C87 163 93 155 101 158 C111 158 111 166 103 170 Z"
          className="fill-oxblood stroke-ink"
          strokeWidth="0.7"
        />
        <path d="M95 164 Q100 159 105 161" className="stroke-gold" strokeWidth="1" fill="none" />
        {stage >= 3 && (
          <path
            d="M99 168 Q96 174 100 178 M98 174 L94 177"
            className="stroke-ink"
            fill="none"
            strokeWidth="1"
          />
        )}
        {stage >= 2 && (
          <path
            d="M111 145 Q105 153 111 154 Q117 153 111 145"
            className="fill-leaf-soft stroke-leaf-deep"
            strokeWidth="0.7"
          />
        )}
      </g>
    );
  }
  if (stage < 9) {
    const top = 164 - (stage - 3) * 13;
    return (
      <g>
        <path
          d={`M99 171 Q104 ${top + 28} 100 ${top}`}
          className="stroke-ink"
          strokeWidth={1.4 + p * 2}
          fill="none"
          strokeLinecap="round"
        />
        {Array.from({ length: stage - 2 }, (_, k) => {
          const y = top + k * 10;
          const side = k % 2 ? 1 : -1;
          return (
            <g key={k} transform={`translate(100 ${y}) scale(${side} 1)`}>
              <path
                d="M0 5 Q6 -10 22 -9 Q20 8 0 5"
                className="fill-leaf stroke-ink"
                strokeWidth="0.65"
              />
              <path
                d="M0 5 Q9 0 18 -6"
                className="stroke-leaf-soft"
                fill="none"
                strokeWidth="0.8"
              />
            </g>
          );
        })}
        <path
          d="M100 168 Q95 173 88 173 M101 168 Q107 173 113 173"
          className="stroke-ink"
          fill="none"
          strokeWidth="1.5"
        />
      </g>
    );
  }
  const scale = 0.48 + ((stage - 9) / 14) * 0.52;
  // Overlapping leaf sprays leave natural windows onto the branching structure.
  const clusters = [
    [50, 92, 22],
    [151, 94, 23],
    [31, 77, 20],
    [168, 75, 19],
    [43, 53, 23],
    [153, 51, 22],
    [66, 35, 24],
    [128, 32, 23],
    [98, 23, 25],
    [99, 56, 29],
    [67, 68, 25],
    [130, 71, 25],
    [35, 101, 14],
    [164, 105, 15],
    [82, 88, 21],
    [116, 91, 20],
  ];
  const flowers = stage >= 14 ? Math.min(14, (stage - 13) * 2) : 0;
  const fruits = stage >= 17 ? Math.min(12, (stage - 16) * 2) : 0;
  const accents = Array.from({ length: 16 }, (_, k) => {
    const a = k * 2.39996;
    const r = 52 * Math.sqrt((k + 1) / 16);
    return [100 + Math.cos(a) * r, 66 + Math.sin(a) * r * 0.73];
  });
  return (
    <g transform={`translate(${100 * (1 - scale)} ${170 * (1 - scale)}) scale(${scale})`}>
      <ellipse cx="100" cy="169" rx="43" ry="3" className="fill-ink" opacity="0.12" />
      {clusters.map(([x = 0, y = 0, r = 0], k) => (
        <ellipse
          key={k}
          cx={x}
          cy={y}
          rx={r}
          ry={r * 0.8}
          className={k % 3 === 0 ? "fill-leaf-deep stroke-ink" : "fill-leaf stroke-ink"}
          strokeWidth="1"
        />
      ))}
      <path
        d="M75 170 Q88 162 90 141 L92 121 Q72 106 50 100 L42 91 Q70 100 93 113 L94 97 Q79 88 67 65 L72 67 Q82 84 96 88 L98 55 L103 54 L104 91 Q122 82 138 60 L143 58 Q134 87 106 102 L107 118 Q131 105 155 97 L164 97 Q131 114 109 132 Q111 156 124 164 L136 169 Q120 172 106 164 L101 169 L91 165 Z"
        className="fill-gold stroke-ink"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M95 163 Q101 143 99 118 M102 155 Q106 138 103 106 M94 127 Q80 114 61 107 M107 123 Q128 111 143 106 M99 94 L101 69"
        className="stroke-ink"
        opacity="0.55"
        strokeWidth="1.2"
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M96 160 Q94 144 97 129 M105 157 Q102 146 104 134 M95 109 Q81 99 76 90"
        className="stroke-gold-soft"
        strokeWidth="2.5"
        fill="none"
        strokeLinecap="round"
      />
      <path d="M98 143 Q94 137 98 133 Q102 138 98 143" className="fill-ink" opacity="0.45" />
      {clusters.map(([x = 0, y = 0, r = 0], k) => (
        <g key={k}>
          {Array.from({ length: 22 }, (_, j) => {
            const angle = j * 2.39996 + k * 0.61;
            const radius = r * Math.sqrt((j + 0.5) / 22);
            const lx = x + Math.cos(angle) * radius;
            const ly = y + Math.sin(angle) * radius * 0.75;
            return (
              <g
                key={j}
                transform={`translate(${lx} ${ly}) rotate(${(angle * 180) / Math.PI + 30})`}
              >
                <path
                  d="M-5 0 Q-2 -5 4 -2 L7 0 Q2 5 -5 0"
                  className={j % 4 === 0 ? "fill-leaf-soft" : "fill-leaf"}
                  stroke="currentColor"
                  strokeWidth="0.45"
                  opacity={j % 4 === 0 ? 0.9 : 1}
                />
                <path d="M-4 0 L4 0" className="stroke-ink" opacity="0.18" strokeWidth="0.4" />
              </g>
            );
          })}
        </g>
      ))}
      {accents.slice(0, flowers).map(([x = 0, y = 0], k) => (
        <g key={`flower-${k}`} transform={`translate(${x} ${y})`}>
          {[0, 72, 144, 216, 288].map((a) => (
            <ellipse
              key={a}
              cx="0"
              cy="-2"
              rx="1.5"
              ry="2"
              transform={`rotate(${a})`}
              className="fill-paper"
            />
          ))}
          <circle r="1" className="fill-gold stroke-oxblood" strokeWidth="0.4" />
        </g>
      ))}
      {accents.slice(16 - fruits).map(([x = 0, y = 0], k) => (
        <g key={`fruit-${k}`} transform={`translate(${x + 3} ${y + 4})`}>
          <path d="M0 -2 L1 -6" className="stroke-ink" strokeWidth="0.7" />
          <path d="M0 -2 C-6 -5 -6 4 -2 5 Q0 4 2 5 C6 3 5 -5 0 -2" className="fill-oxblood" />
          <path
            d="M-2 -1 Q-4 1 -2 3"
            className="stroke-paper"
            strokeWidth="0.6"
            opacity="0.55"
            fill="none"
          />
        </g>
      ))}
    </g>
  );
}

export function GrowthTree({ yearPoints }: { yearPoints: number }) {
  const i = stageFor(yearPoints);
  const cur = TREE_STAGES[i]!;
  const next = TREE_STAGES[i + 1];
  const pct = next ? ((yearPoints - cur.min) / (next.min - cur.min)) * 100 : 100;
  return (
    <div className="mt-4 grid items-center gap-4 rounded-3xl bg-panel p-5 ring-1 ring-black/5 sm:grid-cols-[200px_1fr]">
      <svg
        viewBox="0 0 200 180"
        className="mx-auto h-44 w-full max-w-[220px]"
        aria-label={cur.name}
      >
        <rect x="0" y="170" width="200" height="10" rx="5" className="fill-line" />
        <TreeArt stage={i} />
      </svg>
      <div>
        <p className="text-xs font-bold text-oxblood">
          شجرتي هذا العام · المرحلة {(i + 1).toLocaleString(loc())} من{" "}
          {TREE_STAGES.length.toLocaleString(loc())}
        </p>
        <p className="mt-1 font-display text-2xl font-black">{cur.name}</p>
        <p className="mt-1 text-sm text-ink-soft">
          نقاط هذا العام: {yearPoints.toLocaleString(loc())}
        </p>
        <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-ink/10">
          <div
            className="h-full rounded-full bg-oxblood transition-all"
            style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
          />
        </div>
        <p className="mt-2 text-xs text-ink-soft">
          {next
            ? t("باقي {0} نقطة للوصول إلى «{1}»", [(next.min - yearPoints).toLocaleString(loc()), t(next.name)])
            : "وصلت إلى أعلى مرحلة — شجرة ناضجة عظيمة!"}
        </p>
        <div className="mt-3 flex flex-wrap gap-1">
          {TREE_STAGES.map((s, k) => (
            <span
              key={s.name}
              title={s.name}
              className={`size-2.5 rounded-full ${k <= i ? "bg-gold" : "bg-ink/10"}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
