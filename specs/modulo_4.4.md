# Spec: Configuración del taller para CLIENT (módulo 4.4)

**Módulo:** `modules/workshops/`
**Número de spec:** 4.4
**Estado:** Pendiente de implementación
**Fecha:** 2026-08-24

---

## 1. Objetivo y alcance

Implementar el módulo `modules/workshops/` para que el usuario con rol `CLIENT` pueda editar la configuración de su propio taller desde la ruta existente `/settings`. El módulo debe reutilizar la interfaz de configuración desarrollada para `ADMIN` en el módulo 4.7.3, extrayendo el formulario compartido a `modules/workshops/components/`.

Además, el módulo debe exponer consultas públicas para que otros módulos (dashboard, facturas, generación de PDF) obtengan la configuración del taller actual sin acceder a archivos internos de `modules/auth/`.

### Dentro del alcance

- Editar los datos comerciales del taller del `CLIENT` autenticado:
  - Nombre comercial.
  - Identificación fiscal.
  - Teléfono, correo electrónico y dirección.
  - Prefijo de factura.
  - Instrucciones de pago.
  - Logo opcional (subida, reemplazo y eliminación).
- Reutilizar `WorkshopSettingsForm` entre la vista de `CLIENT` (`/settings`) y la vista de `ADMIN` (`/admin/workshops/[id]`).
- Exponer la consulta pública `getCurrentWorkshopSettings` para otros módulos.
- Actualizar `docs/modules.md` marcando el módulo 4.4 como `IMPLEMENTADO`.

### Fuera del alcance

- Crear, eliminar, activar o desactivar talleres (permanece en `modules/admin/workshops/`).
- Permitir al `CLIENT` editar el **siguiente número de factura**; ese valor lo gestiona y autoincrementa el sistema al emitir facturas (módulo 4.5) y puede ser ajustado por `ADMIN`.
- Facturación, dashboard, reportes y PDF (estos módulos consumirán la consulta pública de este spec).
- Nuevas tablas, migraciones o políticas RLS: las existentes ya permiten al dueño del taller leer y mutar su configuración y su logo.

---

## 2. Actores y permisos

| Actor | Descripción | Acceso |
|---|---|---|
| `CLIENT` | Propietario de un taller. | Edita la configuración de su taller en `/settings`. No accede a `/admin/*`. |
| `ADMIN` | Administrador global de Confectu. | Sigue gestionando cualquier taller en `/admin/workshops/*`, incluyendo el siguiente número de factura. |
| Usuario no autenticado | Sin sesión activa. | Redirigido a `/login`. |
| Usuario inactivo | Cuenta desactivada. | Redirigido a `/account-disabled`. |

### Reglas de permisos

- El taller se resuelve en el servidor a partir del usuario autenticado (`workshops.owner_id`). No se acepta `workshop_id` desde el formulario del cliente sin validación.
- Las Server Actions de `modules/workshops/` validan sesión activa, rol `CLIENT` y que el taller del usuario esté activo.
- `CLIENT` no puede acceder a rutas `/admin/*`; el middleware (`proxy.ts`) lo redirige a `/dashboard`.
- `ADMIN` sigue usando `modules/admin/workshops/actions.ts`, que valida rol `ADMIN`.
- Las políticas RLS existentes son suficientes; no se requiere modificarlas.

---

## 3. Flujo principal y flujos alternativos

### 3.1 Flujo: editar configuración del taller (CLIENT)

