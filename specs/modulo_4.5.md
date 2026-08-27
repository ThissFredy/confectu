# Spec: Ciclo de vida, cálculo y comprobantes de facturas (módulo 4.5)

**Módulo:** `modules/invoices/`
**Número de spec:** 4.5
**Estado:** Pendiente de implementación
**Fecha:** 2026-08-25

---

## 1. Objetivo y alcance

Implementar el módulo `modules/invoices/` para gestionar el ciclo completo de una factura: creación de borradores, selección o creación de cliente, líneas de servicio o personalizadas, ajustes (impuestos, retenciones, descuentos, cobros adicionales), cálculo server-side, emisión con numeración atómica, anulación, historial, detalle y generación/descarga de PDF.

### Dentro del alcance

- Crear y editar borradores de factura con cliente obligatorio desde el inicio.
- Seleccionar un cliente activo existente o crear uno nuevo durante el flujo de factura.
- Agregar líneas del catálogo de servicios o líneas personalizadas con cantidad y precio COP.
- Aplicar cero o más ajustes fijos o porcentuales (impuestos, retenciones, descuentos, cobros).
- Recalcular subtotal, ajustes y total en el servidor antes de guardar o emitir.
- Emitir facturas con numeración automática y atómica por taller.
- Anular facturas emitidas conservando el historial.
- Eliminar borradores físicamente.
- Listar facturas con filtros por estado y búsqueda por número o cliente.
- Ver el detalle de una factura (editable si es borrador, solo lectura si está emitida o anulada).
- Generar y descargar PDF del comprobante en cualquier estado.
- Permitir que `ADMIN` lea facturas de cualquier taller y descargue el PDF.

### Fuera del alcance

- Facturación electrónica o validación ante la DIAN.
- Pagos en línea y conciliación de abonos.
- Almacenamiento permanente de PDFs en Storage o base de datos.
- Varios usuarios dentro de un mismo taller.
- Compartir facturas por enlace público.
- Dashboard y reportes (módulo 4.6, que reutilizará consultas públicas de este módulo).

---

## 2. Actores y permisos

| Actor | Descripción | Acceso |
|---|---|---|
| `CLIENT` | Propietario de un taller. | Crea, edita, emite, anula y elimina facturas de su taller. Descarga PDF de sus facturas. |
| `ADMIN` | Administrador global de Confectu. | Lee facturas de cualquier taller y descarga PDF. No puede crear, editar, emitir, anular ni eliminar. |
| Usuario no autenticado | Sin sesión activa. | Redirigido a `/login`. |
| Usuario inactivo | Cuenta desactivada. | Redirigido a `/account-disabled`. |

### Reglas de permisos

- El taller se resuelve en el servidor a partir del usuario autenticado (`workshops.owner_id`). No se acepta `workshop_id` desde el formulario sin validación.
- Las Server Actions de `modules/invoices/` validan sesión activa, rol y pertenencia al taller antes de cualquier mutación.
- `CLIENT` solo puede operar facturas de su propio taller.
- `ADMIN` puede leer (`select`) facturas, líneas y ajustes de cualquier taller, y descargar PDF, pero no puede mutar.
- Las políticas RLS existentes permiten `select` al owner y a `ADMIN`; `insert`/`update`/`delete` solo al owner. Se requiere una migración para permitir que `ADMIN` lea `invoice_lines` e `invoice_adjustments` (necesario para el PDF).
- El servidor vuelve a consultar clientes y servicios antes de emitir; no confía en IDs, precios o totales enviados por el navegador.

---

## 3. Migración de base de datos requerida

### 3.1 Eliminar columnas de snapshot del cliente

La factura no guarda copias (snapshots) de los datos del cliente. Los datos del cliente se consultan dinámicamente por `customer_id` en cada visualización y generación de PDF, de modo que siempre reflejan la información actual del cliente.

```sql
-- Eliminar constraint que exige snapshot en issued/void.
alter table public.invoices
  drop constraint invoices_customer_name_snapshot_check;

-- Eliminar columnas de snapshot del cliente.
alter table public.invoices
  drop column if exists customer_name_snapshot,
  drop column if exists customer_document_snapshot,
  drop column if exists customer_contact_snapshot;
```

### 3.2 Actualizar RLS de `invoice_lines` e `invoice_adjustments` para ADMIN

Las políticas `select` actuales de `invoice_lines` e `invoice_adjustments` solo permiten leer al owner del taller. `ADMIN` necesita leer líneas y ajustes para descargar el PDF y para los conteos del dashboard admin.

```sql
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
```

### 3.3 Crear función atómica `issue_invoice`

Reserva el consecutivo, actualiza la factura a `issued` y congela `payment_instructions` en una sola transacción para evitar duplicados ante emisiones simultáneas.

```sql
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
```

### 3.4 Actualizar comentarios de la tabla

```sql
comment on table public.invoices is 'Cabecera de factura. draft editable; issued inmutable; void solo desde issued. Sin snapshots de cliente: los datos se consultan por customer_id.';
```

---

## 4. Flujo principal y flujos alternativos

### 4.1 Flujo: crear borrador de factura

1. `CLIENT` toca "Facturas" en el menú privado (`PrivateHeader`).
2. Navega a `/invoices` y ve el historial con un botón "Crear factura".
3. Toca "Crear factura" y navega a `/invoices/new`.
4. La página (Server Component) carga los servicios activos (`listActiveServices`) y la configuración del taller (`getCurrentWorkshopSettings`).
5. El usuario selecciona o crea un cliente mediante `CustomerPicker`.
6. El usuario agrega líneas mediante `InvoiceLineEditor`: selecciona un servicio del catálogo (copia descripción y precio base como valores iniciales editables) o crea una línea personalizada.
7. El usuario agrega opcionalmente ajustes mediante `InvoiceAdjustmentEditor`.
8. `InvoiceSummary` muestra cálculos orientativos (subtotal, ajustes, total).
9. El usuario ingresa opcionalmente método de pago y notas.
10. Al tocar "Guardar borrador", el formulario valida en cliente y luego invoca `createInvoiceDraft`.
11. La Server Action valida sesión, rol, taller, cliente activo, líneas, ajustes, recalcula totales en el servidor y guarda la factura como `draft`.
12. Si hay éxito, se muestra `showToast.success("Borrador creado")` y se redirige a `/invoices/[id]`.
13. Si hay errores de validación, se muestran `fieldErrors` bajo cada campo; si hay error general, se muestra bajo el formulario.

### 4.2 Flujo: editar borrador

1. `CLIENT` toca una factura `draft` en el historial.
2. Navega a `/invoices/[id]`.
3. La página (Server Component) consulta la factura con sus líneas, ajustes y cliente.
4. Si la factura es `draft` y pertenece al taller del usuario, se renderiza `InvoiceForm` en modo edición con los datos actuales.
5. El usuario modifica líneas, ajustes, método de pago o notas.
6. Al tocar "Guardar cambios", se invoca `updateInvoiceDraft`.
7. La Server Action valida, recalcula y reemplaza líneas y ajustes completamente.
8. Si hay éxito, `showToast.success("Borrador actualizado")` y `router.refresh()`.

### 4.3 Flujo: emitir factura

1. Desde el detalle de un borrador (`/invoices/[id]`), el usuario revisa los datos.
2. Si el método de pago está vacío, el formulario lo exige antes de emitir.
3. El usuario toca "Emitir factura" en `InvoiceIssueButton`.
4. Se muestra un diálogo de confirmación: "¿Seguro que deseas emitir esta factura? Una vez emitida no se podrá editar."
5. Al confirmar, se invoca `issueInvoice`.
6. La Server Action valida sesión, rol, taller, que la factura sea `draft`, recalcula totales, valida que el total no sea negativo, valida que el cliente esté activo y llama a la función atómica `issue_invoice`.
7. La función atómica reserva el consecutivo, asigna `number`, `issued_at`, `status = 'issued'` y congela `payment_instructions` en una sola transacción.
8. Si hay éxito, `showToast.success("Factura emitida")` y se revalidan las rutas.
9. Si el cliente fue desactivado, se muestra error "El cliente no está activo. Reactívalo antes de emitir."
10. Si el total es negativo, se muestra error "El total no puede ser negativo."

### 4.4 Flujo: anular factura

1. Desde el detalle de una factura `issued` (`/invoices/[id]`), el usuario toca "Anular factura" en `InvoiceVoidButton`.
2. Se muestra un diálogo de doble confirmación: "Esta acción no se puede deshacer. ¿Anular la factura?"
3. Al confirmar, se invoca `voidInvoice`.
4. La Server Action valida que la factura sea `issued` y pertenezca al taller.
5. Establece `status = 'void'` y `voided_at = now()`.
6. Si hay éxito, `showToast.success("Factura anulada")` y `router.refresh()`.

### 4.5 Flujo: eliminar borrador

