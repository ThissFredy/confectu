-- Los helpers de RLS (ahora SECURITY DEFINER) tampoco deben ser ejecutables
-- por anon/public: authenticated conserva su grant explicito para politicas.

revoke all on function public.is_admin() from anon, public;
revoke all on function public.current_workshop_id() from anon, public;
