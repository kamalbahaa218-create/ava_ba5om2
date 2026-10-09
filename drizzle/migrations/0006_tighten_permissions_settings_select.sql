DROP POLICY IF EXISTS "permissions_select" ON public.permissions;
CREATE POLICY "permissions_select" ON public.permissions FOR SELECT TO authenticated
USING (public.is_main_admin(auth.uid()) OR public.has_permission(auth.uid(), 'manage_permissions')
  OR EXISTS (SELECT 1 FROM public.user_permissions up WHERE up.permission_id = permissions.id AND up.user_id = auth.uid()));

DROP POLICY IF EXISTS "settings_select" ON public.app_settings;
CREATE POLICY "settings_select" ON public.app_settings FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);