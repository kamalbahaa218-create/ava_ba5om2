import { loc, t } from "@/lib/i18n/core";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { btn, card, fmtDate, fmtDateTime, inputCls, FOLLOW_LABEL } from "./part3";
import { HistoryList } from "./HistoryList";
import { Empty, Skeleton } from "./live";
import { PrivateDataForm } from "./part5";
import { SectionHeading } from "./SectionHeading";
import { readFullHistory } from "@/lib/activity";
import jesusAbsenceImg from "@/assets/jesus-absence.png";
import jesusDailyQuestionImg from "@/assets/jesus-daily-question.png";
import type { Database } from "@/integrations/supabase/types";

type FollowStatus = Database["public"]["Enums"]["followup_status"];
type Student = { id: string; full_name: string; className: string };

/* ===================== FOLLOW-UP WORKSPACE ===================== */
export function FollowupWorkspace({
  userId,
  isAdmin,
  canManage,
  canPrivate,
}: {
  userId: string;
  isAdmin: boolean;
  canManage: boolean;
  canPrivate: boolean;
}) {
  const [tab, setTab] = useState<"students" | "messages">("students");
  const [sel, setSel] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  useEffect(() => {
    void supabase.rpc("sync_absence_messages");
  }, []);
  const students = useQuery({
    queryKey: ["fu-students", userId, isAdmin],
    queryFn: async (): Promise<Student[]> => {
      let classIds: string[] | null = null;
      if (!isAdmin) {
        const { data } = await supabase
          .from("class_servants")
          .select("class_id")
          .eq("servant_id", userId);
        classIds = (data ?? []).map((c) => c.class_id);
        if (!classIds.length) return [];
      }
      let q = supabase
        .from("class_members")
        .select("student_id, classes(name), profiles(id, full_name, is_active)");
      if (classIds) q = q.in("class_id", classIds);
      const { data: members } = await q;
      const m = new Map<string, Student>();
      (members ?? []).forEach(
        (r) =>
          r.profiles &&
          m.set(r.profiles.id, {
            id: r.profiles.id,
            full_name: r.profiles.full_name,
            className: r.classes?.name ?? "",
          }),
      );
      if (isAdmin) {
        const { data } = await supabase
          .from("profiles")
          .select("id, full_name")
          .eq("user_type", "STUDENT");
        (data ?? []).forEach(
          (p) =>
            !m.has(p.id) &&
            m.set(p.id, { id: p.id, full_name: p.full_name, className: "بدون فصل" }),
        );
      }
      return [...m.values()].sort((a, b) => a.full_name.localeCompare(b.full_name, "ar"));
    },
  });
  const list = (students.data ?? []).filter((s) => s.full_name.includes(search.trim()));
  const current = students.data?.find((s) => s.id === sel);
  return (
    <>
      <div className="mb-6 flex gap-2">
        {(
          [
            ["students", "المخدومون"],
            ["messages", "رسائل وحشتني يا حبيبي"],
          ] as const
        ).map(([k, l]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`rounded-full px-4 py-2.5 text-sm font-semibold ${tab === k ? "bg-ink text-paper" : "bg-ink/5 text-ink-soft"}`}
          >
            {l}
          </button>
        ))}
      </div>
      {tab === "messages" ? (
        <AbsenceMessagesManager
          names={new Map((students.data ?? []).map((s) => [s.id, s.full_name]))}
        />
      ) : (
        <div className="grid gap-4 lg:grid-cols-12">
          <div className={`${card} lg:col-span-4`}>
            <input
              className={inputCls}
              placeholder="بحث بالاسم"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <ul className="mt-3 max-h-[32rem] space-y-1 overflow-y-auto">
              {students.isLoading ? (
                <Skeleton h="h-20" />
              ) : list.length ? (
                list.map((s) => (
                  <li key={s.id}>
                    <button
                      onClick={() => setSel(s.id)}
                      className={`w-full rounded-xl px-3 py-2 text-start text-sm ${sel === s.id ? "bg-ink text-paper" : "hover:bg-ink/5"}`}
                    >
                      {s.full_name || "—"}{" "}
                      <span className="ms-1 text-xs opacity-70">{s.className}</span>
                    </button>
                  </li>
                ))
              ) : (
                <li className="text-sm text-ink-soft">لا يوجد مخدومون في فصولك.</li>
              )}
            </ul>
          </div>
          <div className="lg:col-span-8">
            {current ? (
              <StudentFollowProfile
                key={current.id}
                student={current}
                userId={userId}
                canManage={isAdmin || canManage}
                canPrivate={isAdmin || canPrivate}
              />
            ) : (
              <Empty text="اختر مخدومًا لعرض ملفه" />
            )}
          </div>
        </div>
      )}
    </>
  );
}

