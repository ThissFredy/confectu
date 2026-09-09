-- H2: mutaciones de borradores atomicas via RPC SECURITY DEFINER.
--
-- Antes la aplicacion hacia insert/delete/update en varias peticiones
-- separadas: un fallo intermedio dejaba borradores huerfanos o borraba lineas
-- sin reponerlas. Las funciones siguientes ejecutan todo en una sola
-- transaccion de Postgres: o se guarda completo, o no se guarda nada.

create or replace function public.validate_invoice_draft_payload(
  p_workshop_id uuid,
  p_customer_id uuid,
  p_lines jsonb,
  p_adjustments jsonb,
  out o_subtotal numeric,
  out o_total_adjustments numeric,
  out o_total numeric,
  out o_amounts numeric[],
  out o_bases numeric[],
  out o_effects public.adjustment_effect[]
)
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_lines jsonb := coalesce(p_lines, '[]'::jsonb);
  v_adjustments jsonb := coalesce(p_adjustments, '[]'::jsonb);
  v_line_count int := jsonb_array_length(v_lines);
  v_adj_count int := jsonb_array_length(v_adjustments);
  v_customer_workshop uuid;
  v_line jsonb;
  v_adj jsonb;
  v_label text;
  v_category text;
  v_mode text;
  v_quantity numeric;
  v_price numeric;
  v_value numeric;
  v_base numeric;
  v_amount numeric;
  v_effect public.adjustment_effect;
  v_running numeric := 0;
  v_pos_adj numeric := 0;
  v_neg_adj numeric := 0;
  i int;
begin
  o_subtotal := 0;
  o_total_adjustments := 0;
  o_total := 0;
  o_amounts := '{}';
  o_bases := '{}';
  o_effects := '{}';

  select c.workshop_id into v_customer_workshop
  from public.customers c
  where c.id = p_customer_id;

  if v_customer_workshop is null or v_customer_workshop <> p_workshop_id then
    raise exception 'customer does not belong to workshop' using errcode = 'P0001';
  end if;

  if v_line_count < 1 or v_line_count > 50 then
    raise exception 'invalid invoice lines' using errcode = 'P0001';
  end if;

  if v_adj_count > 20 then
    raise exception 'invalid invoice adjustments' using errcode = 'P0001';
  end if;

  i := 0;
  while i < v_line_count loop
    v_line := v_lines -> i;
    v_label := coalesce(btrim(v_line->>'description'), '');
    v_quantity := coalesce((v_line->>'quantity')::numeric, -1);
    v_price := coalesce((v_line->>'unit_price_cop')::numeric, -1);

    if v_label = '' or length(v_label) > 500
      or v_quantity <= 0 or v_quantity > 9999999.99 or round(v_quantity, 2) <> v_quantity
      or v_price < 0 or v_price > 9999999999.99 or round(v_price, 2) <> v_price then
      raise exception 'invalid invoice lines' using errcode = 'P0001';
    end if;

    if nullif(btrim(v_line->>'service_id'), '') is not null and not exists (
      select 1 from public.services s
      where s.id = nullif(btrim(v_line->>'service_id'), '')::uuid
        and s.workshop_id = p_workshop_id
    ) then
      raise exception 'service does not belong to workshop' using errcode = 'P0001';
    end if;

    o_subtotal := o_subtotal + v_quantity * v_price;
    i := i + 1;
  end loop;

  v_running := o_subtotal;
  i := 0;
  while i < v_adj_count loop
    v_adj := v_adjustments -> i;
    v_label := coalesce(btrim(v_adj->>'label'), '');
    v_category := v_adj->>'category';
    v_mode := v_adj->>'mode';
    v_value := coalesce((v_adj->>'value')::numeric, -1);

    if v_label = '' or length(v_label) > 100
      or v_category not in ('tax', 'withholding', 'discount', 'fee')
      or v_mode not in ('percentage', 'fixed')
      or v_value < 0 or round(v_value, 2) <> v_value
      or (v_mode = 'percentage' and v_value > 100) then
      raise exception 'invalid invoice adjustments' using errcode = 'P0001';
    end if;

    if v_mode = 'percentage' then
      v_base := case when i = 0 then o_subtotal else v_running end;
      v_amount := v_base * v_value / 100;
    else
      v_base := 0;
      v_amount := v_value;
    end if;

    v_effect := case when v_category in ('tax', 'fee') then 'add' else 'subtract' end;

    if v_effect = 'add' then
      v_running := v_running + v_amount;
      v_pos_adj := v_pos_adj + v_amount;
    else
      v_running := v_running - v_amount;
      v_neg_adj := v_neg_adj + v_amount;
    end if;

    o_amounts := array_append(o_amounts, v_amount);
    o_bases := array_append(o_bases, v_base);
    o_effects := array_append(o_effects, v_effect);

    i := i + 1;
  end loop;

  if v_running < 0 then
    raise exception 'invoice total cannot be negative' using errcode = 'P0001';
  end if;

  o_total := v_running;
  o_total_adjustments := v_pos_adj - v_neg_adj;
