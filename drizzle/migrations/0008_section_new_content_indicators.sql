CREATE TABLE public.section_updates (
  section text PRIMARY KEY,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.section_updates TO authenticated;
GRANT ALL ON public.section_updates TO service_role;
ALTER TABLE public.section_updates ENABLE ROW LEVEL SECURITY;
CREATE POLICY section_updates_select ON public.section_updates FOR SELECT TO authenticated USING (true);

CREATE TABLE public.section_views (
  user_id uuid NOT NULL,
  section text NOT NULL,
  seen_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, section)
);
GRANT SELECT, INSERT, UPDATE ON public.section_views TO authenticated;
GRANT ALL ON public.section_views TO service_role;
ALTER TABLE public.section_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY section_views_select ON public.section_views FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY section_views_insert ON public.section_views FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY section_views_update ON public.section_views FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.bump_section()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
begin
  insert into public.section_updates(section, updated_at) values (TG_ARGV[0], now())
  on conflict (section) do update set updated_at = now();
  return null;
end $$;
REVOKE EXECUTE ON FUNCTION public.bump_section() FROM anon, authenticated, public;

CREATE TRIGGER bump_program_topics AFTER INSERT OR UPDATE OR DELETE ON public.topics FOR EACH STATEMENT EXECUTE FUNCTION public.bump_section('program');
CREATE TRIGGER bump_program_items AFTER INSERT OR UPDATE OR DELETE ON public.program_items FOR EACH STATEMENT EXECUTE FUNCTION public.bump_section('program');
CREATE TRIGGER bump_calendar AFTER INSERT OR UPDATE OR DELETE ON public.events FOR EACH STATEMENT EXECUTE FUNCTION public.bump_section('calendar');
CREATE TRIGGER bump_quizzes AFTER INSERT OR UPDATE OR DELETE ON public.quizzes FOR EACH STATEMENT EXECUTE FUNCTION public.bump_section('quizzes');
CREATE TRIGGER bump_quiz_questions AFTER INSERT OR UPDATE OR DELETE ON public.quiz_questions FOR EACH STATEMENT EXECUTE FUNCTION public.bump_section('quizzes');
CREATE TRIGGER bump_content AFTER INSERT OR UPDATE OR DELETE ON public.content_items FOR EACH STATEMENT EXECUTE FUNCTION public.bump_section('content');
CREATE TRIGGER bump_suggestions AFTER INSERT OR UPDATE OR DELETE ON public.suggestions FOR EACH STATEMENT EXECUTE FUNCTION public.bump_section('suggestions');
CREATE TRIGGER bump_announcements AFTER INSERT OR UPDATE OR DELETE ON public.announcements FOR EACH STATEMENT EXECUTE FUNCTION public.bump_section('home');