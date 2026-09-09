-- H1: afinidad customer -> workshop en invoices a nivel de base de datos.
--
-- Antes solo se validaba en la aplicación: un UPDATE directo via PostgREST
-- podia vincular una factura propia a un cliente de otro taller porque la
-- politica RLS de invoices solo restringe workshop_id y la FK solo verifica
-- existencia. Este trigger cierra la brecha en la base de datos.

create or replace function public.validate_invoice_customer()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_customer_workshop uuid;
begin
  select c.workshop_id into v_customer_workshop
  from public.customers c
  where c.id = new.customer_id;

  if not found or v_customer_workshop is distinct from new.workshop_id then
    raise exception 'customer does not belong to invoice workshop' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create trigger invoices_validate_customer
  before insert or update of customer_id, workshop_id on public.invoices
  for each row execute function public.validate_invoice_customer();

comment on function public.validate_invoice_customer() is
  'Garantiza que el cliente de una factura pertenezca al mismo taller que la factura.';

-- issue_invoice: ademas de is_active, validar afinidad customer -> workshop.

create or replace function public.issue_invoice(
  p_invoice_id uuid,
  p_payment_method text,
  p_payment_instructions text
)
returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_invoice public.invoices%rowtype;
  v_workshop_id uuid;
  v_settings public.workshop_settings%rowtype;
  v_assigned_number bigint;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = 'P0001';
  end if;

  select * into v_invoice
  from public.invoices
  where id = p_invoice_id
  for update;

  if not found then
    raise exception 'invoice not found' using errcode = 'P0001';
  end if;

  select w.id into v_workshop_id
  from public.workshops w
  where w.owner_id = auth.uid()
  limit 1;

  if v_workshop_id is null or v_workshop_id <> v_invoice.workshop_id then
    raise exception 'invoice does not belong to caller workshop' using errcode = 'P0001';
  end if;

  if v_invoice.status <> 'draft' then
    raise exception 'only draft invoices can be issued' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.customers c
    where c.id = v_invoice.customer_id
      and c.workshop_id = v_invoice.workshop_id
  ) then
    raise exception 'customer does not belong to invoice workshop' using errcode = 'P0001';
  end if;

  if not exists (
    select 1 from public.customers c
    where c.id = v_invoice.customer_id
      and c.is_active = true
  ) then
    raise exception 'customer is not active' using errcode = 'P0001';
  end if;

  if length(btrim(p_payment_method)) = 0 then
    raise exception 'payment method is required' using errcode = 'P0001';
  end if;

  select * into v_settings
  from public.workshop_settings
  where workshop_id = v_invoice.workshop_id
  for update;

  if not found then
    raise exception 'workshop settings not found' using errcode = 'P0001';
  end if;

  v_assigned_number := v_settings.next_invoice_number;

  update public.invoices
  set status = 'issued',
      number = v_assigned_number,
      issued_at = now(),
      payment_method = p_payment_method,
      payment_instructions = p_payment_instructions
  where id = p_invoice_id;

  update public.workshop_settings
  set next_invoice_number = v_settings.next_invoice_number + 1
  where workshop_id = v_invoice.workshop_id;

  return v_assigned_number;
end;
$$;

revoke all on function public.issue_invoice(uuid, text, text) from public;
revoke all on function public.issue_invoice(uuid, text, text) from anon;
grant execute on function public.issue_invoice(uuid, text, text) to authenticated;
