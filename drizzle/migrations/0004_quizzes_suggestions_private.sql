insert into public.permissions (name, description) values
 ('manage_quizzes','إدارة المسابقات والاختبارات'),
 ('manage_suggestions','عرض وإدارة الاقتراحات')
on conflict (name) do nothing;

-- QUIZZES
create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  class_id uuid references public.classes(id) on delete cascade,
  points_per_question int not null default 1 check (points_per_question between 0 and 1000),
  start_at timestamptz not null,
  end_at timestamptz not null,
  max_attempts int not null default 1 check (max_attempts between 1 and 20),
  is_published boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint quiz_period check (end_at > start_at)
);
create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  position int not null default 0,
  kind text not null check (kind in ('MCQ','TF')),
  prompt text not null,
  options jsonb not null default '[]'::jsonb
);
create index on public.quiz_questions(quiz_id);
create table public.quiz_answer_keys (
  question_id uuid primary key references public.quiz_questions(id) on delete cascade,
  correct_index int not null check (correct_index >= 0)
);
create table public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  score int not null,
  total int not null,
  points_awarded int not null default 0,
  submitted_at timestamptz not null default now()
);
create index on public.quiz_attempts(quiz_id, student_id);

grant select, insert, update, delete on public.quizzes, public.quiz_questions, public.quiz_answer_keys to authenticated;
grant select on public.quiz_attempts to authenticated;
grant all on public.quizzes, public.quiz_questions, public.quiz_answer_keys, public.quiz_attempts to service_role;
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.quiz_answer_keys enable row level security;
alter table public.quiz_attempts enable row level security;

create policy "quiz read" on public.quizzes for select to authenticated
  using (public.has_permission(auth.uid(),'manage_quizzes')
     or (is_published and (class_id is null or public.is_member_of_class(auth.uid(), class_id))));
create policy "quiz write" on public.quizzes for all to authenticated
  using (public.has_permission(auth.uid(),'manage_quizzes'))
  with check (public.has_permission(auth.uid(),'manage_quizzes'));
create policy "questions managers" on public.quiz_questions for all to authenticated
  using (public.has_permission(auth.uid(),'manage_quizzes'))
  with check (public.has_permission(auth.uid(),'manage_quizzes'));
create policy "keys managers" on public.quiz_answer_keys for all to authenticated
  using (public.has_permission(auth.uid(),'manage_quizzes'))
  with check (public.has_permission(auth.uid(),'manage_quizzes'));
create policy "attempts read" on public.quiz_attempts for select to authenticated
  using (student_id = auth.uid() or public.has_permission(auth.uid(),'manage_quizzes'));

create or replace function public.get_quiz_questions(_quiz uuid)
returns table(id uuid, "position" int, kind text, prompt text, options jsonb)
language plpgsql stable security definer set search_path = public as $$
declare q public.quizzes%rowtype;
begin
  select * into q from public.quizzes where quizzes.id = _quiz;
  if not found or auth.uid() is null then return; end if;
  if not public.has_permission(auth.uid(),'manage_quizzes') then
    if not q.is_published or now() < q.start_at or now() > q.end_at then return; end if;
    if not exists (select 1 from public.profiles where profiles.id = auth.uid() and user_type='STUDENT') then return; end if;
    if q.class_id is not null and not public.is_member_of_class(auth.uid(), q.class_id) then return; end if;
  end if;
  return query select qq.id, qq.position, qq.kind, qq.prompt, qq.options
    from public.quiz_questions qq where qq.quiz_id = _quiz order by qq.position, qq.id;
end $$;