1. Desde el detalle de un borrador (`/invoices/[id]`), el usuario toca "Eliminar borrador" en `InvoiceDeleteButton`.
2. Se muestra un diálogo de doble confirmación: "Se eliminará permanentemente. ¿Continuar?"
3. Al confirmar, se invoca `deleteInvoice`.
4. La Server Action valida que la factura sea `draft` y pertenezca al taller.
5. Elimina físicamente la factura (cascade elimina líneas y ajustes).
6. Si hay éxito, `showToast.success("Borrador eliminado")` y se redirige a `/invoices`.

### 4.6 Flujo: descargar PDF

1. Desde el detalle de cualquier factura o desde el historial, el usuario toca "Descargar PDF" en `InvoicePdfLink`.
2. El enlace apunta al Route Handler `GET /invoices/[id]/pdf`.
3. El Route Handler valida sesión, rol y pertenencia.
4. Obtiene la factura, líneas, ajustes, cliente (datos actuales), configuración del taller y URL del logo.
5. Genera el PDF en memoria con la librería ligera y lo transmite con `Content-Type: application/pdf` y `Content-Disposition: attachment`.
6. Si la factura es `draft`, el PDF lleva marca "Borrador - No válido".
7. Si la factura es `void`, el PDF lleva marca "ANULADA".
8. Si la factura no existe o no pertenece al taller del usuario (y no es `ADMIN`), retorna 404.

### 4.7 Flujo: crear cliente desde el flujo de factura

1. En `CustomerPicker`, el usuario toca "Crear cliente nuevo".
2. Se muestra un formulario inline con nombre (obligatorio) y campos opcionales.
3. Al enviar, se invoca `createCustomerFromInvoice`.
4. La Server Action valida sesión, rol, taller y campos; crea un cliente activo asociado al taller.
5. Devuelve el `customerId` para que el componente lo seleccione automáticamente en la factura.

### 4.8 Flujos alternativos

- **Factura no encontrada:** si el ID no existe o pertenece a otro taller, la página muestra `NotFoundNotice` con mensaje "No se encontró la factura" y enlace a `/invoices`.
- **Intentar editar factura emitida o anulada:** la página renderiza vista de solo lectura sin formulario de edición. Las Server Actions validan estado y rechazan la operación.
- **Intentar emitir factura no draft:** `issueInvoice` valida `status = 'draft'` y retorna error.
- **Intentar anular factura no issued:** `voidInvoice` valida `status = 'issued'` y retorna error.
- **Intentar eliminar factura no draft:** `deleteInvoice` valida `status = 'draft'` y retorna error.
- **Cliente desactivado al emitir:** la función atómica valida `customers.is_active = true` y retorna error.
- **Total negativo:** la Server Action valida `total_cop >= 0` antes de emitir y retorna error.
- **Concurrencia de emisión:** dos emisiones simultáneas del mismo taller se serializan por `for update` en `workshop_settings`; cada una recibe un número distinto.
- **ADMIN intenta mutar:** las Server Actions validan rol `CLIENT` para mutaciones y rechazan a `ADMIN`.

---

## 5. Reglas de negocio

1. **Cliente obligatorio desde la creación del borrador:** toda factura debe tener un `customer_id` desde el momento de su creación. No se pueden guardar borradores sin cliente.
2. **Cliente debe estar activo al emitir:** si el cliente fue desactivado después de crear el borrador, la emisión se bloquea con un error claro.
3. **Sin snapshots de cliente:** las facturas no guardan copias de los datos del cliente. Los datos se consultan dinámicamente por `customer_id` en cada visualización y generación de PDF, reflejando siempre la información actual del cliente.
4. **Mínimo 1 línea:** una factura requiere al menos una línea para guardarse o emitirse. No existen facturas sin líneas.
5. **Máximo 50 líneas por factura:** límite para evitar abusos y mantener el PDF legible en móvil.
6. **Líneas personalizadas sin servicio:** una línea puede no tener `service_id`. En ese caso la descripción se ingresa manualmente y el precio se digita libremente. Cuando se selecciona un servicio del catálogo, la descripción y el precio base se copian como valores iniciales editables.
7. **Edición de líneas en borrador:** en un borrador, las líneas se pueden agregar, editar y eliminar libremente. Al emitir, las líneas se congelan y no se pueden modificar.
8. **Reemplazo de líneas al editar:** al guardar cambios en un borrador existente, las líneas y ajustes se reemplazan completamente (delete + insert) en una operación server-side. El servidor recalcula todos los `line_total_cop` y `amount_cop`.
9. **Cero ajustes es válido:** una factura puede tener cero ajustes. El total será igual al subtotal.
10. **Máximo 20 ajustes por factura:** límite para mantener la interfaz manejable en móvil.
11. **Base de cálculo porcentual:** para un ajuste en modo `percentage`, la base de cálculo es el subtotal cuando es el primer ajuste, o el resultado acumulado tras los ajustes anteriores en `sort_order`. El servidor determina y guarda `base_cop` según este orden. Todos los ajustes se aplican secuencialmente según `sort_order`, no en paralelo sobre el subtotal.
12. **Efecto determinado por categoría:** el `effect` (`add`/`subtract`) se infiere de la categoría: `tax` y `fee` suman; `withholding` y `discount` restan. El usuario no elige el efecto manualmente.
13. **Total no negativo:** el total de la factura no puede ser negativo. Si los ajustes negativos superan el subtotal + ajustes positivos, la emisión se bloquea con error de validación.
14. **Método de pago opcional en borrador, obligatorio al emitir:** el campo `payment_method` es opcional al guardar un borrador pero obligatorio al emitir. Se almacena como texto libre o de un conjunto fijo (efectivo, transferencia, tarjeta).
15. **Instrucciones de pago se heredan del taller:** al emitir, `payment_instructions` se copia automáticamente desde `workshop_settings.payment_instructions` como snapshot, pero el usuario puede editarlas antes de emitir. Si el taller no tiene instrucciones configuradas, el campo queda vacío.
16. **Notas internas opcionales:** el campo `notes` es opcional en todo el ciclo. Son notas internas del taller, no se muestran en el PDF.
17. **Moneda siempre COP:** no hay selector de moneda. Todas las cantidades son COP. El campo `currency` siempre es `'COP'` y no se muestra en la interfaz.
18. **Cantidades monetarias como enteros o decimales exactos:** los valores COP se manejan como `numeric` exacto en el servidor. La interfaz muestra valores con formato de pesos colombianos. Los cálculos del navegador son solo orientativos; el servidor recalcula todo antes de guardar o emitir.
19. **Cantidad de líneas admite decimales:** `quantity` es `numeric(12,2)` y admite decimales (ej. 1.5 metros). La interfaz permite ingresar cantidades decimales con hasta 2 decimales.
20. **Precio unitario admite decimales:** `unit_price_cop` es `numeric(12,2)` y admite centavos. La interfaz los permite para flexibilidad.
21. **Numeración al emitir:** el número de factura se asigna automáticamente al emitir, usando `workshop_settings.next_invoice_number` y el prefijo configurado. El número mostrado es `{prefijo}-{número}` (ej. `TAL-1`). El número en base de datos se guarda sin padding, solo el entero.
22. **Reserva atómica del consecutivo:** la reserva del número consecutivo se realiza en la función SQL `issue_invoice` (`SECURITY DEFINER`) con bloqueo de fila (`for update`) para evitar duplicados ante emisiones simultáneas.
23. **Anulación solo desde `issued`:** una factura solo se puede anular (`void`) si está `issued`. No se puede anular un borrador (se elimina). No se puede re-emitir una factura anulada. La anulación registra `voided_at` y cambia `status` a `void`, conservando el número.
24. **Eliminación de borradores:** un borrador (`draft`) se puede eliminar físicamente. Las facturas `issued` y `void` no se pueden eliminar; solo se anulan (las `issued`) o se conservan (las `void`).
25. **`void` es completamente de solo lectura:** no se puede editar, no se puede re-emitir, no se puede eliminar.
26. **PDF disponible en todos los estados:** el PDF se puede descargar para facturas `draft`, `issued` y `void`. El PDF de un borrador lleva marca "Borrador - No válido". El PDF de una anulada lleva marca "ANULADA".
27. **Historial muestra todos los estados:** la lista de facturas muestra facturas en todos los estados con filtros por estado y búsqueda por número o nombre del cliente.
28. **`ADMIN` no opera facturas:** el rol `ADMIN` puede leer facturas y descargar PDF de cualquier taller, pero no crea, edita, emite, anula ni elimina facturas.
29. **`workshop_id` resuelto en servidor:** nunca se toma del formulario para mutar.
30. **Validaciones duplicadas en cliente y servidor:** HTML5 nativo, validación manual en el componente y validación en la Server Action.

---

## 6. Estados y transiciones

```text
┌────────┐  emitir   ┌────────┐  anular   ┌──────┐
│ draft  │──────────▶│ issued │──────────▶│ void │
└────────┘           └────────┘           └──────┘
    │                     │
    │ eliminar            │ (no se puede eliminar)
    ▼                     ▼
 (eliminado)         (solo lectura)
```

