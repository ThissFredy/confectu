# Confectu: documentación de base de datos

## 1. Propósito y alcance

Este documento define la estructura propuesta de PostgreSQL para el MVP de
Confectu sobre Supabase. La base de datos debe garantizar que cada taller solo
pueda consultar y modificar sus propios clientes, servicios y facturas.

El modelo cubre:

- autenticación y perfiles asociados a `auth.users`;
- talleres y su configuración comercial;
- clientes y tipos de documento;
- servicios reutilizables;
- facturas, líneas y ajustes;
- políticas RLS, funciones SQL y Supabase Storage para logos.

No cubre facturación electrónica, integración con la DIAN, pagos en línea,
inventario, órdenes de trabajo ni múltiples usuarios por taller.

## 2. Decisiones confirmadas

- Supabase Auth con Google OAuth es la única autenticación.
- Los roles globales son `ADMIN` y `CLIENT`.
- Cada usuario `CLIENT` tiene un único taller y cada taller tiene inicialmente
  un único propietario.
- Todo el dinero se maneja en COP con `numeric(12,2)` y se permiten centavos.
- Las fechas se almacenan como `timestamptz` y se presentan usando
  `America/Bogota`.
- Clientes, servicios y talleres se desactivan lógicamente; no se eliminan
  normalmente.
- Los borradores (`draft`) pueden editarse y eliminarse físicamente.
- Las facturas emitidas (`issued`) son inmutables y solo pueden anularse pasando
  a `void`.
- El número se reserva al emitir, es secuencial por taller y se muestra con el
  prefijo configurable del taller, por ejemplo `TAL-0001`.
- El PDF se genera bajo demanda y no se persiste como requisito del MVP.

## 3. Convenciones generales

- Las tablas de negocio usan UUID como clave primaria, generado con
  `gen_random_uuid()`.
- Las tablas usan `created_at` y `updated_at` como `timestamptz` en UTC.
- La aplicación convierte las fechas a `America/Bogota` para mostrarlas.
- Las entidades pertenecientes a un taller tienen `workshop_id` directo siempre
  que sea posible.
- Las restricciones de negocio se validan en PostgreSQL y también en Server
  Actions. Nunca se confían precios, IDs o totales enviados por el navegador.
- La nomenclatura física usa `snake_case`; los tipos TypeScript pueden usar
  `camelCase` mediante el mapeo de Supabase.
- Los estados y categorías deben representarse mediante tipos `ENUM`.

## 4. Modelo relacional

```text
auth.users
    1 ─── 1 profiles
    1 ─── 1 workshops (owner_id)

workshops
    1 ─── 1 workshop_settings
    1 ─── N customers
    1 ─── N services
    1 ─── N invoices

document_types
    1 ─── N customers

customers
    1 ─── N invoices

invoices
    1 ─── N invoice_lines
    1 ─── N invoice_adjustments

services
    1 ─── N invoice_lines (referencia opcional)
```

`invoice_lines` conserva una copia de la descripción y el precio. Por tanto,
una factura histórica no cambia si el servicio se edita o se desactiva.
`invoices` también conserva snapshots de los datos del cliente utilizados al
emitirla.

## 5. Tablas

### 5.1 `profiles`

Perfil global del usuario autenticado. `id` debe coincidir con
`auth.users.id`.

| Columna | Tipo | Reglas |
| --- | --- | --- |
| `id` | `uuid` | PK, FK a `auth.users(id)` con `ON DELETE CASCADE` |
| `role` | `text` | `ADMIN` o `CLIENT`, valor por defecto `CLIENT` |
| `is_active` | `boolean` | No nulo, por defecto `true` |
| `created_at` | `timestamptz` | No nulo, por defecto `now()` |
| `updated_at` | `timestamptz` | No nulo, por defecto `now()` |

El rol no puede recibirse desde un formulario ni modificarse mediante una
política de usuario `CLIENT`. La promoción a `ADMIN` debe realizarse mediante
migración o una operación administrativa protegida.

