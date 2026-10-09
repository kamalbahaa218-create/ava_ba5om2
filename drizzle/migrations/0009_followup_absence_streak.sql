CREATE OR REPLACE FUNCTION public.can_followup(_uid uuid, _student uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select _uid <> _student and (public.is_main_admin(_uid)
    or (exists (select 1 from public.profiles where id=_uid and user_type='SERVANT' and is_active)
        and public.is_servant_of_student(_uid, _student)
        and public.has_permission(_uid, 'manage_followup')))
$$;

CREATE OR REPLACE FUNCTION public.can_access_private(_uid uuid, _student uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  select _uid <> _student and (public.is_main_admin(_uid)
    or (exists (select 1 from public.profiles where id=_uid and user_type='SERVANT' and is_active)
        and public.is_servant_of_student(_uid, _student)
        and public.has_permission(_uid, 'view_private_student_data')))
$$;

-- Absence messages
CREATE TABLE public.absence_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  meeting_date date NOT NULL,
  response text CHECK (response IS NULL OR char_length(response) <= 2000),
  responded_at timestamptz,
  dismissed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  dismissed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, meeting_date)
);
CREATE INDEX absence_messages_date_idx ON public.absence_messages(meeting_date DESC);
GRANT SELECT ON public.absence_messages TO authenticated;
GRANT ALL ON public.absence_messages TO service_role;
ALTER TABLE public.absence_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY absence_select ON public.absence_messages FOR SELECT TO authenticated
  USING ((student_id = auth.uid() AND dismissed_at IS NULL) OR public.can_followup(auth.uid(), student_id));

-- Generates messages for students who missed every expected session of a finished meeting day (last 30 days). Idempotent.
CREATE OR REPLACE FUNCTION public.sync_absence_messages() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare n int;
begin
  if auth.uid() is null then return 0; end if;
  with s as (
    select id, session_type, class_id, created_at, (start_time at time zone 'Africa/Cairo')::date d
    from public.attendance_sessions
    where expires_at < now() and start_time > now() - interval '30 days'
  ), expected as (
    select distinct p.id student_id, s.d from s
    join public.profiles p on p.user_type='STUDENT' and p.is_active and p.created_at < s.created_at
    where s.session_type='FIRST_HOUR'
       or exists (select 1 from public.class_members m where m.class_id=s.class_id and m.student_id=p.id)
  ), attended as (
    select distinct r.student_id, s.d from public.attendance_records r join s on s.id=r.session_id
  )
  insert into public.absence_messages(student_id, meeting_date)
  select e.student_id, e.d from expected e
  where not exists (select 1 from attended a where a.student_id=e.student_id and a.d=e.d)
  on conflict (student_id, meeting_date) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

CREATE OR REPLACE FUNCTION public.respond_absence(_id uuid, _text text) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
begin
  if char_length(coalesce(trim(_text),'')) = 0 or char_length(_text) > 2000 then return false; end if;
  update public.absence_messages set response = trim(_text), responded_at = now()
   where id=_id and student_id=auth.uid() and dismissed_at is null and response is null;
  return found;
end $$;

CREATE OR REPLACE FUNCTION public.dismiss_absence(_id uuid) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare _s uuid;
begin
  select student_id into _s from public.absence_messages where id=_id;
  if _s is null or not public.can_followup(auth.uid(), _s) then return false; end if;
  update public.absence_messages set dismissed_by=auth.uid(), dismissed_at=now() where id=_id and dismissed_at is null;
  return found;
end $$;

-- Daily streak
CREATE TABLE public.daily_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_date date NOT NULL UNIQUE,
  kind text NOT NULL CHECK (kind IN ('MCQ','TF','FILL')),
  prompt text NOT NULL CHECK (char_length(prompt) BETWEEN 1 AND 1000),
  options jsonb NOT NULL DEFAULT '[]'::jsonb,
  correct_answer text NOT NULL,
  points integer NOT NULL DEFAULT 5 CHECK (points BETWEEN 0 AND 1000),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_questions TO authenticated;
GRANT ALL ON public.daily_questions TO service_role;
ALTER TABLE public.daily_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY dq_admin ON public.daily_questions FOR ALL TO authenticated
  USING (public.is_main_admin(auth.uid())) WITH CHECK (public.is_main_admin(auth.uid()));