| Estado | Editable | Tiene número | Tiene `issued_at` | Tiene `voided_at` | PDF | Acciones disponibles |
|---|---|---|---|---|---|---|
| `draft` | Sí | No | No | No | Sí (marca "Borrador - No válido") | Guardar cambios, Emitir, Eliminar, Descargar PDF |
| `issued` | No | Sí | Sí | No | Sí | Anular, Descargar PDF |
| `void` | No | Sí | Sí | Sí | Sí (marca "ANULADA") | Descargar PDF |

### Transiciones válidas

| Origen | Acción | Destino |
|---|---|---|
| `draft` | Guardar cambios | `draft` (sigue editable) |
| `draft` | Emitir | `issued` |
| `draft` | Eliminar | (eliminado físicamente) |
| `issued` | Anular | `void` |
| `void` | (ninguna) | (inmutable) |

### Transiciones inválidas

| Origen | Acción | Resultado |
|---|---|---|
| `issued` | Editar | Error: solo los borradores se pueden editar |
| `issued` | Eliminar | Error: solo los borradores se pueden eliminar |
| `void` | Editar | Error: solo los borradores se pueden editar |
| `void` | Anular | Error: solo las facturas emitidas se pueden anular |
| `void` | Eliminar | Error: solo los borradores se pueden eliminar |
| `void` | Emitir | Error: solo los borradores se pueden emitir |

---

## 7. Modelo de datos afectado

### 7.1 Tabla `invoices` (modificada)

Se eliminan las columnas de snapshot del cliente y su constraint. Campos restantes:

```text
invoices
  id                    uuid primary key
  workshop_id           uuid not null (FK workshops)
  customer_id           uuid not null (FK customers)
  number                bigint (null en draft, secuencial por taller al emitir)
  status                invoice_status not null default 'draft'
  currency              char(3) not null default 'COP'
  issued_at             timestamptz (null en draft, not null en issued/void)
  subtotal_cop          numeric(12,2) not null default 0
  total_adjustments_cop numeric(12,2) not null default 0
  total_cop             numeric(12,2) not null default 0
  payment_method        text (opcional en draft, obligatorio al emitir)
  payment_instructions  text (snapshot al emitir, copiado de workshop_settings)
  notes                 text (opcional, notas internas, no aparece en PDF)
  voided_at             timestamptz (null salvo en void)
  created_at            timestamptz not null
  updated_at            timestamptz not null
```

### 7.2 Restricciones existentes relevantes (sin cambios)

- `invoices_currency_check`: `currency = 'COP'`.
- `invoices_total_cop_nonneg`: `total_cop >= 0`.
- `invoices_number_draft_check`: `(status = 'draft' and number is null) or (status <> 'draft' and number is not null)`.
- `invoices_issued_at_check`: `(status = 'draft' and issued_at is null) or (status <> 'draft' and issued_at is not null)`.
- `invoices_voided_at_check`: `(status = 'void' and voided_at is not null) or (status <> 'void' and voided_at is null)`.
- Índice único parcial `invoices_workshop_number_unique_idx` sobre `(workshop_id, number) where number is not null`.
- Trigger `invoices_set_updated_at`: actualiza `updated_at` automáticamente.
- Trigger `invoice_lines_validate_service`: valida que `service_id` pertenezca al mismo taller que la factura.

### 7.3 Tabla `invoice_lines` (sin cambios)

```text
invoice_lines
  id                   uuid primary key
  invoice_id           uuid not null (FK invoices, cascade delete)
  service_id           uuid (opcional, FK services, on delete restrict)
  description_snapshot text not null
  quantity             numeric(12,2) not null (> 0, <= 9999999.99)
  unit_price_cop       numeric(12,2) not null (>= 0)
  line_total_cop       numeric(12,2) not null (>= 0, calculado server-side)
  created_at           timestamptz not null
```

### 7.4 Tabla `invoice_adjustments` (sin cambios)

```text
invoice_adjustments
  id          uuid primary key
  invoice_id  uuid not null (FK invoices, cascade delete)
  label       text not null
  category    adjustment_category not null ('tax', 'withholding', 'discount', 'fee')
  mode        adjustment_mode not null ('percentage', 'fixed')
  value       numeric(12,2) not null (>= 0; si percentage, <= 100)
  base_cop    numeric(12,2) not null default 0 (base usada en modo percentage, congelado server-side)
  amount_cop  numeric(12,2) not null default 0 (monto COP calculado, congelado server-side)
  effect      adjustment_effect not null ('add', 'subtract')
  sort_order  integer not null (orden de aplicación)
  created_at  timestamptz not null
```

### 7.5 Tabla `workshop_settings` (sin cambios)

Se utiliza `invoice_prefix` y `next_invoice_number` para la numeración automática al emitir.

---

## 8. Relaciones entre entidades

```text
workshops 1───∞ invoices
customers 1───∞ invoices
invoices  1───∞ invoice_lines
services  1───∞ invoice_lines (opcional, on delete restrict)
invoices  1───∞ invoice_adjustments
```

- `invoices.workshop_id` → `workshops.id`: aislamiento multi-tenant.
- `invoices.customer_id` → `customers.id`: datos del cliente consultados dinámicamente, sin snapshot.
- `invoice_lines.invoice_id` → `invoices.id`: cascade delete.
- `invoice_lines.service_id` → `services.id`: opcional, `on delete restrict` (no se puede eliminar un servicio referenciado por una línea).
- `invoice_adjustments.invoice_id` → `invoices.id`: cascade delete.

### Consultas públicas de otros módulos reutilizadas

- `modules/clients/queries.ts` → `searchCustomersForInvoice(supabase, query)`: busca clientes activos por nombre o documento.
- `modules/services/queries.ts` → `listActiveServices(supabase)`: lista servicios activos del taller.
- `modules/workshops/queries.ts` → `getCurrentWorkshopSettings(supabase)`: obtiene configuración del taller actual.
- `modules/workshops/queries.ts` → `getWorkshopLogoUrl(supabase, logoPath)`: genera URL firmada del logo.

### Consultas públicas de este módulo (para dashboard)

- `listInvoices(supabase, options)`: lista facturas del taller con filtros.
- `getInvoiceById(supabase, id)`: obtiene una factura con líneas, ajustes y cliente.
- `getInvoiceStats(supabase)`: indicadores agregados para el dashboard (módulo 4.6).

---

## 9. Reglas de aislamiento multi-tenant y RLS

### 9.1 RLS existente de `invoices`

```sql
invoices_select: using (workshop_id = current_workshop_id() or is_admin())
invoices_insert: with check (workshop_id = current_workshop_id())
invoices_update: using/check (workshop_id = current_workshop_id())
invoices_delete: using (workshop_id = current_workshop_id())
```

`ADMIN` puede leer pero no mutar. El owner puede todo. No se modifican las políticas de mutación.

### 9.2 RLS de `invoice_lines` e `invoice_adjustments` (migración requerida)

Las políticas `select` actuales solo permiten leer al owner del taller. Se actualizan para permitir que `ADMIN` lea líneas y ajustes (necesario para PDF y dashboard admin). Las políticas de `insert`/`update`/`delete` no se modifican: siguen permitiendo solo al owner del taller.

### 9.3 Validación en Server Actions

- Todas las Server Actions de `modules/invoices/` validan sesión activa y resuelven el taller del usuario autenticado.
- Las mutaciones (`createInvoiceDraft`, `updateInvoiceDraft`, `issueInvoice`, `voidInvoice`, `deleteInvoice`, `createCustomerFromInvoice`) validan rol `CLIENT`.
- El `workshop_id` se resuelve en el servidor consultando `workshops` por `owner_id = auth.uid()`.
- Antes de emitir, el servidor valida que la factura pertenezca al taller del usuario y que el cliente esté activo.
- La función atómica `issue_invoice` valida `auth.uid()` y que la factura pertenezca al taller del usuario.

### 9.4 Route Handler de PDF

- El Route Handler `GET /invoices/[id]/pdf` valida sesión, rol y pertenencia.
- `CLIENT`: solo puede descargar PDF de facturas de su propio taller.
- `ADMIN`: puede descargar PDF de facturas de cualquier taller.
- Si la factura no existe o no pertenece al taller del usuario (y no es `ADMIN`), retorna 404.

### 9.5 Service role key

No se usa la service role key. Todas las operaciones se ejecutan con el cliente Supabase autenticado del usuario, respetando RLS. La función `issue_invoice` es `SECURITY DEFINER` pero valida `auth.uid()` internamente.

---

## 10. Validaciones funcionales

### 10.1 Líneas de factura

| Campo | Regla |
|---|---|
| `description_snapshot` | Obligatorio. No vacío tras `trim`. Máximo 500 caracteres. |
| `quantity` | Obligatorio. `> 0` y `<= 9999999.99`. Hasta 2 decimales. |
| `unit_price_cop` | Obligatorio. `>= 0`. Hasta 2 decimales. Máximo `9999999999.99`. |
| `line_total_cop` | Calculado server-side: `quantity * unit_price_cop`. `>= 0`. |
| `service_id` | Opcional. Si presente, debe pertenecer al mismo taller que la factura. |
| Cantidad de líneas | Mínimo 1, máximo 50 por factura. |

