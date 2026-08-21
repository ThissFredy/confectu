-- Ajusta las políticas RLS de invoices y services para permitir a ADMIN
-- leer todas las filas, necesario para los conteos del dashboard de /admin.
-- No se modifican las políticas de insert, update ni delete.

drop policy if exists services_select on public.services;
create policy services_select on public.services
  for select to authenticated
  using (workshop_id = public.current_workshop_id() or public.is_admin());

drop policy if exists invoices_select on public.invoices;
create policy invoices_select on public.invoices
  for select to authenticated
  using (workshop_id = public.current_workshop_id() or public.is_admin());