1. `CLIENT` toca "Configuración" en el menú privado (`PrivateHeader`).
2. Navega a `/settings`.
3. La página (Server Component) consulta `getCurrentWorkshopWithSettings`.
4. Si existe la configuración, se renderiza `WorkshopSettingsForm` con los datos actuales, la URL firmada del logo (si existe) y la Server Action `updateMyWorkshopSettings`.
5. El formulario muestra todos los campos editables, **pero oculta el campo "siguiente número de factura"**.
6. El usuario edita los campos, selecciona un nuevo logo o marca "Eliminar logo actual".
7. Al enviar, el formulario ejecuta una validación manual en cliente y luego invoca `updateMyWorkshopSettings`.
8. La Server Action valida la sesión, el rol, resuelve el taller, valida los campos, gestiona el logo y actualiza `workshop_settings`.
9. Si hay éxito, se muestra `showToast.success("Configuración del taller actualizada")` y se recarga la página.
10. Si hay errores de validación, se muestran `fieldErrors` bajo cada campo; si hay un error general, se muestra bajo el formulario.

### 3.2 Flujo: subir o reemplazar logo (CLIENT)

1. En `/settings`, el usuario selecciona una imagen en el campo de archivo.
2. El componente valida en cliente tipo (PNG, JPEG, WebP) y tamaño (máx 2 MB).
3. Si la validación falla, muestra `showToast.error` y limpia el campo.
4. Si la validación pasa, muestra una preview local.
5. Al enviar el formulario, la Server Action sube el archivo a `workshop-logos/{workshop_id}/logo.{ext}`.
6. Si ya existía un logo, la Server Action lo elimina antes de subir el nuevo.
7. Actualiza `workshop_settings.logo_path` con la nueva ruta.

### 3.3 Flujo: eliminar logo (CLIENT)

1. Si el taller tiene logo, el formulario muestra un checkbox "Eliminar logo actual".
2. El usuario lo marca y envía el formulario.
3. La Server Action elimina el archivo de Storage y guarda `logo_path = null`.
4. En éxito, la preview desaparece y se muestra toast de éxito.

### 3.4 Flujo: taller sin configuración

1. Si por alguna razón no existe fila en `workshop_settings` para el taller del usuario, la consulta retorna `null`.
2. La página muestra `NotFoundNotice` con mensaje "No se encontró la configuración del taller" y un enlace a `/dashboard`.

### 3.5 Flujo: acceso sin permiso

1. Un usuario no autenticado intenta acceder a `/settings`.
2. El middleware lo redirige a `/login`.
3. Un `CLIENT` inactivo es redirigido a `/account-disabled`.
4. Un `ADMIN` no usa `/settings`; el middleware lo redirige a `/admin` si intenta acceder a rutas privadas de cliente.

### 3.6 Flujo: vista ADMIN sigue funcionando con el componente compartido

1. `ADMIN` accede a `/admin/workshops/[id]`.
2. La página importa `WorkshopSettingsForm` desde `modules/workshops/components/`.
3. Pasa `showNextInvoiceNumber={true}` para que el campo "siguiente número de factura" sea visible y editable.
4. Pasa la Server Action `updateWorkshopSettings` de `modules/admin/workshops/actions.ts`.
5. El resto del comportamiento se mantiene igual que en el spec 4.7.3.

---

## 4. Reglas de negocio

1. **Nombre comercial obligatorio**: no vacío tras `trim`, máximo 255 caracteres.
2. **Identificación fiscal, teléfono, correo, dirección e instrucciones de pago opcionales**, con los límites de longitud establecidos.
3. **Prefijo de factura obligatorio**: regex `^[A-Z0-9]{1,3}$`; se convierte a mayúsculas antes de validar y guardar.
4. **Siguiente número de factura no editable por CLIENT**: el sistema lo autoincrementa al emitir facturas (módulo 4.5). En `/settings` el campo está oculto.
5. **ADMIN puede editar el siguiente número**, con la restricción de que no puede disminuir (regla existente del módulo 4.7.3).
6. **Logo opcional**: imágenes PNG, JPEG o WebP, máximo 2 MB.
7. **Ruta de logo**: `{workshop_id}/logo.{ext}` en el bucket privado `workshop-logos`.
8. **Reemplazo de logo**: al subir uno nuevo se elimina el anterior.
9. **Eliminación de logo**: borra el archivo de Storage y limpia `logo_path`.
10. **Sin eliminación física del taller**: el `CLIENT` no puede eliminar su cuenta/taller desde esta vista.
11. **`workshop_id` resuelto en servidor**: nunca se toma del formulario para mutar.
12. **Validaciones duplicadas en cliente y servidor**: HTML5 nativo, validación manual en el componente y validación en la Server Action.

