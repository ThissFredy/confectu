-- Módulo 4.5: facturas sin snapshots de cliente, RLS de líneas/ajustes para ADMIN
-- y función atómica de emisión de facturas.

-- ============================================================================
-- 1. Eliminar snapshots del cliente en invoices
-- ============================================================================

alter table public.invoices
  drop constraint if exists invoices_customer_name_snapshot_check;

alter table public.invoices
  drop column if exists customer_name_snapshot,
  drop column if exists customer_document_snapshot,
  drop column if exists customer_contact_snapshot;

comment on table public.invoices is 'Cabecera de factura. draft editable; issued inmutable; void solo desde issued. Sin snapshots de cliente: los datos se consultan por customer_id.';

-- ============================================================================
-- 2. Actualizar RLS de invoice_lines e invoice_adjustments para ADMIN
-- ============================================================================

drop policy if exists invoice_lines_select on public.invoice_lines;

create policy invoice_lines_select on public.invoice_lines
  for select to authenticated
  using (
    invoice_id in (
      select i.id from public.invoices i
      where i.workshop_id = public.current_workshop_id()
         or public.is_admin()
    )
  );

drop policy if exists invoice_adjustments_select on public.invoice_adjustments;

create policy invoice_adjustments_select on public.invoice_adjustments
  for select to authenticated
  using (
    invoice_id in (
      select i.id from public.invoices i
      where i.workshop_id = public.current_workshop_id()
         or public.is_admin()
    )
  );

-- ============================================================================
-- 3. Función atómica de emisión de facturas
-- ============================================================================

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
  -- Validar sesión.
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = 'P0001';
  end if;

  -- Cargar la factura y bloquear la fila.
  select * into v_invoice
  from public.invoices
  where id = p_invoice_id
  for update;

  if not found then
    raise exception 'invoice not found' using errcode = 'P0001';
  end if;

  -- Validar que la factura pertenece al taller del usuario.
  select w.id into v_workshop_id
  from public.workshops w
  where w.owner_id = auth.uid()
  limit 1;

  if v_workshop_id is null or v_workshop_id <> v_invoice.workshop_id then
    raise exception 'invoice does not belong to caller workshop' using errcode = 'P0001';
  end if;

  -- Validar que la factura esté en draft.
  if v_invoice.status <> 'draft' then
    raise exception 'only draft invoices can be issued' using errcode = 'P0001';
  end if;

  -- Validar que el cliente esté activo.
  if not exists (
    select 1 from public.customers c
    where c.id = v_invoice.customer_id
      and c.is_active = true
  ) then
    raise exception 'customer is not active' using errcode = 'P0001';
  end if;

  -- Validar método de pago.
  if length(btrim(p_payment_method)) = 0 then
    raise exception 'payment method is required' using errcode = 'P0001';
  end if;

  -- Bloquear la fila de workshop_settings y reservar el consecutivo.
  select * into v_settings
  from public.workshop_settings
  where workshop_id = v_invoice.workshop_id
  for update;

  if not found then
    raise exception 'workshop settings not found' using errcode = 'P0001';
  end if;

  v_assigned_number := v_settings.next_invoice_number;

  -- Actualizar la factura a issued.
  update public.invoices
  set status = 'issued',
      number = v_assigned_number,
      issued_at = now(),
      payment_method = p_payment_method,
      payment_instructions = p_payment_instructions
  where id = p_invoice_id;

  -- Incrementar el consecutivo.
  update public.workshop_settings
  set next_invoice_number = v_settings.next_invoice_number + 1
  where workshop_id = v_invoice.workshop_id;

  return v_assigned_number;
end;
$$;

revoke all on function public.issue_invoice(uuid, text, text) from public;
revoke all on function public.issue_invoice(uuid, text, text) from anon;
grant execute on function public.issue_invoice(uuid, text, text) to authenticated;

comment on function public.issue_invoice(uuid, text, text) is
  'Emite una factura draft de forma atómica: valida, reserva el consecutivo y actualiza el estado.';