function StudentFollowProfile({
  student,
  userId,
  canManage,
  canPrivate,
}: {
  student: Student;
  userId: string;
  canManage: boolean;
  canPrivate: boolean;
}) {
  const qc = useQueryClient();
  const [f, setF] = useState({ status: "CONTACTED" as FollowStatus, note: "" });
  const data = useQuery({
    queryKey: ["fu-profile", student.id],
    queryFn: async () => {
      const [att, fu, abs] = await Promise.all([
        readFullHistory((a, b) =>
          supabase
            .from("attendance_records")
            .select("id, recorded_at, attendance_sessions(session_type)")
            .eq("student_id", student.id)
            .order("recorded_at", { ascending: false })
            .order("id", { ascending: false })
            .range(a, b),
        ),
        readFullHistory((a, b) =>
          supabase
            .from("followup_records")
            .select("id, date, status, note, created_at")
            .eq("student_id", student.id)
            .order("created_at", { ascending: false })
            .order("id", { ascending: false })
            .range(a, b),
        ),
        supabase
          .from("absence_messages")
          .select("*")
          .eq("student_id", student.id)
          .order("meeting_date", { ascending: false }),
      ]);
      return { att, fu, abs: abs.data ?? [] };
    },
  });
  async function save() {
    if (f.note.length > 2000) return void toast.error(t("النص طويل جدًا"));
    const { error } = await supabase.from("followup_records").insert({
      student_id: student.id,
      servant_id: userId,
      status: f.status,
      note: f.note.trim() || null,
    });
    if (error) return void toast.error(t("ليس لديك صلاحية لمتابعة هذا المخدوم."));
    toast.success(t("تم الحفظ بنجاح"));
    setF({ status: "CONTACTED", note: "" });
    qc.invalidateQueries({ queryKey: ["fu-profile", student.id] });
  }
  if (data.isLoading || !data.data) return <Skeleton />;
  const { att, fu, abs } = data.data;
  return (
    <div className="space-y-5">
      <div className={card}>
        <h2 className="font-display text-xl font-black">{student.full_name}</h2>
        <p className="text-xs text-ink-soft">{student.className}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-xs">
          <span className="rounded-full bg-ink/5 px-3 py-1">
            آخر حضور: {att[0] ? fmtDate(att[0].recorded_at) : "—"}
          </span>
          <span className="rounded-full bg-ink/5 px-3 py-1">
            آخر افتقاد: {fu[0] ? fmtDate(fu[0].created_at) : "—"}
          </span>
          <span className="rounded-full bg-oxblood px-3 py-1 text-gold-soft">
            مرات الغياب: {abs.length}
          </span>
        </div>
      </div>
      {canPrivate && <PrivateDataForm studentId={student.id} userId={userId} />}
      <div className={card}>
        <p className="mb-2 font-display font-black">سجل الحضور</p>
        {att.length ? (
          <HistoryList
            list
            className="space-y-1 text-sm"
            rows={att}
            render={(r) => (
              <li key={r.id}>
                ✓ {fmtDateTime(r.recorded_at)} ·{" "}
                {r.attendance_sessions?.session_type === "FIRST_HOUR" ? "الساعة الأولى" : "الفصل"}
              </li>
            )}
          />
        ) : (
          <p className="text-sm text-ink-soft">لا يوجد حضور مسجّل.</p>
        )}
      </div>
      <div className={card}>
        <p className="mb-2 font-display font-black">سجل الغياب وردود المخدوم</p>
        {abs.length ? (
          <HistoryList
            list
            className="space-y-2 text-sm"
            rows={abs}
            render={(m) => (
              <li key={m.id} className="rounded-2xl bg-paper px-3 py-2">
                <b>{fmtDate(m.meeting_date)}</b> ·{" "}
                {m.dismissed_at ? "أُخفيت (كان حاضرًا)" : m.response ? "رد المخدوم" : "لم يرد بعد"}
                {m.response && (
                  <p className="mt-1 text-ink-soft">
                    «{m.response}» — {fmtDateTime(m.responded_at!)}
                  </p>
                )}
              </li>
            )}
          />
        ) : (
          <p className="text-sm text-ink-soft">لا يوجد غياب مسجّل.</p>
        )}
      </div>
      <div className={card}>
        <p className="mb-2 font-display font-black">سجل الافتقاد</p>
        {canManage && (
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <select
              className={inputCls}
              value={f.status}
              onChange={(e) => setF({ ...f, status: e.target.value as FollowStatus })}
            >
              {(Object.keys(FOLLOW_LABEL) as FollowStatus[]).map((k) => (
                <option key={k} value={k}>
                  {FOLLOW_LABEL[k]}
                </option>
              ))}
            </select>
            <input
              placeholder="سبب الغياب / ملاحظة الافتقاد"
              className={inputCls}
              value={f.note}
              onChange={(e) => setF({ ...f, note: e.target.value })}
            />
            <button onClick={save} className={btn}>
              حفظ
            </button>
          </div>
        )}
        {fu.length ? (
          <HistoryList
            list
            className="space-y-1 text-sm"
            rows={fu}
            render={(h) => (
              <li key={h.id}>
                {fmtDateTime(h.created_at)} · {FOLLOW_LABEL[h.status]}
                {h.note ? ` — ${h.note}` : ""}
              </li>
            )}
          />
        ) : (
          <p className="text-sm text-ink-soft">لا توجد سجلات افتقاد.</p>
        )}
      </div>
    </div>
  );
}