---

## 5. Estados y transiciones

### 5.1 Configuración del taller

```text
onboarding (spec 1)
       │
       ▼
┌─────────────────┐
│  configuración  │◄── CLIENT edita datos comerciales, prefijo, logo,
│   del taller    │    instrucciones de pago.
└─────────────────┘
       │
       │ emite factura (spec 4.5)
       ▼
   next_invoice_number se autoincrementa
```

- La configuración del taller no tiene estados discretos; siempre existe una única fila por taller.
- Los cambios son inmediatos y afectan a las facturas emitidas a partir de ese momento.

### 5.2 Transiciones del logo

| Origen | Acción | Destino |
|---|---|---|
| Sin logo | Subir logo | Logo en Storage + `logo_path` actualizado |
| Con logo | Subir logo nuevo | Logo anterior eliminado + nuevo logo en Storage |
| Con logo | Eliminar logo | Storage limpio + `logo_path = null` |

---

## 6. Modelo de datos afectado

### 6.1 Sin migraciones nuevas

No se requieren migraciones. Se utilizan las tablas, índices, restricciones, funciones y políticas existentes:

- `public.workshops`
- `public.workshop_settings`
- Bucket `workshop-logos` y sus políticas de Storage

### 6.2 Tablas existentes utilizadas

```text
workshops
  id            uuid primary key
  owner_id      uuid not null unique
  is_active     boolean not null default true
  created_at    timestamptz not null
  updated_at    timestamptz not null

workshop_settings
  workshop_id           uuid primary key
  business_name         text not null
  tax_id                text
  phone                 text
  email                 text
  address               text
  invoice_prefix        varchar(3) not null
  next_invoice_number   bigint not null default 1
  payment_instructions  text
  logo_path             text
  created_at            timestamptz not null
  updated_at            timestamptz not null
```

### 6.3 Restricciones existentes relevantes

- `workshop_settings_invoice_prefix_check`: `invoice_prefix ~ '^[A-Z0-9]{1,3}$'`.
- `workshop_settings_next_invoice_number_check`: `next_invoice_number >= 1`.
- Trigger `workshop_settings_set_updated_at`: actualiza `updated_at` automáticamente.
- Trigger `workshops_set_updated_at`: actualiza `updated_at` automáticamente.

### 6.4 Storage

- Bucket privado `workshop-logos`.
- Políticas existentes permiten al `ADMIN` y al `owner_id` del taller leer, escribir y eliminar.
- Ruta por archivo: `{workshop_id}/logo.{ext}`.

---

## 7. Reglas de aislamiento multi-tenant y RLS

### 7.1 RLS existente de `workshops` y `workshop_settings`

```sql
-- workshops: el owner gestiona su taller; ADMIN gestiona todos.
workshops_select: using (owner_id = auth.uid() or is_admin())
workshops_update: using/check (owner_id = auth.uid() or is_admin())

-- workshop_settings: el owner del taller; ADMIN gestiona todas.
workshop_settings_select: using (workshop_id = current_workshop_id() or is_admin())
workshop_settings_update: using/check (workshop_id = current_workshop_id() or is_admin())
```

Estas políticas ya permiten al dueño del taller leer y actualizar su configuración. No se modifican.

### 7.2 Validación en Server Actions

- `updateMyWorkshopSettings` valida sesión activa, rol `CLIENT` y que el usuario tenga un taller activo.
- El `workshop_id` se resuelve en el servidor consultando `workshops` por `owner_id = auth.uid()`.
- No se confía en el `workshop_id` enviado desde el formulario.