### 10.2 Ajustes de factura

| Campo | Regla |
|---|---|
| `label` | Obligatorio. No vacío tras `trim`. Máximo 100 caracteres. |
| `category` | Obligatorio. Uno de: `tax`, `withholding`, `discount`, `fee`. |
| `mode` | Obligatorio. Uno de: `percentage`, `fixed`. |
| `value` | Obligatorio. `>= 0`. Si `mode = 'percentage'`, `<= 100`. Hasta 2 decimales. |
| `base_cop` | Calculado server-side según `sort_order`. `>= 0`. |
| `amount_cop` | Calculado server-side: si `percentage`, `base_cop * value / 100`; si `fixed`, `value`. `>= 0`. |
| `effect` | Inferido de `category`: `tax`/`fee` = `add`; `withholding`/`discount` = `subtract`. |
| `sort_order` | Asignado server-side secuencialmente desde 0. |
| Cantidad de ajustes | Mínimo 0, máximo 20 por factura. |

### 10.3 Factura

| Campo | Regla |
|---|---|
| `customer_id` | Obligatorio desde la creación del borrador. Debe pertenecer al taller y estar activo al emitir. |
| `payment_method` | Opcional en borrador. Obligatorio al emitir. Máximo 50 caracteres. |
| `payment_instructions` | Opcional. Se copia de `workshop_settings` al emitir. Máximo 1000 caracteres. |
| `notes` | Opcional. Máximo 2000 caracteres. Notas internas, no aparecen en PDF. |
| `subtotal_cop` | Calculado server-side: suma de `line_total_cop`. `>= 0`. |
| `total_adjustments_cop` | Calculado server-side: suma de ajustes `add` menos suma de ajustes `subtract`. |
| `total_cop` | Calculado server-side: `subtotal_cop + total_adjustments_cop`. `>= 0`. Si es negativo, la emisión se bloquea. |
| `currency` | Siempre `'COP'`. No se acepta otro valor. |
| Líneas | Mínimo 1, máximo 50. |
| Ajustes | Mínimo 0, máximo 20. |

### 10.4 Validación de rol

| Regla | Descripción |
|---|---|
| Sesión activa | Si no hay sesión, retorna error "No hay sesión activa." |
| Rol `CLIENT` (mutaciones) | Si el rol no es `CLIENT`, retorna error "No tienes permiso para realizar esta acción." |
| Taller activo | Si el usuario no tiene taller o está inactivo, retorna error. |
| Pertenencia | La factura debe pertenecer al taller del usuario. |

---

## 11. Errores y estados de la interfaz

### 11.1 Página `/invoices` (historial)

| Estado | Comportamiento |
|---|---|
| Loading | Spinner o esqueleto mientras carga la lista. |
| Con datos | Lista de facturas con badges de estado, filtros y búsqueda. |
| Vacío | "No hay facturas" con botón "Crear factura". |
| Error de carga | Mensaje "No se pudieron cargar las facturas." con botón de reintentar. |

### 11.2 Página `/invoices/new` (crear)

| Estado | Comportamiento |
|---|---|
| Loading | Spinner mientras cargan servicios y configuración. |
| Con datos | `InvoiceForm` vacío con `CustomerPicker`, `InvoiceLineEditor`, `InvoiceAdjustmentEditor`, `InvoiceSummary`. |
| Error de carga | Mensaje "No se pudieron cargar los datos." con enlace a `/invoices`. |
| Éxito de guardado | Toast `showToast.success("Borrador creado")` y redirección a `/invoices/[id]`. |
| Error de guardado | `fieldErrors` bajo cada campo + error general bajo el formulario. |

### 11.3 Página `/invoices/[id]` (detalle)

| Estado | Comportamiento |
|---|---|
| Loading | Spinner mientras carga la factura. |
| Factura `draft` | `InvoiceForm` en modo edición con botones Guardar, Emitir, Eliminar, Descargar PDF. |
| Factura `issued` | Vista de solo lectura con botones Anular, Descargar PDF. |
| Factura `void` | Vista de solo lectura con botón Descargar PDF. Marca "ANULADA" visible. |
| No encontrada | `NotFoundNotice` con mensaje "No se encontró la factura" y enlace a `/invoices`. |
| Éxito de guardado | Toast `showToast.success("Borrador actualizado")` y `router.refresh()`. |
| Éxito de emisión | Toast `showToast.success("Factura emitida")` y `router.refresh()`. |
| Éxito de anulación | Toast `showToast.success("Factura anulada")` y `router.refresh()`. |
| Éxito de eliminación | Toast `showToast.success("Borrador eliminado")` y redirección a `/invoices`. |
| Error | Toast `showToast.error` con mensaje claro. |

### 11.4 Descarga de PDF

| Estado | Comportamiento |
|---|---|
| Generando | El navegador muestra su indicador de descarga nativo. |
| Éxito | El archivo PDF se descarga con nombre `{prefijo}-{numero}.pdf` o `borrador-{id}.pdf` para drafts. |
| No encontrada | Página 404. |
| Sin permiso | Página 404 (no revelar existencia). |

---

## 12. Rutas y pantallas afectadas

| Ruta | Archivo | Descripción |
|---|---|---|
| `/invoices` | `app/(private)/invoices/page.tsx` (modifica) | Historial de facturas con filtros por estado y búsqueda por número o cliente. |
| `/invoices/new` | `app/(private)/invoices/new/page.tsx` (nuevo) | Crear borrador de factura. |
| `/invoices/[id]` | `app/(private)/invoices/[id]/page.tsx` (nuevo) | Detalle de factura: editable si `draft`, solo lectura si `issued`/`void`. |
| `/invoices/[id]/pdf` | `app/(private)/invoices/[id]/pdf/route.ts` (nuevo) | Route Handler que genera y transmite el PDF. |
| `docs/modules.md` | `docs/modules.md` (modifica) | Actualizar estado del módulo 4.5 a `IMPLEMENTADO`. |

### Notas sobre organización de rutas

- `/invoices` ya está protegida como ruta privada en `proxy.ts`.
- Las rutas `/invoices/new` y `/invoices/[id]` heredan la protección de la ruta privada.
- El Route Handler `/invoices/[id]/pdf` valida sesión y permisos explícitamente.
- El `PrivateHeader` ya enlaza a `/invoices`.

---

## 13. Server Actions necesarias

### 13.1 `createInvoiceDraft(formData)`

- **Módulo**: `modules/invoices/actions.ts`
- **Propósito**: crear un borrador de factura con cliente, líneas y ajustes.
- **Entrada (FormData)**:
  - `customer_id` (obligatorio): UUID del cliente seleccionado o creado.
  - `line_count` (obligatorio): número de líneas enviadas.
  - `line_${i}_service_id` (opcional): UUID del servicio del catálogo.
  - `line_${i}_description` (obligatorio): descripción de la línea.
  - `line_${i}_quantity` (obligatorio): cantidad, decimal.
  - `line_${i}_unit_price_cop` (obligatorio): precio unitario COP, decimal.
  - `adj_count` (opcional): número de ajustes enviados.
  - `adj_${i}_label` (obligatorio si hay ajustes): etiquiqueta del ajuste.
  - `adj_${i}_category` (obligatorio si hay ajustes): `tax`, `withholding`, `discount`, `fee`.
  - `adj_${i}_mode` (obligatorio si hay ajustes): `percentage`, `fixed`.
  - `adj_${i}_value` (obligatorio si hay ajustes): valor del ajuste.
  - `payment_method` (opcional): método de pago.
  - `notes` (opcional): notas internas.
- **Salida**: `InvoiceActionResult` (`{ success: true, invoiceId?: string }` o `{ success: false, error?: string, fieldErrors?: Record<string, string> }`).
- **Validaciones**:
  - Sesión activa, rol `CLIENT`, taller activo.
  - `customer_id` pertenece al taller y está activo.
  - Mínimo 1 línea, máximo 50.
  - Mínimo 0 ajustes, máximo 20.
  - Campos de líneas y ajustes validados con `validateInvoiceInput`.
  - Recálculo server-side de `line_total_cop`, `base_cop`, `amount_cop`, `subtotal_cop`, `total_adjustments_cop`, `total_cop`.
  - `total_cop >= 0`.
- **Comportamiento**:
  - Inserta la factura con `status = 'draft'`, `workshop_id` resuelto en servidor, `currency = 'COP'`.
  - Inserta las líneas con `line_total_cop` calculado.
  - Inserta los ajustes con `base_cop`, `amount_cop`, `effect`, `sort_order` calculados.
  - Ejecuta `revalidatePath("/invoices")`.
  - Retorna `invoiceId` para redirección.

### 13.2 `updateInvoiceDraft(formData)`

- **Módulo**: `modules/invoices/actions.ts`
- **Propósito**: actualizar un borrador existente reemplazando líneas y ajustes.
- **Entrada (FormData)**:
  - `id` (obligatorio): UUID de la factura a actualizar.
  - `customer_id` (obligatorio): UUID del cliente.
  - `line_count`, `line_${i}_*`: líneas (reemplazo completo).
  - `adj_count`, `adj_${i}_*`: ajustes (reemplazo completo).
  - `payment_method` (opcional).
  - `notes` (opcional).