### 5.2 `workshops`

Cuenta de negocio y límite de aislamiento multi-tenant.

| Columna | Tipo | Reglas |
| --- | --- | --- |
| `id` | `uuid` | PK |
| `owner_id` | `uuid` | FK a `profiles(id)`, único, no nulo |
| `is_active` | `boolean` | No nulo, por defecto `true` |
| `created_at` | `timestamptz` | No nulo, por defecto `now()` |
| `updated_at` | `timestamptz` | No nulo, por defecto `now()` |

`owner_id` solo puede referenciar un perfil `CLIENT`. Esta regla debe
reforzarse en una función o trigger porque una FK no puede validar el valor de
otra columna por sí sola.

### 5.3 `workshop_settings`

Configuración comercial, con una única fila por taller.

| Columna | Tipo | Reglas |
| --- | --- | --- |
| `workshop_id` | `uuid` | PK y FK a `workshops(id)` con `ON DELETE CASCADE` |
| `business_name` | `text` | No nulo |
| `tax_id` | `text` | Opcional |
| `phone` | `text` | Opcional |
| `email` | `text` | Opcional |
| `address` | `text` | Opcional |
| `invoice_prefix` | `text` | No nulo, validado, por ejemplo `TAL` |
| `next_invoice_number` | `bigint` | No nulo, mayor o igual que `1` |
| `payment_instructions` | `text` | Opcional |
| `logo_path` | `text` | Opcional, ruta privada en Storage |
| `created_at` | `timestamptz` | No nulo, por defecto `now()` |
| `updated_at` | `timestamptz` | No nulo, por defecto `now()` |

El valor visible de una factura se construye como `invoice_prefix` más el
número secuencial con padding definido por la aplicación. El número secuencial
sigue siendo independiente por taller.

### 5.4 `document_types`

Catálogo global administrado por `ADMIN`.

| Columna | Tipo | Reglas |
| --- | --- | --- |
| `id` | `uuid` | PK |
| `code` | `text` | No nulo, único global |
| `name` | `text` | No nulo |
| `is_active` | `boolean` | No nulo, por defecto `true` |
| `created_at` | `timestamptz` | No nulo, por defecto `now()` |
| `updated_at` | `timestamptz` | No nulo, por defecto `now()` |

Los talleres pueden consultar tipos activos. Solo `ADMIN` puede crear,
editar o desactivar registros.

### 5.5 `customers`

Personas atendidas por un taller. No representan un rol de autenticación.

| Columna | Tipo | Reglas |
| --- | --- | --- |
| `id` | `uuid` | PK |
| `workshop_id` | `uuid` | FK a `workshops(id)`, no nulo |
| `name` | `text` | No nulo y no vacío |
| `document_type_id` | `uuid` | FK opcional a `document_types(id)` |
| `document_number` | `text` | Opcional; no es único globalmente |
| `phone` | `text` | Opcional |
| `email` | `text` | Opcional |
| `address` | `text` | Opcional |
| `notes` | `text` | Opcional |
| `is_active` | `boolean` | No nulo, por defecto `true` |
| `created_at` | `timestamptz` | No nulo, por defecto `now()` |
| `updated_at` | `timestamptz` | No nulo, por defecto `now()` |

Se recomienda un índice por `(workshop_id, is_active, name)`. El tipo de
documento debe pertenecer al catálogo global y estar activo al crear o editar
un cliente.

### 5.6 `services`

Catálogo de servicios o prendas reutilizables.

| Columna | Tipo | Reglas |
| --- | --- | --- |
| `id` | `uuid` | PK |
| `workshop_id` | `uuid` | FK a `workshops(id)`, no nulo |
| `name` | `text` | No nulo y no vacío |
| `description` | `text` | Opcional |
| `category` | `text` | Opcional |
| `default_price_cop` | `numeric(12,2)` | No nulo, mayor o igual que `0` |
| `is_active` | `boolean` | No nulo, por defecto `true` |
| `created_at` | `timestamptz` | No nulo, por defecto `now()` |
| `updated_at` | `timestamptz` | No nulo, por defecto `now()` |

