-- Confectu: inicialización del esquema
-- Modelo PostgreSQL multi-tenant para talleres de confección.
-- Aislamiento por taller mediante RLS. Ver docs/database.md.

-- ============================================================================
-- ENUMS
-- ============================================================================

create type public.profile_role as enum ('ADMIN', 'CLIENT');

create type public.invoice_status as enum ('draft', 'issued', 'void');

create type public.adjustment_category as enum ('tax', 'withholding', 'discount', 'fee');

create type public.adjustment_mode as enum ('percentage', 'fixed');

create type public.adjustment_effect as enum ('add', 'subtract');

-- ============================================================================
-- TABLAS
-- ============================================================================

-- profiles: perfil de auth.users. 1:1 con workshops a través de owner_id.
create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  role public.profile_role not null default 'CLIENT',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_id_fkey
    foreign key (id) references auth.users(id) on delete cascade
);

comment on table public.profiles is 'Perfil de auth.users. CLIENT es propietario de un taller.';
comment on column public.profiles.role is 'ADMIN administra platforma; CLIENT es propietario de taller.';

-- workshops: cuenta de negocio y límite de aislamiento multi-tenant.
create table public.workshops (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workshops_owner_id_fkey
    foreign key (owner_id) references public.profiles(id) on delete restrict
);

comment on table public.workshops is 'Cuenta de negocio. Límite de aislamiento multi-tenant.';
comment on column public.workshops.owner_id is 'FK a profiles. Solo puede referenciar un perfil CLIENT activo.';

-- workshop_settings: una fila por taller.
create table public.workshop_settings (
  workshop_id uuid primary key,
  business_name text not null,
  tax_id text,
  phone text,
  email text,
  address text,
  invoice_prefix varchar(3) not null,
  next_invoice_number bigint not null default 1,
  payment_instructions text,
  logo_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint workshop_settings_workshop_id_fkey
    foreign key (workshop_id) references public.workshops(id) on delete cascade,
  constraint workshop_settings_invoice_prefix_check
    check (invoice_prefix ~ '^[A-Z0-9]{1,3}$'),
  constraint workshop_settings_next_invoice_number_check
    check (next_invoice_number >= 1)
);

comment on table public.workshop_settings is 'Configuración del taller. logo_path es ruta privada en Storage.';
comment on column public.workshop_settings.invoice_prefix is '1 a 3 caracteres alfanuméricos en mayúscula.';
comment on column public.workshop_settings.next_invoice_number is 'Secuencia por taller. >= 1.';

-- document_types: catálogo global administrado por ADMIN.
create table public.document_types (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.document_types is 'Catálogo global administrado por ADMIN. Los talleres consultan tipos activos.';

-- customers: personas atendidas por un taller.
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null,
  name text not null,
  document_type_id uuid,
  document_number text,
  phone text,
  email text,
  address text,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customers_workshop_id_fkey
    foreign key (workshop_id) references public.workshops(id) on delete restrict,
  constraint customers_document_type_id_fkey
    foreign key (document_type_id) references public.document_types(id) on delete restrict,
  constraint customers_name_not_empty
    check (length(btrim(name)) > 0)
);

comment on table public.customers is 'Personas atendidas por un taller. Desactivación lógica.';
comment on column public.customers.document_type_id is 'FK opcional. Debe estar activo al crear o editar el cliente.';

-- services: catálogo de servicios o prendas reutilizables.
create table public.services (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null,
  name text not null,
  description text,
  category text,
  default_price_cop numeric(12,2) not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint services_workshop_id_fkey
    foreign key (workshop_id) references public.workshops(id) on delete restrict,
  constraint services_name_not_empty
    check (length(btrim(name)) > 0),
  constraint services_default_price_cop_nonneg
    check (default_price_cop >= 0)
);

comment on table public.services is 'Catálogo de servicios o prendas. Desactivación lógica.';
comment on column public.services.default_price_cop is 'Precio COP >= 0.';