- **Salida**: `InvoiceActionResult`.
- **Validaciones**:
  - Sesión activa, rol `CLIENT`, taller activo.
  - La factura existe, pertenece al taller y tiene `status = 'draft'`.
  - `customer_id` pertenece al taller y está activo.
  - Líneas y ajustes validados.
  - Recálculo server-side de todos los totales.
  - `total_cop >= 0`.
- **Comportamiento**:
  - Elimina las líneas y ajustes existentes.
  - Inserta las nuevas líneas y ajustes.
  - Actualiza `subtotal_cop`, `total_adjustments_cop`, `total_cop`, `payment_method`, `notes` en la factura.
  - Ejecuta `revalidatePath("/invoices")` y `revalidatePath("/invoices/[id]")`.

### 13.3 `issueInvoice(formData)`

- **Módulo**: `modules/invoices/actions.ts`
- **Propósito**: emitir un borrador, asignando número atómico y congelando el estado.
- **Entrada (FormData)**:
  - `id` (obligatorio): UUID de la factura a emitir.
  - `payment_method` (obligatorio): método de pago.
  - `payment_instructions` (opcional): instrucciones de pago. Si vacío, se copia de `workshop_settings`.
- **Salida**: `InvoiceActionResult`.
- **Validaciones**:
  - Sesión activa, rol `CLIENT`, taller activo.
  - La factura existe, pertenece al taller y tiene `status = 'draft'`.
  - `payment_method` no vacío.
  - Recálculo server-side de todos los totales antes de emitir.
  - `total_cop >= 0`.
  - El cliente está activo (validado también por la función atómica).
- **Comportamiento**:
  - Recalcula y actualiza `subtotal_cop`, `total_adjustments_cop`, `total_cop` en la factura.
  - Si `payment_instructions` está vacío, lo copia de `workshop_settings.payment_instructions`.
  - Llama a la función atómica `issue_invoice(p_invoice_id, p_payment_method, p_payment_instructions)`.
  - La función reserva el consecutivo, asigna `number`, `issued_at`, `status = 'issued'` e incrementa `next_invoice_number`.
  - Ejecuta `revalidatePath("/invoices")` y `revalidatePath("/invoices/[id]")`.

### 13.4 `voidInvoice(formData)`

- **Módulo**: `modules/invoices/actions.ts`
- **Propósito**: anular una factura emitida.
- **Entrada (FormData)**:
  - `id` (obligatorio): UUID de la factura a anular.
- **Salida**: `InvoiceActionResult`.
- **Validaciones**:
  - Sesión activa, rol `CLIENT`, taller activo.
  - La factura existe, pertenece al taller y tiene `status = 'issued'`.
- **Comportamiento**:
  - Actualiza `status = 'void'` y `voided_at = now()`.
  - Ejecuta `revalidatePath("/invoices")` y `revalidatePath("/invoices/[id]")`.

### 13.5 `deleteInvoice(formData)`

- **Módulo**: `modules/invoices/actions.ts`
- **Propósito**: eliminar físicamente un borrador.
- **Entrada (FormData)**:
  - `id` (obligatorio): UUID de la factura a eliminar.
- **Salida**: `InvoiceActionResult`.
- **Validaciones**:
  - Sesión activa, rol `CLIENT`, taller activo.
  - La factura existe, pertenece al taller y tiene `status = 'draft'`.
- **Comportamiento**:
  - Elimina la factura (cascade elimina líneas y ajustes).
  - Ejecuta `revalidatePath("/invoices")`.

### 13.6 `createCustomerFromInvoice(formData)`

- **Módulo**: `modules/invoices/actions.ts`
- **Propósito**: crear un cliente activo rápidamente desde el flujo de factura.
- **Entrada (FormData)**:
  - `name` (obligatorio): nombre del cliente.
  - `document_type_id` (opcional): UUID del tipo de documento.
  - `document_number` (opcional): número de documento.
  - `phone` (opcional).
  - `email` (opcional).
  - `address` (opcional).
- **Salida**: `CustomerFromInvoiceResult` (`{ success: true, customerId?: string }` o `{ success: false, error?: string, fieldErrors?: Record<string, string> }`).
- **Validaciones**:
  - Sesión activa, rol `CLIENT`, taller activo.
  - `name` no vacío tras `trim`, máximo 255 caracteres.
  - Unicidad de documento por taller si `document_type_id` y `document_number` están presentes.
  - Campos opcionales validados igual que `modules/clients/validations.ts`.
- **Comportamiento**:
  - Inserta un cliente con `workshop_id` resuelto en servidor, `is_active = true`.
  - Retorna `customerId` para que el componente lo seleccione en la factura.
  - Ejecuta `revalidatePath("/customers")`.

---

## 14. Estructuras de `FormData` y tipos de datos esperados

### 14.1 FormData de Server Actions

```text
createInvoiceDraft:
  customer_id: string                    (obligatorio, UUID)
  line_count: string                     (obligatorio, entero >= 1)
  line_0_service_id: string              (opcional, UUID)
  line_0_description: string             (obligatorio)
  line_0_quantity: string                (obligatorio, decimal)
  line_0_unit_price_cop: string          (obligatorio, decimal COP)
  line_1_...
  adj_count: string                      (opcional, entero >= 0)
  adj_0_label: string                    (obligatorio si adj_count > 0)
  adj_0_category: string                 (obligatorio: tax|withholding|discount|fee)
  adj_0_mode: string                     (obligatorio: percentage|fixed)
  adj_0_value: string                    (obligatorio, decimal)
  adj_1_...
  payment_method: string                 (opcional)
  notes: string                          (opcional)

updateInvoiceDraft:
  id: string                             (obligatorio, UUID)
  customer_id: string                    (obligatorio, UUID)
  line_count: string                     (obligatorio)
  line_0_...
  adj_count: string                      (opcional)
  adj_0_...
  payment_method: string                 (opcional)
  notes: string                          (opcional)

issueInvoice:
  id: string                             (obligatorio, UUID)
  payment_method: string                 (obligatorio)
  payment_instructions: string           (opcional)

voidInvoice:
  id: string                             (obligatorio, UUID)

deleteInvoice:
  id: string                             (obligatorio, UUID)

createCustomerFromInvoice:
  name: string                           (obligatorio)
  document_type_id: string               (opcional, UUID)
  document_number: string                (opcional)
  phone: string                          (opcional)
  email: string                          (opcional)
  address: string                        (opcional)
```

### 14.2 Tipos en `modules/invoices/types.ts`

```text
Invoice
  id: string
  workshopId: string
  customerId: string
  number: number | null
  status: 'draft' | 'issued' | 'void'
  currency: string
  issuedAt: string | null
  subtotalCop: number
  totalAdjustmentsCop: number
  totalCop: number
  paymentMethod: string | null
  paymentInstructions: string | null
  notes: string | null
  voidedAt: string | null
  createdAt: string
  updatedAt: string

InvoiceLine
  id: string
  invoiceId: string
  serviceId: string | null
  descriptionSnapshot: string
  quantity: number
  unitPriceCop: number
  lineTotalCop: number
  createdAt: string

InvoiceAdjustment
  id: string
  invoiceId: string
  label: string
  category: 'tax' | 'withholding' | 'discount' | 'fee'
  mode: 'percentage' | 'fixed'
  value: number
  baseCop: number
  amountCop: number
  effect: 'add' | 'subtract'
  sortOrder: number
  createdAt: string

InvoiceWithRelations
  invoice: Invoice
  customer: Customer
  lines: InvoiceLine[]
  adjustments: InvoiceAdjustment[]

InvoiceLineInput
  serviceId: string | null
  description: string
  quantity: number
  unitPriceCop: number

InvoiceAdjustmentInput
  label: string
  category: 'tax' | 'withholding' | 'discount' | 'fee'
  mode: 'percentage' | 'fixed'
  value: number

InvoiceInput
  customerId: string
  lines: InvoiceLineInput[]
  adjustments: InvoiceAdjustmentInput[]
  paymentMethod: string | null
  notes: string | null

InvoiceActionResult
  success: boolean
  error?: string
  fieldErrors?: Record<string, string>
  invoiceId?: string

CustomerFromInvoiceResult
  success: boolean
  error?: string
  fieldErrors?: Record<string, string>
  customerId?: string

InvoiceTotals
  subtotalCop: number
  totalAdjustmentsCop: number
  totalCop: number
  adjustments: Array<{
    id: string
    baseCop: number
    amountCop: number
    effect: 'add' | 'subtract'
  }>
```

### 14.3 Funciones de query en `modules/invoices/queries.ts`

