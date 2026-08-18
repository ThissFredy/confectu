# Confectu: diccionario de datos

Modelo PostgreSQL para el MVP sobre Supabase. Cada taller solo puede acceder a
sus clientes, servicios y facturas mediante RLS. Supabase crea y administra
`auth.users`; la aplicación crea `public.profiles` relacionado por `id`.

Fuera del MVP: facturación electrónica, DIAN, pagos en línea, inventario,
órdenes de trabajo y múltiples usuarios por taller.

## Convenciones

- UUID como PK con `gen_random_uuid()`; nombres físicos en `snake_case`.
- `created_at` y `updated_at`: `timestamptz` UTC; presentación en `America/Bogota`.
- Dinero en COP como `numeric(12,2)`, máximo funcional `9,999,999,999.99`.
- Cantidad por línea: `> 0` y `<= 9,999,999.99`.
- Porcentajes: `0` a `100`; total de factura: `>= 0`.
- Estados y categorías: `ENUM`.
- Las validaciones se aplican en PostgreSQL y Server Actions; nunca se confían
  precios, IDs, talleres ni totales enviados por el navegador.
- `CLIENT` es el propietario del taller; `customer` es una persona atendida.
- Clientes, servicios y talleres se desactivan lógicamente.
- `draft` puede editarse o eliminarse; `issued` es inmutable; `void` conserva
  los datos y solo puede recibirse desde `issued`.
- El número se reserva al emitir, es secuencial por taller y se muestra sin
  padding: `TAL-1`, `TAL-455633`.
- `ADMIN` puede consultar y administrar perfiles, talleres, configuración y
  clientes de todos los talleres. No puede consultar facturas ni `services`.

## Modelo relacional

```text
auth.users 1──1 profiles 1──1 workshops
                         │
                         ├──1 workshop_settings
                         ├──N customers
                         ├──N services
                         └──N invoices

document_types 1──N customers
customers 1──N invoices
invoices 1──N invoice_lines
invoices 1──N invoice_adjustments
services 1──N invoice_lines (referencia opcional)
```

`invoice_lines` conserva descripción, cantidad y precio. `invoices` conserva
snapshots del cliente y de las instrucciones de pago para no alterar el
historial cuando cambien los registros originales.

## Diccionario de datos

### `profiles`

Perfil de `auth.users`. `id` es FK a `auth.users(id)` con `ON DELETE CASCADE`.

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | `uuid` | PK, FK a `auth.users(id)` |
| `role` | `profile_role` | `ADMIN` o `CLIENT`; default `CLIENT` |
| `is_active` | `boolean` | Not null; default `true` |
| `created_at`, `updated_at` | `timestamptz` | Not null; default `now()` |

El rol no se recibe desde formularios. `owner_id` solo puede referenciar un
perfil `CLIENT`.

### `workshops`

Cuenta de negocio y límite de aislamiento multi-tenant.

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | `uuid` | PK |
| `owner_id` | `uuid` | FK a `profiles(id)`; unique; not null |
| `is_active` | `boolean` | Not null; default `true` |
| `created_at`, `updated_at` | `timestamptz` | Not null; default `now()` |

### `workshop_settings`

Una fila por taller. `logo_path` es una ruta privada en Storage.

| Campo | Tipo | Reglas |
|---|---|---|
| `workshop_id` | `uuid` | PK, FK a `workshops(id)`; `ON DELETE CASCADE` |
| `business_name` | `text` | Not null |
| `tax_id`, `phone`, `email`, `address` | `text` | Opcionales |
| `invoice_prefix` | `varchar(3)` | 1 a 3 caracteres alfanuméricos en mayúscula |
| `next_invoice_number` | `bigint` | Not null; `>= 1` |
| `payment_instructions`, `logo_path` | `text` | Opcionales |
| `created_at`, `updated_at` | `timestamptz` | Not null; default `now()` |

### `document_types`

Catálogo global administrado por `ADMIN`; los talleres consultan tipos activos.

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | `uuid` | PK |
| `code` | `text` | Not null; unique global |
| `name` | `text` | Not null |
| `is_active` | `boolean` | Not null; default `true` |
| `created_at`, `updated_at` | `timestamptz` | Not null; default `now()` |