### 7.3 Service role key

No se usa la service role key. Todas las operaciones se ejecutan con el cliente Supabase autenticado del usuario, respetando RLS y las políticas de Storage.

---

## 8. Validaciones funcionales

### 8.1 Editar configuración (`updateMyWorkshopSettings`)

| Campo | Regla |
|---|---|
| `business_name` | Obligatorio. No vacío tras `trim`. Máximo 255 caracteres. |
| `tax_id` | Opcional. Máximo 50 caracteres. |
| `phone` | Opcional. Máximo 50 caracteres. |
| `email` | Opcional. Máximo 255 caracteres. Formato de correo válido si presente. |
| `address` | Opcional. Máximo 500 caracteres. |
| `invoice_prefix` | Obligatorio. Regex `^[A-Z0-9]{1,3}$`. Se convierte a mayúsculas. |
| `payment_instructions` | Opcional. Máximo 1000 caracteres. |
| `logo` (File) | Opcional. Tipo MIME: `image/png`, `image/jpeg` o `image/webp`. Tamaño máximo 2 MB. |
| `remove_logo` | Opcional. Cadena `"true"` indica que se debe eliminar el logo actual. |

### 8.2 Validación de rol

| Regla | Descripción |
|---|---|
| Sesión activa | Si no hay sesión, retorna error "No hay sesión activa." |
| Rol `CLIENT` | Si el rol no es `CLIENT`, retorna error. |
| Taller activo | Si el usuario no tiene taller o está inactivo, retorna error. |

### 8.3 Validación de logo

- Cliente: tipo y tamaño validados antes de enviar.
- Servidor: valida nuevamente tipo y tamaño antes de subir a Storage.
- Si se sube un logo y luego la actualización de base de datos falla, el archivo subido se elimina para no dejar huérfanos.

---

## 9. Errores y estados de la interfaz

### 9.1 Página `/settings`

| Estado | Comportamiento |
|---|---|
| Loading | Spinner o esqueleto mientras carga la configuración. |
| Con datos | Formulario precargado con los datos actuales y preview del logo. |
| Sin configuración | `NotFoundNotice` con mensaje y enlace a `/dashboard`. |
| Error de carga | Mensaje "No se pudo cargar la configuración." con botón de reintentar. |
| Éxito de guardado | Toast `showToast.success("Configuración del taller actualizada")`. |
| Error de guardado | `fieldErrors` bajo cada campo + error general bajo el formulario. |

### 9.2 Formulario `WorkshopSettingsForm`

| Estado | Comportamiento |
|---|---|
| Idle | Campos editables. Campo "siguiente número de factura" oculto para `CLIENT`. |
| Validación inline | Errores mostrados bajo cada campo antes de enviar. |
| Loading | Botón "Guardar cambios" muestra "Guardando..." y se deshabilita. |
| Éxito | Toast y `router.refresh()`. |
| Error servidor | Errores por campo y mensaje general. |
| Logo inválido | Toast de error de tipo o tamaño. |
| Logo eliminado | Preview vacía y toast de éxito. |

---

## 10. Rutas y pantallas afectadas

| Ruta | Archivo | Descripción |
|---|---|---|
| `/settings` | `app/(private)/settings/page.tsx` (modifica) | Página de edición de la configuración del taller para `CLIENT`. |
| `/admin/workshops/[id]` | `app/(admin)/admin/workshops/[id]/page.tsx` (modifica) | Importa `WorkshopSettingsForm` desde `modules/workshops/components/` con `showNextInvoiceNumber={true}`. |
| `docs/modules.md` | `docs/modules.md` (modifica) | Actualizar estado del módulo 4.4 a `IMPLEMENTADO`. |

### Notas sobre organización de rutas

- `/settings` ya está protegida como ruta privada en `proxy.ts`.
- No se crean rutas anidadas; la configuración del taller se edita en una única pantalla.
- El `PrivateHeader` ya enlaza a `/settings`.