```text
listInvoices(supabase, options?: { status?: invoice_status }): Promise<Invoice[]>
  - Lista facturas del taller del usuario autenticado.
  - Filtra por status si se especifica.
  - Ordena por created_at desc.
  - Incluye join con customers para mostrar nombre del cliente.

getInvoiceById(supabase, id): Promise<InvoiceWithRelations | null>
  - Obtiene una factura con sus líneas, ajustes y cliente (datos actuales).
  - Retorna null si no existe o no pertenece al taller del usuario.

getInvoiceForPdf(supabase, id): Promise<InvoicePdfData | null>
  - Obtiene la factura completa con líneas, ajustes, cliente, configuración del taller y URL del logo.
  - Usada por el Route Handler de PDF.
  - Retorna null si no existe o no pertenece al taller del usuario (o si es ADMIN, de cualquier taller).

getInvoiceStats(supabase): Promise<InvoiceStats>
  - Indicadores agregados para el dashboard (módulo 4.6).
  - Total facturado por periodo, cantidad por estado, facturas recientes.
```

### 14.4 Validaciones en `modules/invoices/validations.ts`

```text
validateInvoiceInput(input: InvoiceInput):
  | { valid: true }
  | { valid: false; result: InvoiceActionResult }

  - customerId: no vacío.
  - lines: mínimo 1, máximo 50.
    - description: trim, no vacío, max 500.
    - quantity: > 0, <= 9999999.99, hasta 2 decimales.
    - unitPriceCop: >= 0, <= 9999999999.99, hasta 2 decimales.
  - adjustments: mínimo 0, máximo 20.
    - label: trim, no vacío, max 100.
    - category: uno de tax|withholding|discount|fee.
    - mode: uno de percentage|fixed.
    - value: >= 0; si percentage, <= 100. Hasta 2 decimales.
  - paymentMethod: si presente, max 50.
  - notes: si presente, max 2000.

calculateInvoiceTotals(lines: InvoiceLineInput[], adjustments: InvoiceAdjustmentInput[]):
  | { valid: true; totals: InvoiceTotals }
  | { valid: false; error: string }

  - Calcula subtotalCop = suma de quantity * unitPriceCop por línea.
  - Aplica ajustes secuencialmente según sort_order:
    - Para percentage: base = subtotal (primer ajuste) o resultado acumulado (siguientes).
    - amountCop = base * value / 100 (percentage) o value (fixed).
    - Si effect = add: resultado += amountCop.
    - Si effect = subtract: resultado -= amountCop.
  - totalAdjustmentsCop = suma de ajustes add - suma de ajustes subtract.
  - totalCop = subtotalCop + totalAdjustmentsCop.
  - Valida totalCop >= 0.
```

---

## 15. Componentes de UI necesarios y responsabilidades

### 15.1 `InvoiceList`

- **Ubicación**: `modules/invoices/components/InvoiceList.tsx`
- **Tipo**: client component.
- **Responsabilidad**: lista de facturas con filtro por estado, búsqueda por número o cliente, badges de estado y botón "Crear factura".
- **Props**:
  - `invoices: Invoice[]` (con nombre del cliente incluido).
- **Características**:
  - Filtro por estado: todos, borrador, emitidas, anuladas.
  - Búsqueda por número o nombre del cliente.
  - Cada item muestra: número (o "Borrador"), nombre del cliente, total COP, fecha, badge de estado.
  - Link a `/invoices/[id]` por cada item.
  - Botón "Crear factura" link a `/invoices/new`.
  - Estado vacío: "No hay facturas" con botón "Crear factura".
  - Mobile-first: lista vertical, touch targets >= 44x44 px.

### 15.2 `InvoiceForm`

- **Ubicación**: `modules/invoices/components/InvoiceForm.tsx`
- **Tipo**: client component.
- **Responsabilidad**: formulario de creación/edición de borrador. Integra `CustomerPicker`, `InvoiceLineEditor`, `InvoiceAdjustmentEditor`, `InvoiceSummary`.
- **Props**:
  - `mode: 'create' | 'edit'`.
  - `invoice?: InvoiceWithRelations` (para edición).
  - `services: Service[]` (catálogo activo).
  - `action: (formData: FormData) => Promise<InvoiceActionResult>` (crear o actualizar).
  - `issueAction?: (formData: FormData) => Promise<InvoiceActionResult>` (emitir, solo en edición).
  - `deleteAction?: (formData: FormData) => Promise<InvoiceActionResult>` (eliminar, solo en edición).
- **Características**:
  - Renderiza `CustomerPicker` para seleccionar o crear cliente.
  - Renderiza `InvoiceLineEditor` para gestionar líneas.
  - Renderiza `InvoiceAdjustmentEditor` para gestionar ajustes.
  - Renderiza `InvoiceSummary` con cálculos orientativos.
  - Campos `payment_method` (select: efectivo, transferencia, tarjeta) y `notes` (textarea).
  - Botones: "Guardar borrador" (crear/editar), "Emitir factura" (solo edit, abre confirmación), "Eliminar borrador" (solo edit, abre confirmación).
  - Validación manual en cliente antes de enviar.
  - Muestra `fieldErrors` bajo cada campo.
  - Al éxito, `showToast.success` y redirección/refresh.
  - Al error, `showToast.error`.
  - Mobile-first: campos a ancho completo, touch targets >= 44x44 px.

### 15.3 `CustomerPicker`

- **Ubicación**: `modules/invoices/components/CustomerPicker.tsx`
- **Tipo**: client component.
- **Responsabilidad**: buscar y seleccionar un cliente activo existente o crear uno nuevo rápidamente.
- **Props**:
  - `selectedCustomerId: string | null`.
  - `onSelect: (customerId: string) => void`.
  - `customers: Customer[]` (lista inicial o resultado de búsqueda).
- **Características**:
  - Input de búsqueda que filtra clientes por nombre o documento (debounce).
  - Lista de resultados con nombre, documento y teléfono.
  - Al seleccionar, llama `onSelect` y muestra los datos del cliente.
  - Botón "Crear cliente nuevo" que muestra un formulario inline con nombre (obligatorio) y campos opcionales.
  - Al crear, invoca `createCustomerFromInvoice` y llama `onSelect` con el nuevo `customerId`.
  - Muestra `showToast.success("Cliente creado")` al crear.
  - Muestra `showToast.error` si falla.
  - Mobile-first: lista vertical, touch targets >= 44x44 px.

### 15.4 `InvoiceLineEditor`

- **Ubicación**: `modules/invoices/components/InvoiceLineEditor.tsx`
- **Tipo**: client component.
- **Responsabilidad**: agregar, editar y eliminar líneas de la factura.
- **Props**:
  - `lines: InvoiceLineInput[]`.
  - `services: Service[]`.
  - `onChange: (lines: InvoiceLineInput[]) => void`.
- **Características**:
  - Cada línea tiene: selector de servicio (opcional, dropdown del catálogo), descripción (texto), cantidad (number), precio unitario (number COP), total de línea (calculado en cliente, orientativo).
  - Al seleccionar un servicio, copia nombre y precio base como valores iniciales editables.
  - Botón "Agregar línea" al final.
  - Botón "Eliminar" por cada línea.
  - Validación visual: descripción no vacía, cantidad > 0, precio >= 0.
  - Límite de 50 líneas; el botón "Agregar línea" se deshabilita al llegar al límite.
  - Mobile-first: cada línea como tarjeta apilada verticalmente.

### 15.5 `InvoiceAdjustmentEditor`

- **Ubicación**: `modules/invoices/components/InvoiceAdjustmentEditor.tsx`
- **Tipo**: client component.
- **Responsabilidad**: agregar, editar y eliminar ajustes de la factura.
- **Props**:
  - `adjustments: InvoiceAdjustmentInput[]`.
  - `onChange: (adjustments: InvoiceAdjustmentInput[]) => void`.
- **Características**:
  - Cada ajuste tiene: etiquiqueta (texto), categoría (select: impuesto, retención, descuento, cobro), modo (select: porcentaje, fijo), valor (number).
  - El efecto (suma/resta) se muestra automáticamente según categoría: impuesto/cobro suman; retención/descuento restan.
  - Botón "Agregar ajuste" al final.
  - Botón "Eliminar" por cada ajuste.
  - Validación visual: etiqueta no vacía, valor >= 0, porcentaje <= 100.
  - Límite de 20 ajustes; el botón se deshabilita al llegar al límite.
  - Mobile-first: cada ajuste como tarjeta apilada verticalmente.

### 15.6 `InvoiceSummary`

- **Ubicación**: `modules/invoices/components/InvoiceSummary.tsx`
- **Tipo**: client component (presentacional).
- **Responsabilidad**: mostrar subtotal, ajustes con monto y efecto, y total. Cálculos orientativos que se revalidan en el servidor.
- **Props**:
  - `lines: InvoiceLineInput[]`.
  - `adjustments: InvoiceAdjustmentInput[]`.
- **Características**:
  - Calcula subtotal orientativo: suma de `quantity * unitPriceCop`.
  - Calcula cada ajuste orientativo y su efecto.
  - Calcula total orientativo.
  - Muestra cada ajuste con su etiqueta, monto y signo (+/-).
  - Formato de moneda COP con `Intl.NumberFormat("es-CO", { style: "currency", currency: "COP" })`.
  - Advertencia si el total es negativo: "El total no puede ser negativo."
  - Mobile-first: lista vertical de conceptos.

