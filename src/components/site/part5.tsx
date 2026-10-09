import { loc, t } from "@/lib/i18n/core";
import { useEffect, useState } from "react";
import { HistoryList } from "./HistoryList";
import { readFullHistory } from "@/lib/activity";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { btn, card, fmtDateTime, inputCls } from "@/components/site/part3";
import { Empty, Failed, Skeleton } from "@/components/site/live";
import { ConfirmDelete } from "@/components/site/ConfirmDelete";
import { CONTENT_TYPE, VISIBILITY_LABEL, useContentItems } from "@/lib/content";
import type { Database } from "@/integrations/supabase/types";

type SugStatus = Database["public"]["Enums"]["suggestion_status"];
export const SUG_LABEL: Record<SugStatus, string> = {
  NEW: "جديد",
  SEEN: "تم الاطلاع",
  IN_PROGRESS: "قيد التنفيذ",
  DONE: "تم التنفيذ",
  REJECTED: "غير مناسب",
};
const ok = (): void => void toast.success(t("تم الحفظ بنجاح"));
const fail = (): void => void toast.error(t("حدث خطأ، حاول مرة أخرى"));
const toLocalInput = (d: Date) =>
  new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

/* ===================== QUIZZES (managers) ===================== */
type DraftQ = { kind: "MCQ" | "TF"; prompt: string; options: string[]; correct: number };
const TF = ["صح", "خطأ"];