---

## 11. Server Actions necesarias

### 11.1 `updateMyWorkshopSettings(formData)`

- **Módulo**: `modules/workshops/actions.ts`
- **Propósito**: actualizar la configuración del taller del `CLIENT` autenticado.
- **Entrada (FormData)**:
  - `business_name` (obligatorio): nombre comercial, max 255.
  - `tax_id` (opcional): identificación fiscal, max 50.
  - `phone` (opcional): teléfono, max 50.
  - `email` (opcional): correo, max 255.
  - `address` (opcional): dirección, max 500.
  - `invoice_prefix` (obligatorio): prefijo, regex `^[A-Z0-9]{1,3}$`.
  - `payment_instructions` (opcional): instrucciones, max 1000.
  - `logo` (opcional): archivo de imagen PNG/JPEG/WebP, max 2 MB.
  - `remove_logo` (opcional): `"true"` si se debe eliminar el logo actual.
- **Salida**: `WorkshopActionResult` (`{ success: true }` o `{ success: false, error?: string, fieldErrors?: Record<string, string> }`).
- **Validaciones**:
  - Sesión activa.
  - Rol `CLIENT`.
  - Taller activo resuelto desde el usuario autenticado.
  - Campos validados con `validateWorkshopSettingsInput` de `modules/workshops/validations.ts`.
  - Logo validado en servidor si se envía.
- **Comportamiento**:
  - Resuelve `workshop_id` desde `workshops.owner_id = auth.uid()`.
  - Lee `logo_path` y `next_invoice_number` actuales.
  - Si hay logo nuevo, elimina el anterior, sube el nuevo y prepara `newLogoPath`.
  - Si `remove_logo === "true"`, elimina el logo de Storage y prepara `newLogoPath = null`.
  - Actualiza `workshop_settings` con los campos editables y `logo_path`; no modifica `next_invoice_number`.
  - Si la actualización falla después de subir un logo nuevo, elimina el archivo subido.
  - Ejecuta `revalidatePath("/settings")`.

---

## 12. Estructuras de `FormData` y tipos de datos

### 12.1 FormData de Server Actions

```text
updateMyWorkshopSettings:
  business_name: string       (obligatorio, no vacío tras trim, max 255)
  tax_id: string              (opcional, max 50)
  phone: string               (opcional, max 50)
  email: string               (opcional, max 255, formato correo)
  address: string             (opcional, max 500)
  invoice_prefix: string      (obligatorio, regex ^[A-Z0-9]{1,3}$)
  payment_instructions: string (opcional, max 1000)
  logo: File                  (opcional, PNG/JPEG/WebP, max 2MB)
  remove_logo: string         (opcional, "true")
```

### 12.2 Tipos en `modules/workshops/types.ts`

```text
Workshop
  id: string
  ownerId: string
  isActive: boolean
  createdAt: string
  updatedAt: string

WorkshopSettings
  workshopId: string
  businessName: string
  taxId: string | null
  phone: string | null
  email: string | null
  address: string | null
  invoicePrefix: string
  nextInvoiceNumber: number
  paymentInstructions: string | null
  logoPath: string | null
  createdAt: string
  updatedAt: string

WorkshopWithSettings
  workshop: Workshop
  settings: WorkshopSettings | null

WorkshopActionResult
  success: boolean
  error?: string
  fieldErrors?: Record<string, string>
```

> **Nota:** Para evitar duplicación, `modules/auth/types.ts` puede importar y re-exportar `WorkshopSettings` desde `modules/workshops/types.ts`.

### 12.3 Funciones de query en `modules/workshops/queries.ts`