El `service_id` de una línea es opcional para permitir líneas personalizadas.
El servicio referenciado debe pertenecer al mismo taller de la factura.

### 5.7 `invoices`

Cabecera y estado histórico del comprobante.

| Columna | Tipo | Reglas |
| --- | --- | --- |
| `id` | `uuid` | PK |
| `workshop_id` | `uuid` | FK a `workshops(id)`, no nulo |
| `customer_id` | `uuid` | FK a `customers(id)`, no nulo |
| `number` | `bigint` | Nulo en `draft`; único por taller al emitir |
| `status` | `text` | `draft`, `issued` o `void`; por defecto `draft` |
| `currency` | `text` | No nulo, valor fijo `COP` |
| `issued_at` | `timestamptz` | Nulo mientras sea `draft` |
| `customer_name_snapshot` | `text` | Nulo en draft; obligatorio al emitir |
| `customer_document_snapshot` | `text` | Opcional |
| `customer_contact_snapshot` | `text` | Opcional |
| `subtotal_cop` | `numeric(12,2)` | Mayor o igual que `0` |
| `total_adjustments_cop` | `numeric(12,2)` | Mayor, igual o menor que `0` según efecto |
| `total_cop` | `numeric(12,2)` | Mayor o igual que `0` |
| `payment_method` | `text` | Opcional |
| `payment_instructions` | `text` | Opcional; snapshot de configuración |
| `notes` | `text` | Opcional |
| `voided_at` | `timestamptz` | Solo para `void` |
| `created_at` | `timestamptz` | No nulo, por defecto `now()` |
| `updated_at` | `timestamptz` | No nulo, por defecto `now()` |

La unicidad debe implementarse con un índice único parcial sobre
`(workshop_id, number)` cuando `number is not null`. El cliente se desactiva
para nuevas emisiones, pero una factura histórica conserva `customer_id` y sus
snapshots.

### 5.8 `invoice_lines`

Detalle congelado de cada factura.

| Columna | Tipo | Reglas |
| --- | --- | --- |
| `id` | `uuid` | PK |
| `invoice_id` | `uuid` | FK a `invoices(id)` con `ON DELETE CASCADE` |
| `service_id` | `uuid` | FK opcional a `services(id)` |
| `description_snapshot` | `text` | No nulo y no vacío |
| `quantity` | `numeric(12,2)` | Mayor que `0` |
| `unit_price_cop` | `numeric(12,2)` | Mayor o igual que `0` |
| `line_total_cop` | `numeric(12,2)` | Resultado server-side |
| `created_at` | `timestamptz` | No nulo, por defecto `now()` |

`line_total_cop` se calcula como `quantity * unit_price_cop` y nunca se acepta
sin recalcular desde el servidor. Las líneas solo pueden modificarse mientras
la factura sea `draft`.

### 5.9 `invoice_adjustments`

Ajustes ordenados aplicados al subtotal o al resultado anterior.

| Columna | Tipo | Reglas |
| --- | --- | --- |
| `id` | `uuid` | PK |
| `invoice_id` | `uuid` | FK a `invoices(id)` con `ON DELETE CASCADE` |
| `label` | `text` | No nulo |
| `category` | `text` | `tax`, `withholding`, `discount` o `fee` |
| `mode` | `text` | `percentage` o `fixed` |
| `value` | `numeric(12,2)` | Mayor o igual que `0` |
| `base_cop` | `numeric(12,2)` | Base congelada al guardar/emitar |
| `amount_cop` | `numeric(12,2)` | Importe calculado server-side |
| `effect` | `text` | `add` o `subtract` |
| `sort_order` | `integer` | No nulo, permite ordenar aplicación |
| `created_at` | `timestamptz` | No nulo, por defecto `now()` |

