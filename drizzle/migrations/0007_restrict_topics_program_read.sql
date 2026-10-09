drop policy if exists topics_select on public.topics;
create policy topics_select on public.topics for select to authenticated using (true);

drop policy if exists program_select on public.program_items;
create policy program_select on public.program_items for select to authenticated using (true);