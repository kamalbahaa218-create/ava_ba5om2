import { loc } from "@/lib/i18n/core";
import { useEffect, useState } from "react";
import jesusImage from "@/assets/attendance-jesus.png";
import studentImage from "@/assets/attendance-student.png";

/** Only mounted after record_attendance confirms a successful write. */
export function AttendanceWelcome({ text, points }: { text: string; points?: number | undefined }) {
  const [loaded, setLoaded] = useState({ jesus: false, student: false });
  const [done, setDone] = useState(false);
  const ready = loaded.jesus && loaded.student;
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (media.matches) setDone(true);
    const reduce = () => {
      if (media.matches) setDone(true);
    };
    media.addEventListener("change", reduce);
    return () => media.removeEventListener("change", reduce);
  }, []);
  useEffect(() => {
    const timer = setTimeout(() => setDone(true), ready ? 4400 : 6000);
    return () => clearTimeout(timer);
  }, [ready]);

  return (
    <div className="attendance-welcome" role="status" aria-live="polite">
      {!done ? (
        <>
          <div
            className={`attendance-scene ${ready ? "attendance-playing" : ""}`}
            role="img"
            aria-label="بابا يسوع يفتح الباب ويرحب بالمخدوم، ثم يدخل المخدوم"
          >
            <svg viewBox="0 0 360 280" className="attendance-doorway" aria-hidden="true">
              <path
                d="M72 252V99a73 73 0 0 1 146 0v153Z"
                className="fill-gold-soft stroke-gold"
                strokeWidth="6"
              />
              <path d="M87 252V101a58 58 0 0 1 116 0v151Z" className="fill-paper" />
              <path d="M44 252h224" className="stroke-gold" strokeWidth="3" />
              <g className="attendance-door">
                <path
                  d="M87 251V101a58 58 0 0 1 116 0v150Z"
                  className="fill-oxblood stroke-gold"
                  strokeWidth="3"
                />
                <path
                  d="M103 225V104a42 42 0 0 1 84 0v121Z"
                  className="fill-none stroke-gold-soft"
                  strokeWidth="2"
                />
                <circle cx="181" cy="172" r="4" className="fill-gold-soft" />
              </g>
            </svg>
            <img
              className="attendance-jesus"
              src={jesusImage}
              alt=""
              width={768}
              height={1024}
              onLoad={() => setLoaded((state) => ({ ...state, jesus: true }))}
              onError={() => setDone(true)}
            />
            <img
              className="attendance-inviting-hand"
              src={jesusImage}
              alt=""
              aria-hidden="true"
              width={768}
              height={1024}
            />
            <img
              className="attendance-student"
              src={studentImage}
              alt=""
              width={768}
              height={1024}
              onLoad={() => setLoaded((state) => ({ ...state, student: true }))}
              onError={() => setDone(true)}
            />
          </div>
          <p className="mt-3 font-display text-xl font-bold text-oxblood">أهلًا بك يا حبيبي</p>
        </>
      ) : (
        <>
          <span
            className="mx-auto grid size-20 place-items-center rounded-full bg-oxblood font-display text-4xl font-black text-gold-soft"
            aria-hidden="true"
          >
            ✓
          </span>
          <h1 className="mt-5 font-display text-2xl font-black">{text}</h1>
          {!!points && (
            <p className="mt-2 text-sm font-bold text-oxblood">
              +{points.toLocaleString(loc())} نقطة
            </p>
          )}
        </>
      )}
    </div>
  );
}
