-- H5 + H9h + endurecimiento de grants.
--
-- 1. Funciones SECURITY DEFINER ejecutables por anon/authenticated sin
--    proposito (H5): handle_new_user y rls_auto_enable son funciones de
--    trigger/evento; se revoca su ejecucion via API.
-- 2. Helpers de RLS a SECURITY DEFINER (H9h): evitan re-entrar en RLS al
--    consultar profiles/workshops desde las politicas (recursion y costo).
-- 3. El rol anon no necesita acceso a las tablas de public: todas las
--    politicas son TO authenticated y la app no hace lecturas anonimas.

alter function public.is_admin() security definer;
alter function public.current_workshop_id() security definer;

revoke all on function public.handle_new_user() from anon, authenticated, public;
revoke all on function public.rls_auto_enable() from anon, authenticated, public;

grant execute on function public.handle_new_user() to supabase_auth_admin;

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
