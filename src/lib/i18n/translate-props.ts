import { getLang, t } from "./core";

const ATTRS = ["placeholder", "title", "aria-label", "alt"] as const;

/** Translates text children and user-facing attributes before React sees them. */
export function translateProps<P>(props: P): P {
  if (getLang() === "ar" || !props || typeof props !== "object") return props;
  const p = props as Record<string, unknown>;
  let copy: Record<string, unknown> | null = null;
  const set = (k: string, v: unknown) => {
    if (v === p[k]) return;
    copy ??= { ...p };
    copy[k] = v;
  };
  const c = p["children"];
  if (typeof c === "string") set("children", t(c));
  else if (Array.isArray(c) && c.some((x) => typeof x === "string"))
    set(
      "children",
      c.map((x) => (typeof x === "string" ? t(x) : x)),
    );
  for (const a of ATTRS) if (typeof p[a] === "string") set(a, t(p[a]));
  return (copy ?? p) as P;
}