### 15.7 `InvoiceDetail`

- **Ubicación**: `modules/invoices/components/InvoiceDetail.tsx`
- **Tipo**: server component.
- **Responsabilidad**: vista de detalle de factura. Decide qué renderizar según el estado.
- **Props**:
  - `invoice: InvoiceWithRelations`.
  - `workshopSettings: WorkshopSettings`.
  - `logoUrl: string | null`.
- **Características**:
  - Si `status = 'draft'`: renderiza `InvoiceForm` en modo edición con `issueAction` y `deleteAction`.
  - Si `status = 'issued'`: renderiza vista de solo lectura con datos del taller, cliente, líneas, ajustes, totales, método de pago, instrucciones. Botones "Anular" (`InvoiceVoidButton`) y "Descargar PDF" (`InvoicePdfLink`).
  - Si `status = 'void'`: renderiza vista de solo lectura con marca "ANULADA". Botón "Descargar PDF".
  - Formato de moneda COP en todos los valores.

### 15.8 `InvoiceStatusBadge`

- **Ubicación**: `modules/invoices/components/InvoiceStatusBadge.tsx`
- **Tipo**: client component (presentacional).
- **Responsabilidad**: badge de color según estado.
- **Props**:
  - `status: 'draft' | 'issued' | 'void'`.
- **Características**:
  - `draft`: gris, texto "Borrador".
  - `issued`: verde, texto "Emitida".
  - `void`: rojo, texto "Anulada".

### 15.9 `InvoiceIssueButton`

- **Ubicación**: `modules/invoices/components/InvoiceIssueButton.tsx`
- **Tipo**: client component.
- **Responsabilidad**: botón con confirmación que invoca `issueInvoice`.
- **Props**:
  - `invoiceId: string`.
  - `action: (formData: FormData) => Promise<InvoiceActionResult>`.
- **Características**:
  - Diálogo de confirmación: "¿Seguro que deseas emitir esta factura? Una vez emitida no se podrá editar."
  - Al confirmar, construye `FormData` con `id`, `payment_method`, `payment_instructions` y invoca `action`.
  - `showToast.success("Factura emitida")` al éxito.
  - `showToast.error` al fallo.
  - Touch target >= 44x44 px.

### 15.10 `InvoiceVoidButton`

- **Ubicación**: `modules/invoices/components/InvoiceVoidButton.tsx`
- **Tipo**: client component.
- **Responsabilidad**: botón con doble confirmación que invoca `voidInvoice`.
- **Props**:
  - `invoiceId: string`.
  - `action: (formData: FormData) => Promise<InvoiceActionResult>`.
- **Características**:
  - Diálogo de doble confirmación: "Esta acción no se puede deshacer. ¿Anular la factura?"
  - Al confirmar, construye `FormData` con `id` y invoca `action`.
  - `showToast.success("Factura anulada")` al éxito.
  - `showToast.error` al fallo.
  - Touch target >= 44x44 px.

### 15.11 `InvoiceDeleteButton`

- **Ubicación**: `modules/invoices/components/InvoiceDeleteButton.tsx`
- **Tipo**: client component.
- **Responsabilidad**: botón con doble confirmación que invoca `deleteInvoice`. Solo visible en `draft`.
- **Props**:
  - `invoiceId: string`.
  - `action: (formData: FormData) => Promise<InvoiceActionResult>`.
- **Características**:
  - Diálogo de doble confirmación: "Se eliminará permanentemente. ¿Continuar?"
  - Al confirmar, construye `FormData` con `id` y invoca `action`.
  - `showToast.success("Borrador eliminado")` al éxito y redirección a `/invoices`.
  - `showToast.error` al fallo.
  - Touch target >= 44x44 px.

### 15.12 `InvoicePdfLink`

- **Ubicación**: `modules/invoices/components/InvoicePdfLink.tsx`
- **Tipo**: client component (presentacional).
- **Responsabilidad**: enlace al Route Handler de PDF.
- **Props**:
  - `invoiceId: string`.
  - `label?: string` (default "Descargar PDF").
- **Características**:
  - Renderiza un `<a href="/invoices/[id]/pdf" download>`.
  - Touch target >= 44x44 px.

### 15.13 `NotFoundNotice`

- **Ubicación**: `modules/invoices/components/NotFoundNotice.tsx`
- **Tipo**: server component o componente simple.
- **Responsabilidad**: estado "no encontrado" cuando la factura no existe o no pertenece al taller.
- **Características**:
  - Mensaje: "No se encontró la factura."
  - Enlace "Volver a facturas" hacia `/invoices`.
  - Mobile-first, centrado.

---

## 16. Generación de PDF

### 16.1 Route Handler

- **Ruta**: `app/(private)/invoices/[id]/pdf/route.ts`
- **Método**: `GET`
- **Librería**: `pdfkit` (dependencia nueva, ligera, sin dependencias nativas pesadas).
- **Validaciones**:
  - Sesión activa.
  - `CLIENT`: la factura debe pertenecer al taller del usuario.
  - `ADMIN`: puede descargar PDF de cualquier factura.
  - Si no existe o no pertenece (y no es `ADMIN`), retorna 404.
- **Obtención de datos**:
  - Factura (`getInvoiceForPdf`).
  - Líneas ordenadas por `created_at`.
  - Ajustes ordenados por `sort_order`.
  - Cliente (datos actuales por `customer_id`).
  - Configuración del taller (`getCurrentWorkshopSettings` o equivalente para ADMIN).
  - URL firmada del logo (`getWorkshopLogoUrl`) si `logo_path` existe.
- **Generación**:
  - Crea un documento PDF en memoria con `pdfkit`.
  - Construye el contenido (ver 16.2).
  - Transmite con headers:
    - `Content-Type: application/pdf`
    - `Content-Disposition: attachment; filename="{prefijo}-{numero}.pdf"` (o `borrador-{id}.pdf` para drafts).
  - No persiste el PDF.

### 16.2 Contenido del PDF

1. **Encabezado:**
   - Logo del taller (si existe), alineado a la izquierda.
   - Nombre comercial del taller.
   - Identificación fiscal, teléfono, email, dirección.
2. **Título y número:**
   - "FACTURA" o "BORRADOR" según estado.
   - Número: `{prefijo}-{numero}` (ej. `TAL-1`) o "Sin número" si es draft.
   - Fecha de emisión (si `issued`) o fecha de creación (si `draft`).
3. **Datos del cliente (datos actuales):**
   - Nombre.
   - Tipo y número de documento (si tiene).
   - Teléfono, email, dirección (si tiene).
4. **Tabla de líneas:**
   - Columnas: Descripción, Cantidad, Precio unitario (COP), Total (COP).
   - Una fila por línea.
5. **Ajustes:**
   - Cada ajuste con etiqueta, monto y signo (+/-).
   - Subtotal.
   - Total ajustes.
   - Total.
6. **Método de pago e instrucciones:**
   - Método de pago.
   - Instrucciones de pago (si tiene).
7. **Marcas según estado:**
   - `draft`: marca "Borrador - No válido" en el encabezado, visible.
   - `void`: marca "ANULADA" en el encabezado, visible.
   - `issued`: sin marca adicional.

### 16.3 Formato de moneda

Todos los valores COP se formatean con `Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0, maximumFractionDigits: 2 })`.

---

## 17. Criterios de aceptación verificables