function AbsenceMessagesManager({ names }: { names: Map<string, string> }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["absence-all"],
    queryFn: async () =>
      readFullHistory((a, b) =>
        supabase
          .from("absence_messages")
          .select("*")
          .order("meeting_date", { ascending: false })
          .order("id")
          .range(a, b),
      ),
  });
  async function dismiss(id: string) {
    const { data } = await supabase.rpc("dismiss_absence", { _id: id });
    if (!data) return void toast.error(t("حدث خطأ، حاول مرة أخرى"));
    toast.success(t("تم إخفاء الرسالة"));
    qc.invalidateQueries({ queryKey: ["absence-all"] });
  }
  if (q.isLoading) return <Skeleton />;
  const rows = (q.data ?? []).filter((m) => names.has(m.student_id));
  if (!rows.length) return <Empty text="لا توجد رسائل غياب" />;
  return (
    <HistoryList
      list
      className="space-y-2"
      rows={rows}
      render={(m) => (
        <li key={m.id} className={`${card} flex flex-wrap items-center gap-3 text-sm`}>
          <span className="flex-1 font-display font-black">{names.get(m.student_id)}</span>
          <span className="text-xs text-ink-soft">{fmtDate(m.meeting_date)}</span>
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${m.dismissed_at ? "bg-ink/5" : m.response ? "bg-gold-soft text-ink" : "bg-oxblood text-gold-soft"}`}
          >
            {m.dismissed_at
              ? t("مُخفاة · {0}", [fmtDateTime(m.dismissed_at)])
              : m.response
                ? "تم الرد"
                : "بانتظار الرد"}
          </span>
          {!m.dismissed_at && (
            <button onClick={() => dismiss(m.id)} className="text-xs font-semibold text-oxblood">
              إخفاء (كان حاضرًا)
            </button>
          )}
          {m.response && <p className="w-full text-ink-soft">«{m.response}»</p>}
        </li>
      )}
    />
  );
}

/* ===================== STUDENT: ABSENCE PROMPT ===================== */
export function AbsencePrompt({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const q = useQuery({
    queryKey: ["my-absence", userId],
    queryFn: async () => {
      await supabase.rpc("sync_absence_messages");
      const { data } = await supabase
        .from("absence_messages")
        .select("id, meeting_date")
        .eq("student_id", userId)
        .is("response", null)
        .order("meeting_date", { ascending: false })
        .limit(1);
      return data?.[0] ?? null;
    },
  });
  const m = q.data;
  if (!m) return null;
  async function send() {
    const { data } = await supabase.rpc("respond_absence", { _id: m!.id, _text: text });
    if (!data) return void toast.error(t("اكتب ردك أولًا"));
    toast.success(t("وصلت رسالتك لخدامك ❤"));
    setText("");
    qc.invalidateQueries({ queryKey: ["my-absence", userId] });
  }
  return (
    <section className="mt-6 animate-rise overflow-hidden rounded-3xl bg-gold-soft/60 ring-1 ring-gold/40">
      <div className="grid items-center gap-4 p-6 sm:grid-cols-[8rem_1fr]">
        <img src={jesusAbsenceImg} alt="" className="mx-auto h-32 w-auto object-contain" />
        <div>
          <h2 className="font-display text-2xl font-black text-oxblood">وحشتني يا حبيبي ❤</h2>
          <p className="mt-1 text-sm text-ink">
            افتقدتك في اجتماع يوم{" "}
            {new Date(m.meeting_date).toLocaleDateString(loc(), {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
            . أنا مستنيك دايمًا، ولو حابب تحكيلي إيه اللي منعك، اكتبه هنا 🙏
          </p>
          <textarea
            maxLength={2000}
            className={`${inputCls} mt-3 min-h-20`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="اكتب سبب غيابك…"
          />
          <button onClick={send} className={`${btn} mt-2`}>
            إرسال
          </button>
        </div>
      </div>
    </section>
  );
}

/* ===================== STUDENT: DAILY STREAK ===================== */
type DailyQ = {
  streak: number;
  answered: boolean;
  is_correct: boolean | null;
  points_awarded: number | null;
  question: {
    id: string;
    kind: "MCQ" | "TF" | "FILL";
    prompt: string;
    options: string[];
    points: number;
  } | null;
};

export function DailyStreak({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [ans, setAns] = useState("");
  const [busy, setBusy] = useState(false);
  const q = useQuery({
    queryKey: ["daily-q", userId],
    queryFn: async () => (await supabase.rpc("get_daily_question")).data as unknown as DailyQ,
  });
  const d = q.data;
  async function submit() {
    setBusy(true);
    const { data } = await supabase.rpc("submit_daily_answer", { _answer: ans });
    setBusy(false);
    const r = data as { ok: boolean; is_correct?: boolean; points?: number; code?: string } | null;
    if (!r?.ok)
      return void toast.error(
        t(r?.code === "duplicate" ? "جاوبت النهارده بالفعل" : "حدث خطأ، حاول مرة أخرى"),
      );
    toast.success(
      t(r.is_correct ? t("إجابة صحيحة! +{0} نقطة 🔥", [r.points]) : "شكرًا! حافظت على سلسلتك 🔥"),
    );
    qc.invalidateQueries({ queryKey: ["daily-q", userId] });
    qc.invalidateQueries({ queryKey: ["my-points"] });
  }
  return (
    <section className="mt-12">
      <SectionHeading title="سؤال اليوم 🔥" note="جاوب كل يوم وحافظ على سلسلتك" />
      <div className={`${card} grid gap-5 sm:grid-cols-[9rem_1fr]`}>
        <div className="text-center">
          <img src={jesusDailyQuestionImg} alt="" className="mx-auto h-24 w-auto object-contain" />
          <p className="mt-2 font-display text-3xl font-black text-oxblood">
            🔥 {(d?.streak ?? 0).toLocaleString(loc())}
          </p>
          <p className="text-xs text-ink-soft">يوم متتالي</p>
        </div>
        <div>
          {q.isLoading ? (
            <Skeleton h="h-20" />
          ) : !d?.question ? (
            <p className="text-sm text-ink-soft">لا يوجد سؤال اليوم. ارجع بكرة 🙏</p>
          ) : d.answered ? (
            <p className="text-sm">
              جاوبت سؤال النهارده{" "}
              {d.is_correct
                ? t("صح ✓ وكسبت {0} نقطة", [d.points_awarded])
                : "— ربنا يباركك، ارجع بكرة"}{" "}
              🔥
            </p>
          ) : (
            <>
              <p className="font-display font-black">{d.question.prompt}</p>
              <p className="text-xs text-ink-soft">{d.question.points} نقطة للإجابة الصحيحة</p>
              <div className="mt-3 space-y-2">
                {d.question.kind === "FILL" ? (
                  <input
                    maxLength={500}
                    className={inputCls}
                    value={ans}
                    onChange={(e) => setAns(e.target.value)}
                    placeholder="اكتب الإجابة"
                  />
                ) : (
                  (d.question.kind === "TF" ? ["صح", "خطأ"] : d.question.options).map((o) => (
                    <button
                      key={o}
                      onClick={() => setAns(o)}
                      className={`block w-full rounded-2xl px-4 py-2.5 text-start text-sm ring-1 ring-line ${ans === o ? "bg-ink text-paper" : "bg-paper"}`}
                    >
                      {o}
                    </button>
                  ))
                )}
              </div>
              <button disabled={busy || !ans.trim()} onClick={submit} className={`${btn} mt-3`}>
                إرسال
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

/* ===================== ADMIN: DAILY QUESTIONS ===================== */
const todayCairo = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Africa/Cairo" }).format(new Date());
const blank = () => ({
  id: "",
  question_date: todayCairo(),
  kind: "MCQ" as "MCQ" | "TF" | "FILL",
  prompt: "",
  options: ["", "", ""],
  correct_answer: "",
  points: 5,
});

export function DailyQuestionsManager({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const [f, setF] = useState(blank());
  const q = useQuery({
    queryKey: ["daily-admin"],
    queryFn: async () =>
      (
        await supabase
          .from("daily_questions")
          .select("*")
          .order("question_date", { ascending: false })
          .limit(60)
      ).data ?? [],
  });
  async function save() {
    const options =
      f.kind === "MCQ"
        ? f.options.map((o) => o.trim()).filter(Boolean)
        : f.kind === "TF"
          ? ["صح", "خطأ"]
          : [];
    if (
      !f.prompt.trim() ||
      !f.correct_answer.trim() ||
      (f.kind === "MCQ" && (options.length < 2 || !options.includes(f.correct_answer.trim())))
    )
      return void toast.error(t("أكمل السؤال واختر الإجابة الصحيحة"));
    const row = {
      question_date: f.question_date,
      kind: f.kind,
      prompt: f.prompt.trim(),
      options,
      correct_answer: f.correct_answer.trim(),
      points: f.points,
      created_by: userId,
    };
    const { error } = f.id
      ? await supabase.from("daily_questions").update(row).eq("id", f.id)
      : await supabase.from("daily_questions").insert(row);
    if (error)
      return void toast.error(
        t(error.code === "23505" ? "يوجد سؤال لهذا اليوم بالفعل" : "حدث خطأ، حاول مرة أخرى"),
      );
    toast.success(t("تم الحفظ بنجاح"));
    setF(blank());
    qc.invalidateQueries({ queryKey: ["daily-admin"] });
  }
  async function del(id: string) {
    const { error } = await supabase.from("daily_questions").delete().eq("id", id);
    if (error) return void toast.error(t("حدث خطأ، حاول مرة أخرى"));
    qc.invalidateQueries({ queryKey: ["daily-admin"] });
  }
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className={`${card} space-y-3`}>
        <p className="font-display font-black">{f.id ? "تعديل السؤال" : "سؤال يومي جديد"}</p>
        <div className="grid grid-cols-3 gap-2">
          <input
            type="date"
            className={inputCls}
            value={f.question_date}
            onChange={(e) => setF({ ...f, question_date: e.target.value })}
          />
          <select
            className={inputCls}
            value={f.kind}
            onChange={(e) =>
              setF({ ...f, kind: e.target.value as typeof f.kind, correct_answer: "" })
            }
          >
            <option value="MCQ">اختر</option>
            <option value="TF">صح وخطأ</option>
            <option value="FILL">أكمل</option>
          </select>
          <input
            type="number"
            min={0}
            max={1000}
            className={inputCls}
            value={f.points}
            onChange={(e) => setF({ ...f, points: Number(e.target.value) })}
            aria-label="النقاط"
          />
        </div>
        <textarea
          className={inputCls}
          placeholder="نص السؤال"
          value={f.prompt}
          onChange={(e) => setF({ ...f, prompt: e.target.value })}
        />
        {f.kind === "MCQ" && (
          <>
            {f.options.map((o, i) => (
              <input
                key={i}
                className={inputCls}
                placeholder={t("اختيار {0}", [i + 1])}
                value={o}
                onChange={(e) =>
                  setF({ ...f, options: f.options.map((x, j) => (j === i ? e.target.value : x)) })
                }
              />
            ))}
            <button
              className="text-xs font-semibold text-oxblood"
              onClick={() => setF({ ...f, options: [...f.options, ""] })}
            >
              + اختيار
            </button>
            <select
              className={inputCls}
              value={f.correct_answer}
              onChange={(e) => setF({ ...f, correct_answer: e.target.value })}
            >
              <option value="">الإجابة الصحيحة…</option>
              {f.options
                .filter((o) => o.trim())
                .map((o) => (
                  <option key={o} value={o.trim()}>
                    {o.trim()}
                  </option>
                ))}
            </select>
          </>
        )}
        {f.kind === "TF" && (
          <select
            className={inputCls}
            value={f.correct_answer}
            onChange={(e) => setF({ ...f, correct_answer: e.target.value })}
          >
            <option value="">الإجابة الصحيحة…</option>
            <option value="صح">صح</option>
            <option value="خطأ">خطأ</option>
          </select>
        )}
        {f.kind === "FILL" && (
          <input
            className={inputCls}
            placeholder="الإجابة الصحيحة"
            value={f.correct_answer}
            onChange={(e) => setF({ ...f, correct_answer: e.target.value })}
          />
        )}
        <div className="flex gap-2">
          <button className={btn} onClick={save}>
            حفظ
          </button>
          {f.id && (
            <button onClick={() => setF(blank())} className="text-sm">
              إلغاء
            </button>
          )}
        </div>
      </div>
      <ul className="space-y-2">
        {(q.data ?? []).map((r) => (
          <li key={r.id} className={`${card} text-sm`}>
            <div className="flex items-center gap-2">
              <b className="flex-1">{r.question_date}</b>
              <span className="text-xs">{r.points} نقطة</span>
              <button
                className="text-xs font-semibold text-oxblood"
                onClick={() =>
                  setF({
                    ...r,
                    kind: r.kind as "MCQ",
                    options: r.kind === "MCQ" ? (r.options as string[]) : ["", "", ""],
                  })
                }
              >
                تعديل
              </button>
              <button className="text-xs text-ink-soft" onClick={() => del(r.id)}>
                حذف
              </button>
            </div>
            <p className="mt-1">{r.prompt}</p>
            <p className="text-xs text-ink-soft">الإجابة: {r.correct_answer}</p>
          </li>
        ))}
        {!q.data?.length && !q.isLoading && <Empty text="لا توجد أسئلة يومية" />}
      </ul>
    </div>
  );
}
