create or replace function public.search_point_students(_q text default '')
returns table(id uuid, full_name text, class_name text)
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name,
    (select string_agg(c.name, '، ') from public.class_members m join public.classes c on c.id=m.class_id where m.student_id=p.id)
  from public.profiles p
  where public.has_permission(auth.uid(),'manage_points')
    and p.user_type='STUDENT' and p.is_active and p.id <> auth.uid()
    and (coalesce(_q,'') = '' or p.full_name ilike '%' || _q || '%')
  order by p.full_name limit 50
$$;
revoke execute on function public.search_point_students(text) from anon, public;
grant execute on function public.search_point_students(text) to authenticated;