```text
getCurrentWorkshop(supabase): Promise<Workshop | null>
  - Consulta workshops donde owner_id = auth.uid().
  - Retorna el taller del usuario autenticado o null.

getCurrentWorkshopSettings(supabase): Promise<WorkshopSettings | null>
  - Función PÚBLICA diseñada para ser importada por modules/invoices/, modules/dashboard/ y generación de PDF.
  - Resuelve el taller del usuario autenticado.
  - Consulta workshop_settings por workshop_id.
  - Retorna la configuración o null.

getCurrentWorkshopWithSettings(supabase): Promise<WorkshopWithSettings | null>
  - Combina getCurrentWorkshop y getCurrentWorkshopSettings.
  - Usada por /settings.

getWorkshopLogoUrl(supabase, logoPath): Promise<string | null>
  - Genera URL firmada de 60 segundos para el logo.
  - Función PÚBLICA reutilizable.
```

### 12.4 Validaciones en `modules/workshops/validations.ts`

```text
validateWorkshopSettingsInput(input: WorkshopSettingsInput):
  | { valid: true }
  | { valid: false; result: WorkshopActionResult }

  - business_name: trim.
    - Si vacío: fieldErrors.business_name = "El nombre comercial es obligatorio."
    - Si > 255: fieldErrors.business_name = "El nombre comercial debe tener máximo 255 caracteres."
  - tax_id: si presente, max 50.
  - phone: si presente, max 50.
  - email: si presente, formato válido, max 255.
  - address: si presente, max 500.
  - invoice_prefix: convertir a mayúsculas, trim.
    - Si vacío: fieldErrors.invoice_prefix = "El prefijo es obligatorio."
    - Si no cumple ^[A-Z0-9]{1,3}$: fieldErrors.invoice_prefix = "El prefijo debe tener 1 a 3 letras o números en mayúscula."
  - payment_instructions: si presente, max 1000.
```

---

## 13. Componentes de UI necesarios

### 13.1 `WorkshopSettingsForm`

- **Ubicación**: `modules/workshops/components/WorkshopSettingsForm.tsx`
- **Tipo**: client component.
- **Responsabilidad**: formulario nativo para editar la configuración del taller. Reutilizado tanto por `CLIENT` como por `ADMIN`.
- **Props**:
  - `workshop: WorkshopWithSettings`.
  - `logoUrl: string | null`.
  - `currentLogoPath: string | null`.
  - `action: (formData: FormData) => Promise<WorkshopActionResult>`.
  - `showNextInvoiceNumber?: boolean` (default `false`): si es `true`, muestra el campo editable del siguiente número (usado por `ADMIN`).
- **Campos**:
  - `business_name`: `<input type="text" required maxlength={255}>`.
  - `tax_id`: `<input type="text" maxlength={50}>`.
  - `phone`: `<input type="tel" maxlength={50}>`.
  - `email`: `<input type="email" maxlength={255}>`.
  - `address`: `<input type="text" maxlength={500}>`.
  - `invoice_prefix`: `<input type="text" required pattern="^[A-Z0-9]{1,3}$" maxlength={3}>`. Convierte a mayúsculas al escribir.
  - `next_invoice_number`: visible solo si `showNextInvoiceNumber === true`. `<input type="number" required min={1}>`.
  - `payment_instructions`: `<textarea maxlength={1000}>`.
  - Sección de logo: preview, input file, checkbox "Eliminar logo actual".
  - `<input type="hidden" name="workshop_id" value={workshop.workshop.id}>` (el servidor no lo usa sin validar).
- **Requisitos**:
  - Validación HTML5 nativa + validación manual en cliente.
  - Estado loading: botón "Guardar cambios" muestra "Guardando..." + `disabled` vía `useFormStatus`.
  - Muestra `fieldErrors` bajo cada campo.
  - Muestra error general bajo el formulario.
  - Al éxito, `showToast.success` y `router.refresh()`.
  - Importa `showToast` de `nextjs-toast-notify`, `position: "top-right"`.
  - Mobile-first: campos a ancho completo, labels visibles, touch targets >= 44x44 px.

### 13.2 `NotFoundNotice`