-- invoices: cabecera y estado histórico. Snapsots del cliente e instrucciones de pago.
create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  workshop_id uuid not null,
  customer_id uuid not null,
  number bigint,
  status public.invoice_status not null default 'draft',
  currency char(3) not null default 'COP',
  issued_at timestamptz,
  customer_name_snapshot text,
  customer_document_snapshot text,
  customer_contact_snapshot text,
  subtotal_cop numeric(12,2) not null default 0,
  total_adjustments_cop numeric(12,2) not null default 0,
  total_cop numeric(12,2) not null default 0,
  payment_method text,
  payment_instructions text,
  notes text,
  voided_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invoices_workshop_id_fkey
    foreign key (workshop_id) references public.workshops(id) on delete restrict,
  constraint invoices_customer_id_fkey
    foreign key (customer_id) references public.customers(id) on delete restrict,
  constraint invoices_currency_check
    check (currency = 'COP'),
  constraint invoices_total_cop_nonneg
    check (total_cop >= 0),
  constraint invoices_number_draft_check
    check ((status = 'draft' and number is null) or (status <> 'draft' and number is not null)),
  constraint invoices_issued_at_check
    check ((status = 'draft' and issued_at is null) or (status <> 'draft' and issued_at is not null)),
  constraint invoices_voided_at_check
    check ((status = 'void' and voided_at is not null) or (status <> 'void' and voided_at is null)),
  constraint invoices_customer_name_snapshot_check
    check ((status = 'draft' and customer_name_snapshot is null) or (status <> 'draft' and customer_name_snapshot is not null))
);

comment on table public.invoices is 'Cabecera de factura. draft editable; issued inmutable; void solo desde issued.';
comment on column public.invoices.number is 'Null en draft. Secuencial por taller al emitir. Sin padding.';
comment on column public.invoices.customer_name_snapshot is 'Snapshot del cliente al emitir. Conserva historial.';
comment on column public.invoices.payment_instructions is 'Snapshot de instrucciones de pago al emitir.';

-- invoice_lines: detalle congelado. service_id opcional para líneas personalizadas.
create table public.invoice_lines (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null,
  service_id uuid,
  description_snapshot text not null,
  quantity numeric(12,2) not null,
  unit_price_cop numeric(12,2) not null,
  line_total_cop numeric(12,2) not null,
  created_at timestamptz not null default now(),
  constraint invoice_lines_invoice_id_fkey
    foreign key (invoice_id) references public.invoices(id) on delete cascade,
  constraint invoice_lines_service_id_fkey
    foreign key (service_id) references public.services(id) on delete restrict,
  constraint invoice_lines_description_not_empty
    check (length(btrim(description_snapshot)) > 0),
  constraint invoice_lines_quantity_check
    check (quantity > 0 and quantity <= 9999999.99),
  constraint invoice_lines_unit_price_cop_nonneg
    check (unit_price_cop >= 0),
  constraint invoice_lines_line_total_cop_nonneg
    check (line_total_cop >= 0)
);

comment on table public.invoice_lines is 'Detalle congelado de la factura.';
comment on column public.invoice_lines.service_id is 'FK opcional. Debe pertenecer al mismo taller que la factura.';
comment on column public.invoice_lines.line_total_cop is 'quantity * unit_price_cop. Calculado server-side.';

-- invoice_adjustments: ajustes aplicados en sort_order.
create table public.invoice_adjustments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null,
  label text not null,
  category public.adjustment_category not null,
  mode public.adjustment_mode not null,
  value numeric(12,2) not null,
  base_cop numeric(12,2) not null default 0,
  amount_cop numeric(12,2) not null default 0,
  effect public.adjustment_effect not null,
  sort_order integer not null,
  created_at timestamptz not null default now(),
  constraint invoice_adjustments_invoice_id_fkey
    foreign key (invoice_id) references public.invoices(id) on delete cascade,
  constraint invoice_adjustments_value_nonneg
    check (value >= 0),
  constraint invoice_adjustments_value_percentage_check
    check (mode <> 'percentage' or value <= 100),
  constraint invoice_adjustments_base_cop_nonneg
    check (base_cop >= 0),
  constraint invoice_adjustments_amount_cop_nonneg
    check (amount_cop >= 0)
);