La fórmula es `subtotal + ajustes positivos - ajustes negativos`. Para un
porcentaje, el servidor calcula `base_cop` según `sort_order` y conserva la
base y el importe resultante al emitir.

## 6. Reglas de integridad

- Todo `workshop_id` recibido en una mutación debe coincidir con el taller del
  usuario autenticado; idealmente no se recibe desde el cliente.
- `customer_id` y `service_id` deben pertenecer al mismo `workshop_id` de la
  factura.
- Una factura `issued` no puede editar cabecera, líneas ni ajustes.
- Una factura solo puede pasar de `issued` a `void`; no puede volver a `draft`.
- La anulación debe establecer `voided_at` y conservar todos los datos.
- Una factura nueva solo puede emitirse si el taller y el cliente están activos.
- No se deben borrar clientes ni servicios que puedan estar referenciados por
  historial.
- `currency` solo puede ser `COP` en el MVP.
- El total nunca puede ser negativo.

## 7. Funciones SQL y operaciones atómicas

Las operaciones que combinan validación, cálculo y cambios de estado deben
ejecutarse en una transacción. Se proponen estas funciones RPC, expuestas solo
con permisos mínimos:

### `issue_invoice(p_invoice_id uuid)`

1. Obtiene el usuario autenticado y resuelve su taller.
2. Bloquea la factura en estado `draft` con `FOR UPDATE`.
3. Verifica que el taller esté activo y que el cliente pertenezca al taller y
   esté activo.
4. Vuelve a consultar servicios, cantidades y precios permitidos.
5. Recalcula líneas, ajustes, subtotal y total con precisión decimal.
6. Bloquea la fila de `workshop_settings` con `FOR UPDATE`.
7. Toma `next_invoice_number`, incrementa el consecutivo y asigna el número.
8. Copia los snapshots del cliente y la configuración de pago.
9. Cambia el estado a `issued` y asigna `issued_at`.

La función debe ser idempotente para una factura que ya esté emitida y debe
rechazar cualquier transición inválida. El bloqueo de configuración evita
duplicar números con emisiones concurrentes.

### `void_invoice(p_invoice_id uuid)`

Verifica pertenencia al taller, bloquea la factura y permite únicamente la
transición `issued` a `void`. Establece `voided_at` sin modificar las líneas ni
los importes.

### `delete_draft_invoice(p_invoice_id uuid)`

Permite borrar únicamente una factura `draft` del taller actual. Las FK en
`invoice_lines` e `invoice_adjustments` deben usar `ON DELETE CASCADE`.

Las Server Actions deben recibir `FormData`, validar la entrada y llamar a las
funciones públicas del módulo de facturas. El cliente no debe tener acceso a
la `service_role key`.

## 8. Row Level Security

RLS debe habilitarse y forzarse en todas las tablas públicas:

```sql
alter table public.profiles enable row level security;
alter table public.workshops enable row level security;
alter table public.workshop_settings enable row level security;
alter table public.document_types enable row level security;
alter table public.customers enable row level security;
alter table public.services enable row level security;
alter table public.invoices enable row level security;
alter table public.invoice_lines enable row level security;
alter table public.invoice_adjustments enable row level security;
```

Se recomienda una función `security definer` pequeña y estable, por ejemplo
`current_profile_role()`, para consultar el rol actual sin crear recursión al
evaluar las políticas de `profiles`. La función debe fijar un `search_path`
seguro y no aceptar un `user_id` arbitrario.

### Políticas por tipo de tabla

- `profiles`: el usuario puede leer su propio perfil; `ADMIN` puede leer y
  actualizar perfiles; un `CLIENT` no puede cambiar `role`.
- `workshops`: el propietario puede leer y modificar su taller; `ADMIN` puede
  listar y cambiar `is_active`.