### `customers`

Personas atendidas por un taller. Índice recomendado:
`(workshop_id, is_active, name)`.

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | `uuid` | PK |
| `workshop_id` | `uuid` | FK a `workshops(id)`; not null |
| `name` | `text` | Not null y no vacío |
| `document_type_id` | `uuid` | FK opcional a `document_types(id)` |
| `document_number`, `phone`, `email`, `address`, `notes` | `text` | Opcionales; documento no es globalmente único |
| `is_active` | `boolean` | Not null; default `true` |
| `created_at`, `updated_at` | `timestamptz` | Not null; default `now()` |

El tipo de documento debe estar activo al crear o editar el cliente.

### `services`

Catálogo de servicios o prendas reutilizables. Índice recomendado:
`(workshop_id, is_active, name)`.

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | `uuid` | PK |
| `workshop_id` | `uuid` | FK a `workshops(id)`; not null |
| `name` | `text` | Not null y no vacío |
| `description`, `category` | `text` | Opcionales |
| `default_price_cop` | `numeric(12,2)` | Not null; `>= 0` |
| `is_active` | `boolean` | Not null; default `true` |
| `created_at`, `updated_at` | `timestamptz` | Not null; default `now()` |

### `invoices`

Cabecera y estado histórico. Índices: `(workshop_id, created_at DESC)` y
`(workshop_id, status, issued_at DESC)`. Unicidad parcial en
`(workshop_id, number)` cuando `number IS NOT NULL`.

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | `uuid` | PK |
| `workshop_id`, `customer_id` | `uuid` | FK a `workshops` y `customers`; not null |
| `number` | `bigint` | Null en `draft`; único por taller al emitir |
| `status` | `invoice_status` | `draft`, `issued` o `void`; default `draft` |
| `currency` | `char(3)` | Not null; solo `COP` |
| `issued_at` | `timestamptz` | Null en `draft` |
| `customer_name_snapshot` | `text` | Null en `draft`; obligatorio al emitir |
| `customer_document_snapshot`, `customer_contact_snapshot` | `text` | Opcionales |
| `subtotal_cop`, `total_adjustments_cop`, `total_cop` | `numeric(12,2)` | Calculados server-side; total `>= 0` |
| `payment_method`, `payment_instructions`, `notes` | `text` | Opcionales; instrucciones son snapshot |
| `voided_at` | `timestamptz` | Solo en `void` |
| `created_at`, `updated_at` | `timestamptz` | Not null; default `now()` |

El taller y el cliente deben estar activos al emitir. Un cliente desactivado no
afecta las facturas históricas.

### `invoice_lines`

Detalle congelado. `service_id` es opcional para líneas personalizadas.

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | `uuid` | PK |
| `invoice_id` | `uuid` | FK a `invoices(id)`; `ON DELETE CASCADE` |
| `service_id` | `uuid` | FK opcional a `services(id)` del mismo taller |
| `description_snapshot` | `text` | Not null y no vacío |
| `quantity` | `numeric(12,2)` | `> 0` y `<= 9,999,999.99` |
| `unit_price_cop` | `numeric(12,2)` | `>= 0` |
| `line_total_cop` | `numeric(12,2)` | `quantity * unit_price_cop`, server-side |
| `created_at` | `timestamptz` | Not null; default `now()` |

### `invoice_adjustments`

Ajustes aplicados en `sort_order` sobre el subtotal o resultado anterior.

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | `uuid` | PK |
| `invoice_id` | `uuid` | FK a `invoices(id)`; `ON DELETE CASCADE` |
| `label` | `text` | Not null |
| `category` | `adjustment_category` | `tax`, `withholding`, `discount`, `fee` |
| `mode` | `adjustment_mode` | `percentage` o `fixed` |
| `value` | `numeric(12,2)` | `>= 0`; porcentajes `<= 100` |
| `base_cop`, `amount_cop` | `numeric(12,2)` | Calculados y congelados server-side |
| `effect` | `adjustment_effect` | `add` o `subtract` |
| `sort_order` | `integer` | Not null |
| `created_at` | `timestamptz` | Not null; default `now()` |