comment on table public.invoice_adjustments is 'Ajustes aplicados en sort_order sobre el subtotal o resultado anterior.';
comment on column public.invoice_adjustments.base_cop is 'Base sobre la que se calculó el ajuste. Congelado server-side.';
comment on column public.invoice_adjustments.amount_cop is 'Monto COP resultante. Congelado server-side.';

-- ============================================================================
-- ÍNDICES
-- ============================================================================

create index customers_workshop_active_name_idx
  on public.customers (workshop_id, is_active, name);

create index services_workshop_active_name_idx
  on public.services (workshop_id, is_active, name);

create index invoices_workshop_created_at_idx
  on public.invoices (workshop_id, created_at desc);

create index invoices_workshop_status_issued_at_idx
  on public.invoices (workshop_id, status, issued_at desc);

-- Unicidad parcial: (workshop_id, number) solo cuando number no sea null.
create unique index invoices_workshop_number_unique_idx
  on public.invoices (workshop_id, number)
  where number is not null;

-- Índices sobre FKs no cubiertos arriba (CASCADE y JOINs rápidos).
create index workshops_owner_id_idx on public.workshops (owner_id);
create index customers_document_type_id_idx on public.customers (document_type_id);
create index invoices_customer_id_idx on public.invoices (customer_id);
create index invoice_lines_invoice_id_idx on public.invoice_lines (invoice_id);
create index invoice_lines_service_id_idx on public.invoice_lines (service_id);
create index invoice_adjustments_invoice_id_idx on public.invoice_adjustments (invoice_id);

-- ============================================================================
-- FUNCIONES DE APOYO
-- ============================================================================

-- is_admin(): true si el usuario autenticado actual es ADMIN activo.
create or replace function public.is_admin()
returns boolean
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'ADMIN'
      and is_active = true
  );
$$;

-- current_workshop_id(): id del taller del usuario autenticado actual.
create or replace function public.current_workshop_id()
returns uuid
language sql
stable
security invoker
set search_path = public, pg_temp
as $$
  select w.id
  from public.workshops w
  where w.owner_id = (select auth.uid())
  limit 1;
$$;

-- set_updated_at(): mantiene updated_at en cada update.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- handle_new_user(): crea perfil CLIENT al registrar usuario en auth.users.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, role, is_active)
  values (new.id, 'CLIENT', true);
  return new;
end;
$$;

-- validate_workshop_owner(): owner_id debe referenciar un perfil CLIENT activo.
create or replace function public.validate_workshop_owner()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  if not exists (
    select 1
    from public.profiles
    where id = new.owner_id
      and role = 'CLIENT'
      and is_active = true
  ) then
    raise exception 'workshop owner must be an active CLIENT profile';
  end if;
  return new;
end;
$$;

-- validate_invoice_line_service(): service_id (si existe) debe ser del mismo taller que la factura.
create or replace function public.validate_invoice_line_service()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  inv_workshop_id uuid;
  svc_workshop_id uuid;
begin
  select i.workshop_id into inv_workshop_id
    from public.invoices i
    where i.id = new.invoice_id;

  if inv_workshop_id is null then
    raise exception 'invoice_lines.invoice_id does not reference an existing invoice';
  end if;

  if new.service_id is not null then
    select s.workshop_id into svc_workshop_id
      from public.services s
      where s.id = new.service_id;

    if svc_workshop_id is null then
      raise exception 'invoice_lines.service_id does not reference an existing service';
    end if;

    if svc_workshop_id <> inv_workshop_id then
      raise exception 'invoice line service must belong to the same workshop as the invoice';
    end if;
  end if;

  return new;
end;
$$;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Crear perfil automáticamente al registrar usuario.
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Validar que owner_id sea CLIENT activo.
create trigger workshops_validate_owner
  before insert or update of owner_id on public.workshops
  for each row execute function public.validate_workshop_owner();