export function QuizManager({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const quizzes = useQuery({
    queryKey: ["quizzes-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quizzes")
        .select("*, classes(name), quiz_questions(id), quiz_attempts(id)")
        .order("start_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  const del = async (id: string) => {
    const { error } = await supabase.from("quizzes").delete().eq("id", id);
    if (error) return fail();
    toast.success(t("تم حذف البيانات بنجاح"));
    qc.invalidateQueries({ queryKey: ["quizzes-admin"] });
  };

  if (editing)
    return (
      <QuizEditor
        id={editing === "new" ? null : editing}
        userId={userId}
        onDone={() => {
          setEditing(null);
          qc.invalidateQueries({ queryKey: ["quizzes-admin"] });
        }}
      />
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-black">المسابقات</h2>
        <button className={btn} onClick={() => setEditing("new")}>
          + مسابقة جديدة
        </button>
      </div>
      {quizzes.isLoading ? (
        <Skeleton />
      ) : quizzes.isError ? (
        <Failed />
      ) : !quizzes.data?.length ? (
        <Empty />
      ) : (
        quizzes.data.map((q) => (
          <div key={q.id} className={card}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-display text-lg font-black">{q.title}</p>
                <p className="mt-1 text-xs text-ink-soft">
                  {fmtDateTime(q.start_at)} ← {fmtDateTime(q.end_at)} · {q.quiz_questions.length}{" "}
                  سؤال · {q.points_per_question} نقطة/سؤال · {q.max_attempts} محاولة ·{" "}
                  {q.classes?.name ?? "كل الخدمة"}
                </p>
                <p className="mt-1 text-xs">
                  <span className={q.is_published ? "text-oxblood font-bold" : "text-ink-soft"}>
                    {q.is_published ? "منشورة" : "مسودة"}
                  </span>{" "}
                  · {q.quiz_attempts.length} محاولة مسجلة
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  className="rounded-2xl bg-ink/5 px-3 py-2 text-sm font-semibold"
                  onClick={() => setEditing(q.id)}
                >
                  تعديل
                </button>
                <ConfirmDelete onConfirm={() => del(q.id)} />
              </div>
            </div>
            <QuizResults quizId={q.id} />
          </div>
        ))
      )}
    </div>
  );
}

function QuizResults({ quizId }: { quizId: string }) {
  const [open, setOpen] = useState(false);
  const r = useQuery({
    queryKey: ["quiz-results", quizId],
    enabled: open,
    queryFn: async () => {
      return readFullHistory((from, to) =>
        supabase
          .from("quiz_attempts")
          .select("id, score, total, points_awarded, submitted_at, profiles(full_name)")
          .eq("quiz_id", quizId)
          .order("submitted_at", { ascending: false })
          .order("id", { ascending: false })
          .range(from, to),
      );
    },
  });
  return (
    <div className="mt-3">
      <button className="text-sm font-semibold text-oxblood" onClick={() => setOpen(!open)}>
        {open ? "إخفاء النتائج" : "عرض النتائج"}
      </button>
      {open && (
        <div className="mt-2 space-y-1 text-sm">
          {r.data?.length ? (
            <HistoryList
              list
              rows={r.data}
              render={(a) => (
                <li key={a.id} className="flex justify-between rounded-xl bg-paper px-3 py-2">
                  <span>{a.profiles?.full_name}</span>
                  <span className="text-ink-soft">
                    {a.score}/{a.total} · +{a.points_awarded} · {fmtDateTime(a.submitted_at)}
                  </span>
                </li>
              )}
            />
          ) : (
            <p className="text-ink-soft">لا توجد محاولات بعد.</p>
          )}
        </div>
      )}
    </div>
  );
}

function QuizEditor({
  id,
  userId,
  onDone,
}: {
  id: string | null;
  userId: string;
  onDone: () => void;
}) {
  const now = new Date();
  const [loaded, setLoaded] = useState(id === null);
  const [f, setF] = useState({
    title: "",
    description: "",
    class_id: "",
    points_per_question: 1,
    start_at: toLocalInput(now),
    end_at: toLocalInput(new Date(now.getTime() + 7 * 864e5)),
    max_attempts: 1,
    is_published: false,
  });
  const [qs, setQs] = useState<DraftQ[]>([]);
  const [saving, setSaving] = useState(false);
  const classes = useQuery({
    queryKey: ["classes-min"],
    queryFn: async () =>
      (await supabase.from("classes").select("id, name").order("name")).data ?? [],
  });

  useQuery({
    queryKey: ["quiz-edit", id],
    enabled: !!id && !loaded,
    queryFn: async () => {
      const { data: q } = await supabase.from("quizzes").select("*").eq("id", id!).single();
      const { data: qq } = await supabase
        .from("quiz_questions")
        .select("*, quiz_answer_keys(correct_index)")
        .eq("quiz_id", id!)
        .order("position");
      if (q) {
        setF({
          title: q.title,
          description: q.description ?? "",
          class_id: q.class_id ?? "",
          points_per_question: q.points_per_question,
          start_at: toLocalInput(new Date(q.start_at)),
          end_at: toLocalInput(new Date(q.end_at)),
          max_attempts: q.max_attempts,
          is_published: q.is_published,
        });
      }
      setQs(
        (qq ?? []).map((x) => ({
          kind: x.kind as "MCQ" | "TF",
          prompt: x.prompt,
          options: (x.options as string[]) ?? [],
          correct: (x.quiz_answer_keys as { correct_index: number } | null)?.correct_index ?? 0,
        })),
      );
      setLoaded(true);
      return true;
    },
  });

  const upd = (i: number, p: Partial<DraftQ>) =>
    setQs((s) => s.map((q, j) => (j === i ? { ...q, ...p } : q)));

  const save = async () => {
    if (!f.title.trim()) return void toast.error(t("اكتب عنوان المسابقة"));
    if (new Date(f.end_at) <= new Date(f.start_at))
      return void toast.error(t("وقت النهاية يجب أن يكون بعد البداية"));
    for (const q of qs) {
      const opts = q.kind === "TF" ? TF : q.options.filter((o) => o.trim());
      if (!q.prompt.trim() || opts.length < 2 || q.correct >= opts.length)
        return void toast.error(t("أكمل كل الأسئلة (سؤال + اختياران على الأقل + الإجابة الصحيحة)"));
    }
    setSaving(true);
    const row = {
      title: f.title.trim(),
      description: f.description.trim() || null,
      class_id: f.class_id || null,
      points_per_question: Number(f.points_per_question) || 0,
      start_at: new Date(f.start_at).toISOString(),
      end_at: new Date(f.end_at).toISOString(),
      max_attempts: Number(f.max_attempts) || 1,
      is_published: f.is_published,
    };
    let quizId = id;
    if (id) {
      const { error } = await supabase.from("quizzes").update(row).eq("id", id);
      if (error) return void (setSaving(false), fail());
      await supabase.from("quiz_questions").delete().eq("quiz_id", id);
    } else {
      const { data, error } = await supabase
        .from("quizzes")
        .insert({ ...row, created_by: userId })
        .select("id")
        .single();
      if (error || !data) return void (setSaving(false), fail());
      quizId = data.id;
    }
    for (const [i, q] of qs.entries()) {
      const opts = q.kind === "TF" ? TF : q.options.map((o) => o.trim()).filter(Boolean);
      const { data, error } = await supabase
        .from("quiz_questions")
        .insert({
          quiz_id: quizId!,
          position: i,
          kind: q.kind,
          prompt: q.prompt.trim(),
          options: opts,
        })
        .select("id")
        .single();
      if (error || !data) return void (setSaving(false), fail());
      await supabase
        .from("quiz_answer_keys")
        .insert({ question_id: data.id, correct_index: q.correct });
    }
    setSaving(false);
    ok();
    onDone();
  };

  if (!loaded) return <Skeleton />;
  return (
    <div className={`${card} space-y-4`}>
      <h2 className="font-display text-xl font-black">{id ? "تعديل مسابقة" : "مسابقة جديدة"}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm sm:col-span-2">
          العنوان
          <input
            className={inputCls}
            value={f.title}
            onChange={(e) => setF({ ...f, title: e.target.value })}
          />
        </label>
        <label className="text-sm sm:col-span-2">
          وصف مختصر
          <textarea
            className={inputCls}
            value={f.description}
            onChange={(e) => setF({ ...f, description: e.target.value })}
          />
        </label>
        <label className="text-sm">
          البداية
          <input
            type="datetime-local"
            className={inputCls}
            value={f.start_at}
            onChange={(e) => setF({ ...f, start_at: e.target.value })}
          />
        </label>
        <label className="text-sm">
          النهاية
          <input
            type="datetime-local"
            className={inputCls}
            value={f.end_at}
            onChange={(e) => setF({ ...f, end_at: e.target.value })}
          />
        </label>
        <label className="text-sm">
          نقاط لكل إجابة صحيحة
          <input
            type="number"
            min={0}
            className={inputCls}
            value={f.points_per_question}
            onChange={(e) => setF({ ...f, points_per_question: Number(e.target.value) })}
          />
        </label>
        <label className="text-sm">
          عدد المحاولات المسموح
          <input
            type="number"
            min={1}
            max={20}
            className={inputCls}
            value={f.max_attempts}
            onChange={(e) => setF({ ...f, max_attempts: Number(e.target.value) })}
          />
        </label>
        <label className="text-sm">
          الفصل
          <select
            className={inputCls}
            value={f.class_id}
            onChange={(e) => setF({ ...f, class_id: e.target.value })}
          >
            <option value="">كل الخدمة</option>
            {classes.data?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={f.is_published}
            onChange={(e) => setF({ ...f, is_published: e.target.checked })}
          />
          منشورة للمخدومين
        </label>
      </div>

      <div className="space-y-3">
        {qs.map((q, i) => (
          <div key={i} className="rounded-2xl bg-paper p-4 ring-1 ring-black/5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold">سؤال {i + 1}</span>
              <select
                className="rounded-xl border border-input bg-panel px-2 py-1 text-sm"
                value={q.kind}
                onChange={(e) => upd(i, { kind: e.target.value as "MCQ" | "TF", correct: 0 })}
              >
                <option value="MCQ">اختيار من متعدد</option>
                <option value="TF">صح / خطأ</option>
              </select>
              <button
                className="ms-auto text-sm text-oxblood"
                onClick={() => setQs(qs.filter((_, j) => j !== i))}
              >
                حذف
              </button>
            </div>
            <input
              className={`${inputCls} mt-2`}
              placeholder="نص السؤال"
              value={q.prompt}
              onChange={(e) => upd(i, { prompt: e.target.value })}
            />
            <div className="mt-2 space-y-2">
              {(q.kind === "TF" ? TF : q.options).map((o, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`c${i}`}
                    checked={q.correct === oi}
                    onChange={() => upd(i, { correct: oi })}
                    aria-label="الإجابة الصحيحة"
                  />
                  {q.kind === "TF" ? (
                    <span className="text-sm">{o}</span>
                  ) : (
                    <input
                      className={inputCls}
                      value={o}
                      placeholder={t("اختيار {0}", [oi + 1])}
                      onChange={(e) =>
                        upd(i, {
                          options: q.options.map((x, k) => (k === oi ? e.target.value : x)),
                        })
                      }
                    />
                  )}
                </div>
              ))}
              {q.kind === "MCQ" && q.options.length < 6 && (
                <button
                  className="text-sm font-semibold text-oxblood"
                  onClick={() => upd(i, { options: [...q.options, ""] })}
                >
                  + اختيار
                </button>
              )}
              <p className="text-xs text-ink-soft">اختر الدائرة بجوار الإجابة الصحيحة.</p>
            </div>
          </div>
        ))}
        <button
          className="rounded-2xl bg-ink/5 px-4 py-2 text-sm font-semibold"
          onClick={() => setQs([...qs, { kind: "MCQ", prompt: "", options: ["", ""], correct: 0 }])}
        >
          + إضافة سؤال
        </button>
      </div>
      <div className="flex gap-2">
        <button className={btn} disabled={saving} onClick={save}>
          {saving ? "جارٍ الحفظ..." : "حفظ"}
        </button>
        <button className="rounded-2xl bg-ink/5 px-4 py-2 text-sm font-semibold" onClick={onDone}>
          إلغاء
        </button>
      </div>
    </div>
  );
}

/* ===================== QUIZZES (students) ===================== */
export function StudentQuizzes({ userId }: { userId: string }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const [active, setActive] = useState<string | null>(null);
  const q = useQuery({
    queryKey: ["my-quizzes", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quizzes")
        .select("id, title, description, start_at, end_at, max_attempts, points_per_question")
        .order("start_at", { ascending: false });
      if (error) throw error;
      const { data: att } = await supabase
        .from("quiz_attempts")
        .select("quiz_id, score, total")
        .eq("student_id", userId);
      return (data ?? []).map((z) => ({
        ...z,
        attempts: (att ?? []).filter((a) => a.quiz_id === z.id),
      }));
    },
  });
  if (q.isLoading) return <Skeleton />;
  if (q.isError) return <Failed />;
  if (!q.data?.length) return <Empty text="لا توجد مسابقات حاليًا" />;
  return (
    <div className="space-y-3">
      {q.data.map((z) => {
        const open = now >= +new Date(z.start_at) && now <= +new Date(z.end_at);
        const left = z.max_attempts - z.attempts.length;
        const best = z.attempts.reduce((m, a) => Math.max(m, a.score), -1);
        return (
          <div key={z.id} className={card}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-display text-lg font-black">{z.title}</p>
                {z.description && <p className="mt-1 text-sm text-ink-soft">{z.description}</p>}
                <p className="mt-1 text-xs text-ink-soft">
                  {fmtDateTime(z.start_at)} ← {fmtDateTime(z.end_at)} · المحاولات المتبقية:{" "}
                  {Math.max(0, left)}
                  {best >= 0 && t(" · أفضل نتيجة: {0}/{1}", [best, z.attempts[0]?.total ?? 0])}
                </p>
              </div>
              {open && left > 0 ? (
                <button className={btn} onClick={() => setActive(active === z.id ? null : z.id)}>
                  {active === z.id ? "إغلاق" : "ابدأ"}
                </button>
              ) : (
                <span className="rounded-full bg-ink/5 px-3 py-1 text-xs font-semibold text-ink-soft">
                  {!open
                    ? now < +new Date(z.start_at)
                      ? "لم تبدأ بعد"
                      : "انتهت"
                    : "استنفدت المحاولات"}
                </span>
              )}
            </div>
            {active === z.id && (
              <TakeQuiz
                quizId={z.id}
                onDone={() => {
                  setActive(null);
                  q.refetch();
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function TakeQuiz({ quizId, onDone }: { quizId: string; onDone: () => void }) {
  const qc = useQueryClient();
  const [ans, setAns] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const qs = useQuery({
    queryKey: ["quiz-qs", quizId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_quiz_questions", { _quiz: quizId });
      if (error) throw error;
      return data ?? [];
    },
  });
  const submit = async () => {
    setBusy(true);
    const { data, error } = await supabase.rpc("submit_quiz", { _quiz: quizId, _answers: ans });
    setBusy(false);
    const r = data as {
      ok: boolean;
      code?: string;
      score?: number;
      total?: number;
      points?: number;
    } | null;
    if (error || !r) return fail();
    if (!r.ok)
      return void toast.error(
        t(r.code === "attempts" ? "استنفدت عدد المحاولات" : "المسابقة غير متاحة حاليًا"),
      );
    toast.success(t("نتيجتك {0}/{1}", [r.score, r.total]) + (r.points ? t(" — +{0} نقطة", [r.points]) : ""));
    qc.invalidateQueries();
    onDone();
  };
  if (qs.isLoading) return <Skeleton />;
  if (!qs.data?.length) return <p className="mt-3 text-sm text-ink-soft">لا توجد أسئلة متاحة.</p>;
  return (
    <div className="mt-4 space-y-3">
      {qs.data.map((x, i) => (
        <fieldset key={x.id} className="rounded-2xl bg-paper p-4">
          <legend className="font-bold">
            {i + 1}. {x.prompt}
          </legend>
          <div className="mt-2 space-y-1.5">
            {((x.options as string[]) ?? []).map((o, oi) => (
              <label key={oi} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name={x.id}
                  checked={ans[x.id] === oi}
                  onChange={() => setAns({ ...ans, [x.id]: oi })}
                />
                {o}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <button
        className={btn}
        disabled={busy || Object.keys(ans).length < qs.data.length}
        onClick={submit}
      >
        {busy ? "جارٍ الإرسال..." : "إرسال الإجابات"}
      </button>
    </div>
  );
}

/* ===================== SUGGESTIONS ===================== */
export function StudentSuggestions({ userId }: { userId: string }) {
  const [f, setF] = useState({ title: "", content: "", anon: false });
  const [busy, setBusy] = useState(false);
  const q = useQuery({
    queryKey: ["my-suggestions", userId],
    queryFn: async () => {
      return readFullHistory((from, to) =>
        supabase
          .from("suggestions")
          .select("*")
          .eq("student_id", userId)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(from, to),
      );
    },
  });
  const send = async () => {
    const title = f.title.trim();
    const content = f.content.trim();
    if (!title || !content) return void toast.error(t("اكتب العنوان ونص الاقتراح"));
    if (title.length > 200 || content.length > 4000) return void toast.error(t("النص طويل جدًا"));
    setBusy(true);
    const { error } = await supabase
      .from("suggestions")
      .insert({ student_id: userId, title, content, is_anonymous: f.anon });
    setBusy(false);
    if (error) return fail();
    toast.success(t("تم إرسال اقتراحك"));
    setF({ title: "", content: "", anon: false });
    q.refetch();
  };
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className={`${card} space-y-3`}>
        <input
          className={inputCls}
          maxLength={200}
          placeholder="عنوان الاقتراح"
          value={f.title}
          onChange={(e) => setF({ ...f, title: e.target.value })}
        />
        <textarea
          className={`${inputCls} min-h-28`}
          maxLength={4000}
          placeholder="اكتب اقتراحك..."
          value={f.content}
          onChange={(e) => setF({ ...f, content: e.target.value })}
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={f.anon}
            onChange={(e) => setF({ ...f, anon: e.target.checked })}
          />
          إرسال بدون اسم
        </label>
        <button className={btn} disabled={busy} onClick={send}>
          إرسال
        </button>
      </div>
      <div className="space-y-2">
        {q.data?.length ? (
          <HistoryList
            rows={q.data}
            render={(s) => (
              <div key={s.id} className={card}>
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold">{s.title}</p>
                  <span className="shrink-0 rounded-full bg-gold-soft px-3 py-1 text-xs font-bold text-ink">
                    {SUG_LABEL[s.status]}
                  </span>
                </div>
                <p className="mt-1 whitespace-pre-line text-sm text-ink-soft">{s.content}</p>
                <p className="mt-2 text-xs text-ink-soft">
                  {fmtDateTime(s.created_at)}
                  {s.is_anonymous && " · بدون اسم"}
                </p>
              </div>
            )}
          />
        ) : (
          <Empty text="لم ترسل اقتراحات بعد" />
        )}
      </div>
    </div>
  );
}

export function SuggestionsManager() {
  const [filter, setFilter] = useState<SugStatus | "">("");
  const q = useQuery({
    queryKey: ["suggestions-all"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_suggestions");
      if (error) throw error;
      return data ?? [];
    },
  });
  const setStatus = async (id: string, s: SugStatus) => {
    const { data, error } = await supabase.rpc("set_suggestion_status", { _id: id, _status: s });
    if (error || !data) return fail();
    ok();
    q.refetch();
  };
  const del = async (id: string) => {
    const { data, error } = await supabase.rpc("delete_suggestion", { _id: id });
    if (error || !data) return fail();
    toast.success(t("تم حذف البيانات بنجاح"));
    q.refetch();
  };
  const rows = (q.data ?? []).filter((s) => !filter || s.status === filter);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-xl font-black">الاقتراحات</h2>
        <select
          className="rounded-2xl border border-input bg-paper px-3 py-2 text-sm"
          value={filter}
          onChange={(e) => setFilter(e.target.value as SugStatus | "")}
        >
          <option value="">كل الحالات</option>
          {Object.entries(SUG_LABEL).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      {q.isLoading ? (
        <Skeleton />
      ) : q.isError ? (
        <Failed />
      ) : !rows.length ? (
        <Empty />
      ) : (
        rows.map((s) => (
          <div key={s.id} className={card}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-bold">{s.title}</p>
                <p className="text-xs text-ink-soft">
                  {s.is_anonymous ? "بدون اسم" : s.author_name} · {fmtDateTime(s.created_at)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  className="rounded-xl border border-input bg-paper px-2 py-1.5 text-sm"
                  value={s.status}
                  onChange={(e) => setStatus(s.id, e.target.value as SugStatus)}
                >
                  {Object.entries(SUG_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
                <ConfirmDelete onConfirm={() => del(s.id)} />
              </div>
            </div>
            <p className="mt-2 whitespace-pre-line text-sm">{s.content}</p>
          </div>
        ))
      )}
    </div>
  );
}

/* ===================== PRIVATE STUDENT DATA ===================== */
export function PrivateDataPanel({ userId, isAdmin }: { userId: string; isAdmin: boolean }) {
  const [sel, setSel] = useState("");
  const [search, setSearch] = useState("");
  const students = useQuery({
    queryKey: ["private-students", userId, isAdmin],
    queryFn: async () => {
      if (isAdmin) {
        const { data } = await supabase
          .from("profiles")
          .select("id, full_name")
          .eq("user_type", "STUDENT")
          .order("full_name");
        return data ?? [];
      }
      const { data: cs } = await supabase
        .from("class_servants")
        .select("class_id")
        .eq("servant_id", userId);
      const ids = (cs ?? []).map((c) => c.class_id);
      if (!ids.length) return [];
      const { data } = await supabase
        .from("class_members")
        .select("student_id, profiles(id, full_name)")
        .in("class_id", ids);
      const m = new Map<string, string>();
      (data ?? []).forEach((r) => r.profiles && m.set(r.profiles.id, r.profiles.full_name));
      return [...m]
        .map(([id, full_name]) => ({ id, full_name }))
        .sort((a, b) => a.full_name.localeCompare(b.full_name, "ar"));
    },
  });
  const list = (students.data ?? []).filter((s) => s.full_name.includes(search.trim()));
  return (
    <div className="grid gap-4 lg:grid-cols-12">
      <div className={`${card} lg:col-span-4`}>
        <input
          className={inputCls}
          placeholder="بحث بالاسم"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <ul className="mt-3 max-h-96 space-y-1 overflow-y-auto">
          {students.isLoading ? (
            <Skeleton h="h-20" />
          ) : list.length ? (
            list.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => setSel(s.id)}
                  className={`w-full rounded-xl px-3 py-2 text-start text-sm ${sel === s.id ? "bg-ink text-paper" : "hover:bg-ink/5"}`}
                >
                  {s.full_name || "—"}
                </button>
              </li>
            ))
          ) : (
            <li className="text-sm text-ink-soft">لا يوجد مخدومون في فصولك.</li>
          )}
        </ul>
      </div>
      <div className="lg:col-span-8">
        {sel ? (
          <PrivateDataForm key={sel} studentId={sel} userId={userId} />
        ) : (
          <Empty text="اختر مخدومًا لعرض بياناته الخاصة" />
        )}
      </div>
    </div>
  );
}

export function PrivateDataForm({ studentId, userId }: { studentId: string; userId: string }) {
  const [f, setF] = useState<{
    guardian_phone: string;
    address: string;
    private_notes: string;
  } | null>(null);
  const [busy, setBusy] = useState(false);
  const q = useQuery({
    queryKey: ["student-private", studentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("student_private")
        .select("*")
        .eq("student_id", studentId)
        .maybeSingle();
      if (error) throw error;
      setF({
        guardian_phone: data?.guardian_phone ?? "",
        address: data?.address ?? "",
        private_notes: data?.private_notes ?? "",
      });
      return data;
    },
  });
  if (q.isLoading || !f) return <Skeleton />;
  if (q.isError) return <Failed />;
  const save = async () => {
    if (f.guardian_phone.length > 30 || f.address.length > 500 || f.private_notes.length > 5000)
      return void toast.error(t("النص طويل جدًا"));
    setBusy(true);
    const { error } = await supabase.from("student_private").upsert({
      student_id: studentId,
      guardian_phone: f.guardian_phone.trim() || null,
      address: f.address.trim() || null,
      private_notes: f.private_notes.trim() || null,
      updated_by: userId,
    });
    setBusy(false);
    if (error) return fail();
    ok();
  };
  return (
    <div className={`${card} space-y-3`}>
      <p className="text-xs font-bold text-oxblood">بيانات خاصة — لا يراها المخدوم</p>
      <label className="block text-sm">
        رقم ولي الأمر
        <input
          dir="ltr"
          className={inputCls}
          value={f.guardian_phone}
          onChange={(e) => setF({ ...f, guardian_phone: e.target.value })}
        />
      </label>
      <label className="block text-sm">
        العنوان
        <input
          className={inputCls}
          value={f.address}
          onChange={(e) => setF({ ...f, address: e.target.value })}
        />
      </label>
      <label className="block text-sm">
        ملاحظات الافتقاد الخاصة
        <textarea
          className={`${inputCls} min-h-32`}
          value={f.private_notes}
          onChange={(e) => setF({ ...f, private_notes: e.target.value })}
        />
      </label>
      {q.data?.updated_at && (
        <p className="text-xs text-ink-soft">آخر تحديث: {fmtDateTime(q.data.updated_at)}</p>
      )}
      <button className={btn} disabled={busy} onClick={save}>
        حفظ
      </button>
    </div>
  );
}

/* ===================== STUDENT CONTENT ===================== */
export function StudentContent() {
  const q = useContentItems();
  if (q.isLoading) return <Skeleton />;
  if (q.isError) return <Failed />;
  if (!q.data?.length) return <Empty text="لا توجد دروس أو محتوى حاليًا" />;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {q.data.map((c) => (
        <article key={c.id} className={card}>
          <div className="flex items-center gap-2 text-xs">
            <span className="rounded-full bg-gold-soft px-2.5 py-1 font-bold text-ink">
              {CONTENT_TYPE[c.content_type] ?? c.content_type}
            </span>
            <span className="text-ink-soft">
              {new Date(c.item_date).toLocaleDateString(loc(), {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
            <span className="text-ink-soft">· {VISIBILITY_LABEL[c.visibility]}</span>
          </div>
          <h3 className="mt-2 font-display text-lg font-black">{c.title}</h3>
          {c.description && (
            <p className="mt-1 whitespace-pre-line text-sm text-ink-soft">{c.description}</p>
          )}
          {c.url && /^https?:\/\//.test(c.url) && (
            <a
              href={c.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-sm font-bold text-oxblood"
            >
              فتح المحتوى ←
            </a>
          )}
        </article>
      ))}
    </div>
  );
}
