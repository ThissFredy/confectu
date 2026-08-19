-- Confectu: restringir ejecución de complete_workshop_setup a usuarios autenticados.
-- La función es SECURITY DEFINER y solo debe ser invocable por el rol authenticated.

revoke all on function public.complete_workshop_setup(text, text) from public;
revoke all on function public.complete_workshop_setup(text, text) from anon;

grant execute on function public.complete_workshop_setup(text, text) to authenticated;