end;
$$;

revoke all on function public.validate_invoice_draft_payload(uuid, uuid, jsonb, jsonb) from public;
revoke all on function public.validate_invoice_draft_payload(uuid, uuid, jsonb, jsonb) from anon;
revoke all on function public.validate_invoice_draft_payload(uuid, uuid, jsonb, jsonb) from authenticated;

create or replace function public.create_invoice_draft(
  p_customer_id uuid,
  p_payment_method text,
  p_payment_instructions text,
  p_notes text,
  p_lines jsonb,
  p_adjustments jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_workshop_id uuid;
  v_lines jsonb := coalesce(p_lines, '[]'::jsonb);
  v_adjustments jsonb := coalesce(p_adjustments, '[]'::jsonb);
  v_line jsonb;
  v_adj jsonb;
  v_subtotal numeric;
  v_total_adjustments numeric;
  v_total numeric;
  v_amounts numeric[];
  v_bases numeric[];
  v_effects public.adjustment_effect[];
  v_invoice_id uuid;
  i int;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = 'P0001';
  end if;

  select w.id into v_workshop_id
  from public.workshops w
  where w.owner_id = v_user
  limit 1;

  if v_workshop_id is null then
    raise exception 'workshop not found' using errcode = 'P0001';
  end if;

  if p_payment_method is not null and length(p_payment_method) > 50 then
    raise exception 'invalid payment method' using errcode = 'P0001';
  end if;

  if p_payment_instructions is not null and length(p_payment_instructions) > 1000 then
    raise exception 'invalid payment instructions' using errcode = 'P0001';
  end if;

  if p_notes is not null and length(p_notes) > 2000 then
    raise exception 'invalid notes' using errcode = 'P0001';
  end if;

  select * from public.validate_invoice_draft_payload(
    v_workshop_id, p_customer_id, v_lines, v_adjustments
  ) into v_subtotal, v_total_adjustments, v_total, v_amounts, v_bases, v_effects;

  insert into public.invoices (
    workshop_id, customer_id, status, currency,
    subtotal_cop, total_adjustments_cop, total_cop,
    payment_method, payment_instructions, notes
  ) values (
    v_workshop_id, p_customer_id, 'draft', 'COP',
    v_subtotal, v_total_adjustments, v_total,
    p_payment_method, p_payment_instructions, p_notes
  )
  returning id into v_invoice_id;

  i := 0;
  while i < jsonb_array_length(v_lines) loop
    v_line := v_lines -> i;
    insert into public.invoice_lines (
      invoice_id, service_id, description_snapshot,
      quantity, unit_price_cop, line_total_cop
    ) values (
      v_invoice_id,
      nullif(btrim(v_line->>'service_id'), '')::uuid,
      btrim(v_line->>'description'),
      (v_line->>'quantity')::numeric,
      (v_line->>'unit_price_cop')::numeric,
      (v_line->>'quantity')::numeric * (v_line->>'unit_price_cop')::numeric
    );
    i := i + 1;
  end loop;

  i := 0;
  while i < jsonb_array_length(v_adjustments) loop
    v_adj := v_adjustments -> i;
    insert into public.invoice_adjustments (
      invoice_id, label, category, mode, value,
      base_cop, amount_cop, effect, sort_order
    ) values (
      v_invoice_id,
      btrim(v_adj->>'label'),
      (v_adj->>'category')::public.adjustment_category,
      (v_adj->>'mode')::public.adjustment_mode,
      (v_adj->>'value')::numeric,
      v_bases[i + 1],
      v_amounts[i + 1],
      v_effects[i + 1],
      i
    );
    i := i + 1;
  end loop;

  return v_invoice_id;
end;
$$;

revoke all on function public.create_invoice_draft(uuid, text, text, text, jsonb, jsonb) from public;
revoke all on function public.create_invoice_draft(uuid, text, text, text, jsonb, jsonb) from anon;
grant execute on function public.create_invoice_draft(uuid, text, text, text, jsonb, jsonb) to authenticated;

create or replace function public.update_invoice_draft(
  p_invoice_id uuid,
  p_customer_id uuid,
  p_payment_method text,
  p_payment_instructions text,
  p_notes text,
  p_lines jsonb,
  p_adjustments jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user uuid := auth.uid();
  v_workshop_id uuid;
  v_invoice public.invoices%rowtype;
  v_lines jsonb := coalesce(p_lines, '[]'::jsonb);
  v_adjustments jsonb := coalesce(p_adjustments, '[]'::jsonb);
  v_line jsonb;
  v_adj jsonb;
  v_subtotal numeric;
  v_total_adjustments numeric;
  v_total numeric;
  v_amounts numeric[];
  v_bases numeric[];
  v_effects public.adjustment_effect[];
  i int;
begin
  if v_user is null then
    raise exception 'not authenticated' using errcode = 'P0001';
  end if;

  select w.id into v_workshop_id
  from public.workshops w
  where w.owner_id = v_user
  limit 1;

  if v_workshop_id is null then
    raise exception 'workshop not found' using errcode = 'P0001';
  end if;

  select * into v_invoice
  from public.invoices
  where id = p_invoice_id
  for update;

  if not found then
    raise exception 'invoice not found' using errcode = 'P0001';
  end if;

  if v_workshop_id <> v_invoice.workshop_id then
    raise exception 'invoice does not belong to caller workshop' using errcode = 'P0001';
  end if;

  if v_invoice.status <> 'draft' then
    raise exception 'only draft invoices can be updated' using errcode = 'P0001';
  end if;

  if p_payment_method is not null and length(p_payment_method) > 50 then
    raise exception 'invalid payment method' using errcode = 'P0001';
  end if;

  if p_payment_instructions is not null and length(p_payment_instructions) > 1000 then
    raise exception 'invalid payment instructions' using errcode = 'P0001';
  end if;

  if p_notes is not null and length(p_notes) > 2000 then
    raise exception 'invalid notes' using errcode = 'P0001';
  end if;

  select * from public.validate_invoice_draft_payload(
    v_workshop_id, p_customer_id, v_lines, v_adjustments
  ) into v_subtotal, v_total_adjustments, v_total, v_amounts, v_bases, v_effects;

  delete from public.invoice_adjustments where invoice_id = p_invoice_id;
  delete from public.invoice_lines where invoice_id = p_invoice_id;

  update public.invoices
  set customer_id = p_customer_id,
      subtotal_cop = v_subtotal,
      total_adjustments_cop = v_total_adjustments,
      total_cop = v_total,
      payment_method = p_payment_method,
      payment_instructions = p_payment_instructions,
      notes = p_notes,
      updated_at = now()
  where id = p_invoice_id;

  i := 0;
  while i < jsonb_array_length(v_lines) loop
    v_line := v_lines -> i;
    insert into public.invoice_lines (
      invoice_id, service_id, description_snapshot,
      quantity, unit_price_cop, line_total_cop
    ) values (
      p_invoice_id,
      nullif(btrim(v_line->>'service_id'), '')::uuid,
      btrim(v_line->>'description'),
      (v_line->>'quantity')::numeric,
      (v_line->>'unit_price_cop')::numeric,
      (v_line->>'quantity')::numeric * (v_line->>'unit_price_cop')::numeric
    );
    i := i + 1;
  end loop;

  i := 0;
  while i < jsonb_array_length(v_adjustments) loop
    v_adj := v_adjustments -> i;
    insert into public.invoice_adjustments (
      invoice_id, label, category, mode, value,
      base_cop, amount_cop, effect, sort_order
    ) values (
      p_invoice_id,
      btrim(v_adj->>'label'),
      (v_adj->>'category')::public.adjustment_category,
      (v_adj->>'mode')::public.adjustment_mode,
      (v_adj->>'value')::numeric,
      v_bases[i + 1],
      v_amounts[i + 1],
      v_effects[i + 1],
      i
    );
    i := i + 1;
  end loop;

  return p_invoice_id;
end;
$$;

revoke all on function public.update_invoice_draft(uuid, uuid, text, text, text, jsonb, jsonb) from public;
revoke all on function public.update_invoice_draft(uuid, uuid, text, text, text, jsonb, jsonb) from anon;
grant execute on function public.update_invoice_draft(uuid, uuid, text, text, text, jsonb, jsonb) to authenticated;

comment on function public.create_invoice_draft(uuid, text, text, text, jsonb, jsonb) is
  'Crea una factura draft con sus lineas y ajustes de forma atomica. Valida afinidad cliente/taller y servicios, y recalcula totales.';
comment on function public.update_invoice_draft(uuid, uuid, text, text, text, jsonb, jsonb) is
  'Actualiza una factura draft (lineas y ajustes incluidos) de forma atomica con validaciones y totales recalculados.';