- **Ubicación**: `modules/workshops/components/NotFoundNotice.tsx`
- **Tipo**: server component o componente simple.
- **Responsabilidad**: estado "no encontrado" cuando no existe configuración del taller.
- **Contenido**:
  - Mensaje: "No se encontró la configuración del taller."
  - Enlace "Volver al inicio" hacia `/dashboard`.
- **Requisitos**:
  - Mobile-first, centrado.
  - Touch target mínimo 44x44 px.

---

## 14. Criterios de aceptación verificables

1. Un `CLIENT` autenticado accede a `/settings` y ve un formulario precargado con los datos de su taller.
2. El campo "siguiente número de factura" no aparece en `/settings`.
3. El `CLIENT` edita el nombre comercial y el prefijo; al guardar ve un toast de éxito y los cambios persisten.
4. El campo `invoice_prefix` convierte a mayúsculas al escribir.
5. Si el `CLIENT` ingresa un prefijo inválido, el formulario muestra error bajo el campo.
6. Si el `CLIENT` deja el nombre comercial vacío, el formulario muestra error.
7. El `CLIENT` sube un logo PNG/JPEG/WebP válido y la preview se actualiza.
8. Si el `CLIENT` sube un archivo que no es imagen, ve toast de error "El logo debe ser una imagen PNG, JPEG o WebP.".
9. Si el `CLIENT` sube una imagen mayor a 2 MB, ve toast de error "El logo no puede superar 2 MB.".
10. El `CLIENT` elimina el logo y la preview queda vacía.
11. Un usuario no autenticado que intenta acceder a `/settings` es redirigido a `/login`.
12. Un `CLIENT` inactivo es redirigido a `/account-disabled`.
13. La consulta pública `getCurrentWorkshopSettings` retorna la configuración del taller actual.
14. La página `/admin/workshops/[id]` sigue mostrando el formulario completo, incluyendo el siguiente número de factura editable.
15. El `ADMIN` puede seguir editando el siguiente número con la validación de que no disminuye.
16. No se duplica el componente de formulario entre `CLIENT` y `ADMIN`; ambos usan `modules/workshops/components/WorkshopSettingsForm`.
17. `docs/modules.md` refleja el estado `IMPLEMENTADO` para el módulo 4.4.
18. Las notificaciones aparecen siempre en `top-right`.
19. `pnpm lint` pasa sin errores.
20. `pnpm build` compila sin errores.

---

## 15. Estrategia de pruebas

### 15.1 Verificación manual con `pnpm dev`

- Login como `CLIENT` y acceso a `/settings`.
- Verificar que el formulario carga con los datos actuales.
- Confirmar que el campo "siguiente número de factura" no está visible.
- Editar nombre comercial y prefijo; verificar toast y persistencia.
- Intentar guardar con nombre vacío y prefijo inválido; verificar errores.
- Subir logo válido y verificar preview.
- Subir archivo no imagen y verificar error.
- Subir imagen > 2 MB y verificar error.
- Eliminar logo y verificar preview vacía.
- Acceder a `/settings` sin configuración (forzar estado) y verificar `NotFoundNotice`.
- Login como `ADMIN` y acceder a `/admin/workshops/[id]`.
- Verificar que el formulario sigue mostrando el siguiente número editable.
- Intentar disminuir `next_invoice_number` y verificar error.
- Verificar que el formulario compartido se importa desde `modules/workshops/components/`.

### 15.2 Verificación de compilación

- `pnpm lint` sin errores.
- `pnpm build` sin errores de tipos ni rutas.

### 15.3 Verificación de RLS

- Un `CLIENT` puede leer y actualizar su propia fila de `workshop_settings`.
- Un `CLIENT` no puede leer ni actualizar `workshop_settings` de otro taller.
- Un `CLIENT` puede subir/eliminar su propio logo en `workshop-logos`.
- Un `CLIENT` no puede acceder al logo de otro taller.