-- Validar que service_id sea del mismo taller que la factura.
create trigger invoice_lines_validate_service
  before insert or update of service_id, invoice_id on public.invoice_lines
  for each row execute function public.validate_invoice_line_service();

-- Mantener updated_at.
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create trigger workshops_set_updated_at
  before update on public.workshops
  for each row execute function public.set_updated_at();

create trigger workshop_settings_set_updated_at
  before update on public.workshop_settings
  for each row execute function public.set_updated_at();

create trigger document_types_set_updated_at
  before update on public.document_types
  for each row execute function public.set_updated_at();

create trigger customers_set_updated_at
  before update on public.customers
  for each row execute function public.set_updated_at();

create trigger services_set_updated_at
  before update on public.services
  for each row execute function public.set_updated_at();

create trigger invoices_set_updated_at
  before update on public.invoices
  for each row execute function public.set_updated_at();

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- profiles: el usuario gestiona su perfil; ADMIN gestiona todos.
alter table public.profiles enable row level security;

create policy profiles_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or public.is_admin());

create policy profiles_update on public.profiles
  for update to authenticated
  using (id = (select auth.uid()) or public.is_admin())
  with check (id = (select auth.uid()) or public.is_admin());

-- workshops: el owner gestiona su taller; ADMIN gestiona todos.
alter table public.workshops enable row level security;

create policy workshops_select on public.workshops
  for select to authenticated
  using (owner_id = (select auth.uid()) or public.is_admin());

create policy workshops_insert on public.workshops
  for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy workshops_update on public.workshops
  for update to authenticated
  using (owner_id = (select auth.uid()) or public.is_admin())
  with check (owner_id = (select auth.uid()) or public.is_admin());

create policy workshops_delete on public.workshops
  for delete to authenticated
  using (public.is_admin());

-- workshop_settings: el owner del taller; ADMIN gestiona todas.
alter table public.workshop_settings enable row level security;

create policy workshop_settings_select on public.workshop_settings
  for select to authenticated
  using (workshop_id = public.current_workshop_id() or public.is_admin());

create policy workshop_settings_insert on public.workshop_settings
  for insert to authenticated
  with check (workshop_id = public.current_workshop_id() or public.is_admin());

create policy workshop_settings_update on public.workshop_settings
  for update to authenticated
  using (workshop_id = public.current_workshop_id() or public.is_admin())
  with check (workshop_id = public.current_workshop_id() or public.is_admin());

create policy workshop_settings_delete on public.workshop_settings
  for delete to authenticated
  using (public.is_admin());

-- document_types: autenticados consultan activos; solo ADMIN muta.
alter table public.document_types enable row level security;

create policy document_types_select on public.document_types
  for select to authenticated
  using (is_active = true or public.is_admin());

create policy document_types_insert on public.document_types
  for insert to authenticated
  with check (public.is_admin());

create policy document_types_update on public.document_types
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy document_types_delete on public.document_types
  for delete to authenticated
  using (public.is_admin());

-- customers: el owner del taller; ADMIN también (clientes de todos los talleres).
alter table public.customers enable row level security;

create policy customers_select on public.customers
  for select to authenticated
  using (workshop_id = public.current_workshop_id() or public.is_admin());

create policy customers_insert on public.customers
  for insert to authenticated
  with check (workshop_id = public.current_workshop_id() or public.is_admin());

create policy customers_update on public.customers
  for update to authenticated
  using (workshop_id = public.current_workshop_id() or public.is_admin())
  with check (workshop_id = public.current_workshop_id() or public.is_admin());

create policy customers_delete on public.customers
  for delete to authenticated
  using (workshop_id = public.current_workshop_id() or public.is_admin());

-- services: solo el owner del taller. ADMIN no puede consultar services.
alter table public.services enable row level security;

create policy services_select on public.services
  for select to authenticated
  using (workshop_id = public.current_workshop_id());

create policy services_insert on public.services
  for insert to authenticated
  with check (workshop_id = public.current_workshop_id());