create or replace function public.submit_quiz(_quiz uuid, _answers jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare q public.quizzes%rowtype; _uid uuid := auth.uid(); _score int; _total int; _pts int;
begin
  if _uid is null then return jsonb_build_object('ok',false,'code','auth'); end if;
  if not exists (select 1 from public.profiles where id=_uid and user_type='STUDENT') then
    return jsonb_build_object('ok',false,'code','not_student'); end if;
  select * into q from public.quizzes where id=_quiz for update;
  if not found or not q.is_published or now() < q.start_at or now() > q.end_at then
    return jsonb_build_object('ok',false,'code','closed'); end if;
  if q.class_id is not null and not public.is_member_of_class(_uid, q.class_id) then
    return jsonb_build_object('ok',false,'code','closed'); end if;
  if (select count(*) from public.quiz_attempts where quiz_id=_quiz and student_id=_uid) >= q.max_attempts then
    return jsonb_build_object('ok',false,'code','attempts'); end if;
  select count(*), count(*) filter (where (_answers->>qq.id::text) ~ '^\d+$' and (_answers->>qq.id::text)::int = k.correct_index)
    into _total, _score
    from public.quiz_questions qq left join public.quiz_answer_keys k on k.question_id = qq.id
    where qq.quiz_id=_quiz;
  -- points only for the best attempt improvement
  _pts := greatest(0, _score * q.points_per_question
            - coalesce((select max(points_awarded) from public.quiz_attempts where quiz_id=_quiz and student_id=_uid),0)
            - 0);
  _pts := greatest(0, _score * q.points_per_question - coalesce((select sum(points_awarded) from public.quiz_attempts where quiz_id=_quiz and student_id=_uid),0));
  insert into public.quiz_attempts(quiz_id, student_id, score, total, points_awarded) values (_quiz,_uid,_score,_total,_pts);
  if _pts > 0 then
    insert into public.point_transactions(student_id, amount, type, reason, created_by)
    values (_uid, _pts, 'competition', 'مسابقة: ' || q.title, q.created_by);
  end if;
  return jsonb_build_object('ok',true,'score',_score,'total',_total,'points',_pts);
end $$;

-- SUGGESTIONS
create type public.suggestion_status as enum ('NEW','SEEN','IN_PROGRESS','DONE','REJECTED');
create table public.suggestions (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null default auth.uid() references public.profiles(id) on delete cascade,
  is_anonymous boolean not null default false,
  title text not null check (char_length(title) between 1 and 200),
  content text not null check (char_length(content) between 1 and 4000),
  status public.suggestion_status not null default 'NEW',
  created_at timestamptz not null default now()
);
grant select, insert on public.suggestions to authenticated;
grant all on public.suggestions to service_role;
alter table public.suggestions enable row level security;
create policy "own suggestions read" on public.suggestions for select to authenticated using (student_id = auth.uid());
create policy "students submit" on public.suggestions for insert to authenticated
  with check (student_id = auth.uid() and status = 'NEW'
    and exists (select 1 from public.profiles where id = auth.uid() and user_type='STUDENT'));

create or replace function public.list_suggestions()
returns table(id uuid, title text, content text, status public.suggestion_status, is_anonymous boolean, author_name text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select s.id, s.title, s.content, s.status, s.is_anonymous,
    case when s.is_anonymous then null else p.full_name end, s.created_at
  from public.suggestions s join public.profiles p on p.id = s.student_id
  where public.has_permission(auth.uid(),'manage_suggestions')
  order by s.created_at desc
$$;
create or replace function public.set_suggestion_status(_id uuid, _status public.suggestion_status)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.has_permission(auth.uid(),'manage_suggestions') then return false; end if;
  update public.suggestions set status=_status where id=_id;
  return found;
end $$;
create or replace function public.delete_suggestion(_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.has_permission(auth.uid(),'manage_suggestions') then return false; end if;
  delete from public.suggestions where id=_id;
  return found;
end $$;

-- PRIVATE STUDENT DATA
create table public.student_private (
  student_id uuid primary key references public.profiles(id) on delete cascade,
  guardian_phone text,
  address text,
  private_notes text,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
grant select, insert, update, delete on public.student_private to authenticated;
grant all on public.student_private to service_role;
alter table public.student_private enable row level security;
create or replace function public.can_access_private(_uid uuid, _student uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select _uid <> _student and (public.is_main_admin(_uid)
    or (exists (select 1 from public.profiles where id=_uid and user_type='SERVANT')
        and public.is_servant_of_student(_uid, _student)))
$$;
create policy "private access" on public.student_private for all to authenticated
  using (public.can_access_private(auth.uid(), student_id))
  with check (public.can_access_private(auth.uid(), student_id));
create trigger student_private_touch before update on public.student_private
  for each row execute function public.touch_updated_at();

revoke execute on function public.get_quiz_questions(uuid), public.submit_quiz(uuid,jsonb), public.list_suggestions(),
  public.set_suggestion_status(uuid, public.suggestion_status), public.delete_suggestion(uuid), public.can_access_private(uuid,uuid) from anon, public;
grant execute on function public.get_quiz_questions(uuid), public.submit_quiz(uuid,jsonb), public.list_suggestions(),
  public.set_suggestion_status(uuid, public.suggestion_status), public.delete_suggestion(uuid), public.can_access_private(uuid,uuid) to authenticated;