Fórmula: `subtotal + ajustes positivos - ajustes negativos`. El total nunca
puede ser negativo.

## DBML para dbdiagram.io

```dbml
Table auth_users {
  id uuid [pk]
}

Enum profile_role {
  ADMIN
  CLIENT
}

Enum invoice_status {
  draft
  issued
  void
}

Enum adjustment_category {
  tax
  withholding
  discount
  fee
}

Enum adjustment_mode {
  percentage
  fixed
}

Enum adjustment_effect {
  add
  subtract
}

Table profiles {
  id uuid [pk, ref: > auth_users.id]
  role profile_role [not null, default: 'CLIENT']
  is_active boolean [not null, default: true]
  created_at timestamptz [not null]
  updated_at timestamptz [not null]
}

Table workshops {
  id uuid [pk]
  owner_id uuid [not null, unique, ref: > profiles.id]
  is_active boolean [not null, default: true]
  created_at timestamptz [not null]
  updated_at timestamptz [not null]
}

Table workshop_settings {
  workshop_id uuid [pk, ref: > workshops.id]
  business_name text [not null]
  tax_id text
  phone text
  email text
  address text
  invoice_prefix varchar(3) [not null]
  next_invoice_number bigint [not null, default: 1]
  payment_instructions text
  logo_path text
  created_at timestamptz [not null]
  updated_at timestamptz [not null]
}

Table document_types {
  id uuid [pk]
  code text [not null, unique]
  name text [not null]
  is_active boolean [not null, default: true]
  created_at timestamptz [not null]
  updated_at timestamptz [not null]
}

Table customers {
  id uuid [pk]
  workshop_id uuid [not null, ref: > workshops.id]
  name text [not null]
  document_type_id uuid [ref: > document_types.id]
  document_number text
  phone text
  email text
  address text
  notes text
  is_active boolean [not null, default: true]
  created_at timestamptz [not null]
  updated_at timestamptz [not null]
  Indexes { (workshop_id, is_active, name) }
}

Table services {
  id uuid [pk]
  workshop_id uuid [not null, ref: > workshops.id]
  name text [not null]
  description text
  category text
  default_price_cop numeric(12,2) [not null]
  is_active boolean [not null, default: true]
  created_at timestamptz [not null]
  updated_at timestamptz [not null]
  Indexes { (workshop_id, is_active, name) }
}

Table invoices {
  id uuid [pk]
  workshop_id uuid [not null, ref: > workshops.id]
  customer_id uuid [not null, ref: > customers.id]
  number bigint
  status invoice_status [not null, default: 'draft']
  currency char(3) [not null, default: 'COP']
  issued_at timestamptz
  customer_name_snapshot text
  customer_document_snapshot text
  customer_contact_snapshot text
  subtotal_cop numeric(12,2) [not null]
  total_adjustments_cop numeric(12,2) [not null]
  total_cop numeric(12,2) [not null]
  payment_method text
  payment_instructions text
  notes text
  voided_at timestamptz
  created_at timestamptz [not null]
  updated_at timestamptz [not null]
  Indexes {
    (workshop_id, created_at)
    (workshop_id, status, issued_at)
    (workshop_id, number) [unique, note: 'Aplicar cuando number no sea null']
  }
}

Table invoice_lines {
  id uuid [pk]
  invoice_id uuid [not null, ref: > invoices.id]
  service_id uuid [ref: > services.id]
  description_snapshot text [not null]
  quantity numeric(12,2) [not null]
  unit_price_cop numeric(12,2) [not null]
  line_total_cop numeric(12,2) [not null]
  created_at timestamptz [not null]
}

Table invoice_adjustments {
  id uuid [pk]
  invoice_id uuid [not null, ref: > invoices.id]
  label text [not null]
  category adjustment_category [not null]
  mode adjustment_mode [not null]
  value numeric(12,2) [not null]
  base_cop numeric(12,2) [not null]
  amount_cop numeric(12,2) [not null]
  effect adjustment_effect [not null]
  sort_order int [not null]
  created_at timestamptz [not null]
}
```