CREATE TABLE public.daily_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id uuid NOT NULL REFERENCES public.daily_questions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  answer_date date NOT NULL,
  answer text NOT NULL,
  is_correct boolean NOT NULL,
  points_awarded integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (question_id, student_id),
  UNIQUE (student_id, answer_date)
);
GRANT SELECT ON public.daily_answers TO authenticated;
GRANT ALL ON public.daily_answers TO service_role;
ALTER TABLE public.daily_answers ENABLE ROW LEVEL SECURITY;
CREATE POLICY da_select ON public.daily_answers FOR SELECT TO authenticated
  USING (student_id = auth.uid() OR public.is_main_admin(auth.uid()));

CREATE OR REPLACE FUNCTION public.daily_streak(_uid uuid) RETURNS integer
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
declare d date := (now() at time zone 'Africa/Cairo')::date; n int := 0;
begin
  if not exists (select 1 from public.daily_answers where student_id=_uid and answer_date=d) then d := d - 1; end if;
  while exists (select 1 from public.daily_answers where student_id=_uid and answer_date=d) loop
    n := n + 1; d := d - 1;
  end loop;
  return n;
end $$;

CREATE OR REPLACE FUNCTION public.get_daily_question() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
declare _uid uuid := auth.uid(); q public.daily_questions%rowtype; a public.daily_answers%rowtype;
begin
  if _uid is null then return null; end if;
  select * into q from public.daily_questions where question_date = (now() at time zone 'Africa/Cairo')::date;
  select * into a from public.daily_answers where student_id=_uid and question_id=q.id;
  return jsonb_build_object('streak', public.daily_streak(_uid),
    'question', case when q.id is null then null else jsonb_build_object('id',q.id,'kind',q.kind,'prompt',q.prompt,'options',q.options,'points',q.points) end,
    'answered', a.id is not null, 'is_correct', a.is_correct, 'points_awarded', a.points_awarded);
end $$;

CREATE OR REPLACE FUNCTION public.submit_daily_answer(_answer text) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
declare _uid uuid := auth.uid(); d date := (now() at time zone 'Africa/Cairo')::date;
  q public.daily_questions%rowtype; ok boolean; pts int := 0; rid uuid;
begin
  if _uid is null or not exists (select 1 from public.profiles where id=_uid and user_type='STUDENT' and is_active) then
    return jsonb_build_object('ok',false,'code','not_student'); end if;
  if char_length(coalesce(trim(_answer),'')) = 0 or char_length(_answer) > 500 then
    return jsonb_build_object('ok',false,'code','invalid'); end if;
  select * into q from public.daily_questions where question_date=d;
  if q.id is null then return jsonb_build_object('ok',false,'code','none'); end if;
  ok := lower(regexp_replace(trim(_answer),'\s+',' ','g')) = lower(regexp_replace(trim(q.correct_answer),'\s+',' ','g'));
  if ok then pts := q.points; end if;
  insert into public.daily_answers(question_id, student_id, answer_date, answer, is_correct, points_awarded)
    values (q.id, _uid, d, trim(_answer), ok, pts) on conflict do nothing returning id into rid;
  if rid is null then return jsonb_build_object('ok',false,'code','duplicate'); end if;
  if pts > 0 then
    insert into public.point_transactions(student_id, amount, type, reason, created_by)
    values (_uid, pts, 'activity', 'سؤال اليوم', q.created_by);
  end if;
  return jsonb_build_object('ok',true,'is_correct',ok,'points',pts,'streak',public.daily_streak(_uid));
end $$;

REVOKE EXECUTE ON FUNCTION public.sync_absence_messages(), public.respond_absence(uuid,text), public.dismiss_absence(uuid),
  public.daily_streak(uuid), public.get_daily_question(), public.submit_daily_answer(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.sync_absence_messages(), public.respond_absence(uuid,text), public.dismiss_absence(uuid),
  public.get_daily_question(), public.submit_daily_answer(text) TO authenticated;

INSERT INTO public.permissions(name, description) VALUES ('view_private_student_data','عرض بيانات المخدومين الخاصة')
  ON CONFLICT (name) DO NOTHING;