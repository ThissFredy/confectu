-- Confectu: función atómica para completar el onboarding de un taller.
-- Crea workshops + workshop_settings y marca profiles.workshop_setup_completed = true
-- en una sola transacción. Valida sesión, rol, estado y duplicados.

create or replace function public.complete_workshop_setup(
  p_business_name text,
  p_invoice_prefix text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id uuid;
  v_profile public.profiles%rowtype;
  v_workshop_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'not authenticated' using errcode = 'P0001';
  end if;

  select * into v_profile
  from public.profiles
  where id = v_user_id;

  if not found then
    raise exception 'profile not found' using errcode = 'P0001';
  end if;

  if v_profile.role <> 'CLIENT' then
    raise exception 'only CLIENT can complete workshop setup' using errcode = 'P0001';
  end if;

  if not v_profile.is_active then
    raise exception 'account is inactive' using errcode = 'P0001';
  end if;

  if v_profile.workshop_setup_completed then
    raise exception 'workshop already set up' using errcode = 'P0001';
  end if;

  if length(btrim(p_business_name)) = 0 or length(p_business_name) > 255 then
    raise exception 'invalid business_name' using errcode = 'P0001';
  end if;

  if p_invoice_prefix !~ '^[A-Z0-9]{1,3}$' then
    raise exception 'invalid invoice_prefix' using errcode = 'P0001';
  end if;

  insert into public.workshops (owner_id)
  values (v_user_id)
  returning id into v_workshop_id;

  insert into public.workshop_settings (
    workshop_id,
    business_name,
    invoice_prefix
  ) values (
    v_workshop_id,
    p_business_name,
    p_invoice_prefix
  );

  update public.profiles
  set workshop_setup_completed = true
  where id = v_user_id;

  return v_workshop_id;
end;
$$;

revoke all on function public.complete_workshop_setup(text, text) from public;
revoke all on function public.complete_workshop_setup(text, text) from anon;
grant execute on function public.complete_workshop_setup(text, text) to authenticated;

comment on function public.complete_workshop_setup(text, text) is
  'Crea atómicamente el taller y su configuración inicial al completar el onboarding.';