- `workshop_settings`: el propietario puede leer y modificar solo la fila de su
  taller; `ADMIN` no necesita modificar la configuración comercial.
- `document_types`: usuarios autenticados pueden leer tipos activos; `ADMIN`
  puede crear, editar y desactivar.
- `customers` y `services`: el `CLIENT` solo puede operar filas cuyo
  `workshop_id` sea su taller; `ADMIN` no opera datos comerciales salvo que se
  defina explícitamente una necesidad posterior.
- `invoices`: el `CLIENT` solo puede leer y mutar facturas de su taller. Las
  transiciones de emisión y anulación deben estar además protegidas por RPC.
- `invoice_lines` e `invoice_adjustments`: el acceso se autoriza mediante la
  factura y el taller propietario. No se debe confiar solo en el `invoice_id`
  enviado por el navegador.

Las políticas `INSERT` deben comprobar que el `workshop_id` pertenece al
usuario. En una alternativa más segura, las Server Actions omiten ese campo y
las funciones lo resuelven desde `auth.uid()`.

## 9. Índices y restricciones recomendados

- Índices por `workshop_id` en todas las tablas de negocio.
- `customers(workshop_id, is_active, name)` para búsqueda y selección.
- `services(workshop_id, is_active, name)` para el catálogo.
- `invoices(workshop_id, created_at desc)` para historial.
- `invoices(workshop_id, status, issued_at desc)` para dashboard.
- Índice único parcial `invoices(workshop_id, number)` donde `number is not null`.
- `document_types(code)` único.
- CHECK de estados, efectos, modos, moneda, importes no negativos y cantidades
  positivas.
- CHECK de consistencia entre `status`, `issued_at`, `voided_at` y `number`.

## 10. Supabase Storage para logos

Crear un bucket privado, por ejemplo `workshop-logos`. `logo_path` solo guarda
la ruta, nunca una URL pública permanente.

- La ruta recomendada es `<workshop_id>/<uuid>.<extension>`.
- El usuario solo puede subir, reemplazar o borrar archivos dentro de la ruta
  de su propio taller.
- Las políticas de Storage deben validar `auth.uid()` contra `workshops.owner_id`.
- El servidor genera URLs firmadas cuando el PDF o la pantalla las necesite.
- Deben validarse tamaño, extensión y tipo MIME antes de persistir el archivo.
- Al reemplazar un logo se debe eliminar el archivo anterior después de
  confirmar la nueva referencia.

## 11. Migraciones y orden de implementación

Las migraciones deben versionarse y aplicarse en este orden:

1. Extensiones, tipos auxiliares, función de `updated_at` y funciones de rol.
2. `profiles`, `workshops` y `workshop_settings`.
3. `document_types`, `customers` y `services`.
4. `invoices`, `invoice_lines` e `invoice_adjustments`.
5. Índices, restricciones adicionales y triggers.
6. RLS y políticas de todas las tablas.
7. Funciones RPC de emisión, anulación y borrado de borradores.
8. Bucket y políticas de Storage.
9. Datos iniciales de tipos de documento y primer administrador, mediante una
   migración controlada.

Cada migración debe poder ejecutarse en un entorno limpio y debe evitar
modificar archivos generados de `.next/`. Después de cambiar el esquema se
deben regenerar los tipos de Supabase y revisar las políticas con usuarios
`ADMIN`, `CLIENT` y una sesión sin autenticar.

## 12. Pendientes antes de implementar

- Definir la longitud exacta y caracteres permitidos en `invoice_prefix`.
- Definir el padding visual del número, aunque el valor almacenado sea
  numérico.
- Confirmar los límites funcionales de `numeric(12,2)` para cantidades y
  totales.
- Definir si el `ADMIN` puede consultar datos de talleres o únicamente sus
  perfiles y estados.
- Crear las migraciones SQL reales y pruebas de aislamiento RLS.