### 15.4 Verificación de Storage

- Subir logo a `workshop-logos/{workshop_id}/logo.png` funciona.
- Reemplazar logo elimina el archivo anterior.
- Eliminar logo borra el archivo y limpia `logo_path`.
- URL firmada del logo es accesible por el owner.

---

## 16. Estructura final de archivos

```text
confectu/
├── app/
│   └── (private)/
│       └── settings/
│           └── page.tsx                                (modifica)
│   └── (admin)/
│       └── admin/
│           └── workshops/
│               └── [id]/
│                   └── page.tsx                        (modifica)
│
├── modules/
│   ├── workshops/                                      (nuevo)
│   │   ├── components/
│   │   │   ├── WorkshopSettingsForm.tsx                (nuevo / movido desde admin)
│   │   │   └── NotFoundNotice.tsx                      (nuevo)
│   │   ├── actions.ts                                  (nuevo)
│   │   ├── queries.ts                                  (nuevo)
│   │   ├── types.ts                                    (nuevo)
│   │   └── validations.ts                              (nuevo)
│   │
│   └── admin/
│       └── workshops/
│           ├── components/
│           │   └── WorkshopSettingsForm.tsx            (elimina / mueve a modules/workshops/)
│           ├── actions.ts                              (existente, sin cambios funcionales)
│           ├── queries.ts                              (existente; opcionalmente importa getWorkshopLogoUrl desde modules/workshops/)
│           ├── types.ts                                (existente)
│           └── validations.ts                          (existente)
│
├── docs/
│   └── modules.md                                      (modifica)
│
└── specs/
    └── modulo_4.4.md                                   (este archivo)
```

### Notas sobre la estructura

- `modules/workshops/` es el módulo natural para la configuración del taller. Contiene la lógica de `CLIENT`, el formulario compartido y las consultas públicas.
- `modules/admin/workshops/` conserva sus Server Actions, consultas y validaciones específicas de `ADMIN`. Su página de edición importa el formulario compartido desde `modules/workshops/components/`.
- El componente `WorkshopSettingsForm` se parametriza con `showNextInvoiceNumber` para adaptarse a ambos roles sin duplicar código.
- No se crean migraciones porque las tablas, restricciones, RLS y Storage ya están listos.

---

## 17. Dependencias

### Nuevas

Ninguna.

### Existentes

- `@supabase/ssr` — manejo de sesión SSR con cookies.
- `@supabase/supabase-js` — cliente Supabase.
- `next` — App Router, Server Actions.
- `react` — `useFormStatus`, `useRouter`.
- `nextjs-toast-notify` — notificaciones toast. Ya instalada. Se usa `position: "top-right"`.

No se añaden librerías de formularios, validación ni UI. Se usan formularios nativos, validación HTML5 y validación manual con TypeScript.

---

## 18. Observaciones

- El campo `next_invoice_number` se oculta para `CLIENT` porque el sistema lo autoincrementa al emitir facturas. `ADMIN` sigue pudiendo ajustarlo en `/admin/workshops/[id]`.
- El reto de concurrencia al emitir facturas (reserva atómica del consecutivo) se aborda en el módulo 4.5, no aquí.
- El logo se gestiona en el mismo bucket privado `workshop-logos` que usa el módulo 4.7.3. Las políticas de Storage ya permiten al owner del taller leer y escribir.
- Se recomienda mover el componente `WorkshopSettingsForm` existente en `modules/admin/workshops/components/` a `modules/workshops/components/` para respetar la regla de que los módulos no dependen de archivos internos de otros módulos.
- La consulta pública `getCurrentWorkshopSettings` está diseñada para ser consumida por `modules/invoices/` y `modules/dashboard/` en sus specs correspondientes.
- Las notificaciones con `nextjs-toast-notify` se usan en todos los componentes cliente que ejecutan acciones, siempre con `position: "top-right"`, conforme a `AGENTS.md`.