create policy services_update on public.services
  for update to authenticated
  using (workshop_id = public.current_workshop_id())
  with check (workshop_id = public.current_workshop_id());

create policy services_delete on public.services
  for delete to authenticated
  using (workshop_id = public.current_workshop_id());

-- invoices: solo el owner del taller. ADMIN no puede consultar facturas.
alter table public.invoices enable row level security;

create policy invoices_select on public.invoices
  for select to authenticated
  using (workshop_id = public.current_workshop_id());

create policy invoices_insert on public.invoices
  for insert to authenticated
  with check (workshop_id = public.current_workshop_id());

create policy invoices_update on public.invoices
  for update to authenticated
  using (workshop_id = public.current_workshop_id())
  with check (workshop_id = public.current_workshop_id());

create policy invoices_delete on public.invoices
  for delete to authenticated
  using (workshop_id = public.current_workshop_id());

-- invoice_lines: hereda aislamiento vía invoice.workshop_id.
alter table public.invoice_lines enable row level security;

create policy invoice_lines_select on public.invoice_lines
  for select to authenticated
  using (
    invoice_id in (
      select i.id from public.invoices i
      where i.workshop_id = public.current_workshop_id()
    )
  );

create policy invoice_lines_insert on public.invoice_lines
  for insert to authenticated
  with check (
    invoice_id in (
      select i.id from public.invoices i
      where i.workshop_id = public.current_workshop_id()
    )
  );

create policy invoice_lines_update on public.invoice_lines
  for update to authenticated
  using (
    invoice_id in (
      select i.id from public.invoices i
      where i.workshop_id = public.current_workshop_id()
    )
  )
  with check (
    invoice_id in (
      select i.id from public.invoices i
      where i.workshop_id = public.current_workshop_id()
    )
  );

create policy invoice_lines_delete on public.invoice_lines
  for delete to authenticated
  using (
    invoice_id in (
      select i.id from public.invoices i
      where i.workshop_id = public.current_workshop_id()
    )
  );

-- invoice_adjustments: hereda aislamiento vía invoice.workshop_id.
alter table public.invoice_adjustments enable row level security;

create policy invoice_adjustments_select on public.invoice_adjustments
  for select to authenticated
  using (
    invoice_id in (
      select i.id from public.invoices i
      where i.workshop_id = public.current_workshop_id()
    )
  );

create policy invoice_adjustments_insert on public.invoice_adjustments
  for insert to authenticated
  with check (
    invoice_id in (
      select i.id from public.invoices i
      where i.workshop_id = public.current_workshop_id()
    )
  );

create policy invoice_adjustments_update on public.invoice_adjustments
  for update to authenticated
  using (
    invoice_id in (
      select i.id from public.invoices i
      where i.workshop_id = public.current_workshop_id()
    )
  )
  with check (
    invoice_id in (
      select i.id from public.invoices i
      where i.workshop_id = public.current_workshop_id()
    )
  );

create policy invoice_adjustments_delete on public.invoice_adjustments
  for delete to authenticated
  using (
    invoice_id in (
      select i.id from public.invoices i
      where i.workshop_id = public.current_workshop_id()
    )
  );

-- ============================================================================
-- PERMISOS (Data API)
-- Desde 2026-04-28 las tablas nuevas en public no se exponen automáticamente.
-- Se otorga acceso a authenticated; RLS controla el acceso por filas.
-- ============================================================================

grant usage on schema public to authenticated;

grant select, insert, update, delete on public.profiles to authenticated;
grant select, insert, update, delete on public.workshops to authenticated;
grant select, insert, update, delete on public.workshop_settings to authenticated;
grant select, insert, update, delete on public.document_types to authenticated;
grant select, insert, update, delete on public.customers to authenticated;
grant select, insert, update, delete on public.services to authenticated;
grant select, insert, update, delete on public.invoices to authenticated;
grant select, insert, update, delete on public.invoice_lines to authenticated;
grant select, insert, update, delete on public.invoice_adjustments to authenticated;