1. Un `CLIENT` autenticado accede a `/invoices` y ve el historial de facturas con filtros por estado y búsqueda.
2. Si no hay facturas, la página muestra "No hay facturas" con botón "Crear factura".
3. Un `CLIENT` toca "Crear factura" y navega a `/invoices/new` donde ve el formulario con selector de cliente, editor de líneas, editor de ajustes y resumen.
4. El `CLIENT` puede buscar un cliente activo existente por nombre o documento y seleccionarlo.
5. El `CLIENT` puede crear un cliente nuevo desde el flujo de factura con nombre obligatorio y campos opcionales; el cliente queda seleccionado automáticamente.
6. El `CLIENT` puede agregar líneas seleccionando un servicio del catálogo (copia descripción y precio base) o creando una línea personalizada.
7. El `CLIENT` puede editar la descripción, cantidad y precio de cada línea; el total de línea se actualiza orientativamente.
8. El `CLIENT` puede agregar cero o más ajustes con categoría, modo y valor; el efecto (suma/resta) se muestra automáticamente según la categoría.
9. El `CLIENT` puede guardar un borrador y se redirige a `/invoices/[id]`.
10. El `CLIENT` puede editar un borrador existente: modificar líneas, ajustes, método de pago y notas.
11. Al guardar cambios, el servidor recalcula subtotal, ajustes y total; los valores persisten correctamente.
12. El `CLIENT` puede emitir un borrador; se exige método de pago antes de emitir.
13. La factura emitida recibe un número único con el prefijo configurado (ej. `TAL-1`).
14. Dos emisiones simultáneas del mismo taller reciben números distintos sin duplicados.
15. Una factura emitida no se puede editar ni eliminar; solo se puede anular.
16. El `CLIENT` puede anular una factura emitida con doble confirmación; la factura queda `void` con `voided_at`.
17. Una factura anulada es completamente de solo lectura; no se puede editar, re-emitir ni eliminar.
18. El `CLIENT` puede eliminar un borrador con doble confirmación; se elimina físicamente.
19. El `CLIENT` puede descargar el PDF de cualquier factura (`draft`, `issued`, `void`).
20. El PDF de un borrador lleva marca "Borrador - No válido".
21. El PDF de una factura anulada lleva marca "ANULADA".
22. El PDF contiene: logo (si existe), datos del taller, número, fecha, datos del cliente (actuales), líneas, ajustes, subtotal, total, método de pago e instrucciones de pago.
23. Los datos del cliente en la factura siempre muestran la información actual del cliente.
24. Un `ADMIN` puede ver el historial y detalle de facturas de cualquier taller.
25. Un `ADMIN` puede descargar el PDF de facturas de cualquier taller.
26. Un `ADMIN` no puede crear, editar, emitir, anular ni eliminar facturas; las Server Actions rechazan la operación.
27. Un `CLIENT` no puede acceder a facturas de otro taller; la página muestra "No se encontró la factura".
28. Si el cliente fue desactivado después de crear el borrador, la emisión se bloquea con error "El cliente no está activo."
29. Si el total calculado es negativo, la emisión se bloquea con error "El total no puede ser negativo."
30. Todas las notificaciones usan `nextjs-toast-notify` en `position: "top-right"`.
31. Las pantallas tienen estados de carga, vacío, éxito y error, y funcionan primero en móvil.
32. Los touch targets son >= 44x44 px.
33. `pnpm lint` pasa sin errores.
34. `pnpm build` compila sin errores.

---

## 18. Estrategia de pruebas

### 18.1 Verificación manual con `pnpm dev`

- Login como `CLIENT` y acceso a `/invoices`.
- Verificar que la lista carga con filtros y búsqueda.
- Verificar estado vacío cuando no hay facturas.
- Crear una factura nueva: seleccionar cliente, agregar líneas, agregar ajustes, guardar borrador.
- Crear un cliente nuevo desde el flujo de factura y verificar que queda seleccionado.
- Editar el borrador: modificar líneas y ajustes, guardar cambios.
- Emitir el borrador: verificar que se asigna número y no se puede editar.
- Intentar emitir sin método de pago y verificar error.
- Anular la factura emitida con doble confirmación y verificar estado `void`.
- Intentar anular un borrador y verificar error.
- Intentar editar una factura emitida y verificar que no hay formulario.
- Intentar eliminar una factura emitida y verificar error.
- Eliminar un borrador con doble confirmación y verificar redirección.
- Descargar PDF de un borrador y verificar marca "Borrador - No válido".
- Descargar PDF de una factura emitida y verificar contenido completo.
- Descargar PDF de una factura anulada y verificar marca "ANULADA".
- Desactivar un cliente y intentar emitir una factura suya; verificar error.
- Configurar ajustes que produzcan total negativo y verificar error al emitir.
- Login como `ADMIN` y acceder a facturas de cualquier taller.
- Verificar que `ADMIN` puede ver y descargar PDF pero no hay botones de mutación.

### 18.2 Verificación de concurrencia

- Simular dos emisiones simultáneas del mismo taller (dos pestañas o dos clientes HTTP).
- Verificar que cada una recibe un número distinto sin duplicados.

### 18.3 Verificación de aislamiento

- Como `CLIENT` A, intentar acceder a `/invoices/[id]` de una factura del `CLIENT` B.
- Verificar que se muestra "No se encontró la factura" (404/NotFoundNotice).

### 18.4 Verificación de RLS

- Un `CLIENT` puede leer y mutar facturas, líneas y ajustes de su taller.
- Un `CLIENT` no puede leer ni mutar facturas de otro taller.
- Un `ADMIN` puede leer facturas, líneas y ajustes de cualquier taller.
- Un `ADMIN` no puede mutar facturas, líneas ni ajustes.

### 18.5 Verificación de compilación

- `pnpm lint` sin errores.
- `pnpm build` sin errores de tipos ni rutas.

---

## 19. Estructura final de archivos

```text
confectu/
├── app/
│   └── (private)/
│       └── invoices/
│           ├── page.tsx                                (modifica)
│           ├── new/
│           │   └── page.tsx                            (nuevo)
│           └── [id]/
│               ├── page.tsx                            (nuevo)
│               └── pdf/
│                   └── route.ts                        (nuevo)
│
├── modules/
│   └── invoices/                                       (nuevo)
│       ├── components/
│       │   ├── InvoiceList.tsx                         (nuevo)
│       │   ├── InvoiceForm.tsx                         (nuevo)
│       │   ├── CustomerPicker.tsx                      (nuevo)
│       │   ├── InvoiceLineEditor.tsx                   (nuevo)
│       │   ├── InvoiceAdjustmentEditor.tsx             (nuevo)
│       │   ├── InvoiceSummary.tsx                      (nuevo)
│       │   ├── InvoiceDetail.tsx                       (nuevo)
│       │   ├── InvoiceStatusBadge.tsx                  (nuevo)
│       │   ├── InvoiceIssueButton.tsx                  (nuevo)
│       │   ├── InvoiceVoidButton.tsx                   (nuevo)
│       │   ├── InvoiceDeleteButton.tsx                 (nuevo)
│       │   ├── InvoicePdfLink.tsx                      (nuevo)
│       │   └── NotFoundNotice.tsx                      (nuevo)
│       ├── actions.ts                                  (nuevo)
│       ├── queries.ts                                  (nuevo)
│       ├── types.ts                                    (nuevo)
│       ├── validations.ts                              (nuevo)
│       └── pdf.ts                                      (nuevo)
│
├── supabase/
│   └── migrations/
│       └── 20260825180000_invoices_remove_snapshots_issue_function.sql  (nuevo)
│
├── docs/
│   └── modules.md                                      (modifica)
│
└── specs/
    └── modulo_4.5.md                                   (este archivo)
```

### Notas sobre la estructura

- `modules/invoices/` contiene toda la lógica de negocio del módulo: componentes, Server Actions, consultas, tipos, validaciones y la lógica de generación de PDF.
- `modules/invoices/pdf.ts` contiene la función que construye el documento PDF usando `pdfkit`, separada del Route Handler para poder testearla independientemente.
- Las rutas en `app/` actúan solo como entradas de pantalla y delegan la lógica al módulo.
- El módulo importa funciones públicas de `modules/clients/`, `modules/services/` y `modules/workshops/`, nunca archivos internos.
- La migración elimina las columnas de snapshot, actualiza RLS de líneas y ajustes para ADMIN, y crea la función atómica `issue_invoice`.

---

## 20. Dependencias

### Nuevas

- `pdfkit` — librería ligera de generación de PDF en el servidor. Sin dependencias nativas pesadas. Se usa en `modules/invoices/pdf.ts` y el Route Handler de PDF.

### Existentes

- `@supabase/ssr` — manejo de sesión SSR con cookies.
- `@supabase/supabase-js` — cliente Supabase.
- `next` — App Router, Server Actions, Route Handlers.
- `react` — `useState`, `useFormStatus`, `useRouter`.
- `nextjs-toast-notify` — notificaciones toast. Ya instalada. Se usa `position: "top-right"`.

No se añaden librerías de formularios, validación ni UI. Se usan formularios nativos, validación HTML5 y validación manual con TypeScript.

---

## 21. Observaciones

- La decisión de eliminar los snapshots de cliente significa que las facturas emitidas no son documentos históricamente inmutables respecto a los datos del cliente: si se edita el cliente, todas sus facturas reflejarán los datos actualizados. Esto fue una decisión explícita del usuario durante el refinamiento del spec.
- La función atómica `issue_invoice` es `SECURITY DEFINER` para poder actualizar `workshop_settings.next_invoice_number` y `invoices` en una sola transacción con bloqueo de fila. Valida `auth.uid()` internamente para garantizar que solo el owner del taller pueda emitir.
- El PDF se genera en el servidor en el momento de la descarga y no se persiste, conforme a la decisión de alcance del MVP.
- El módulo 4.6 (dashboard) reutilizará las consultas públicas `listInvoices` y `getInvoiceStats` de este módulo, sin acceder directamente a las tablas internas.
- Las notificaciones con `nextjs-toast-notify` se usan en todos los componentes cliente que ejecutan acciones, siempre con `position: "top-right"`, conforme a `AGENTS.md`.
- La creación de cliente desde el flujo de factura (`createCustomerFromInvoice`) duplica las validaciones de `modules/clients/validations.ts` para no importar archivos internos del módulo de clientes. Alternativamente, se puede extraer la validación a una función pública compartida si se considera conveniente.
- El método de pago se almacena como texto libre o de un conjunto fijo (efectivo, transferencia, tarjeta). No se crea una tabla de catálogo de métodos de pago en el MVP.
