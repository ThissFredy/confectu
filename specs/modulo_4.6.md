# Spec: Resumen operativo del taller (módulo 4.6)

**Módulo:** `modules/dashboard/`
**Número de spec:** 4.6
**Estado:** IMPLEMENTADO
**Fecha:** 2026-08-27

---

## 1. Objetivo y alcance

Implementar el módulo `modules/dashboard/` como el resumen operativo del taller
para el rol `CLIENT`. El dashboard muestra indicadores agregados sobre las
facturas del taller reutilizando consultas públicas del módulo de facturas
(`modules/invoices/`) y del módulo de clientes (`modules/clients/`), sin acceder
directamente a tablas internas de otros módulos.

### Dentro del alcance

- Indicadores con dos categorías temporales ("Este mes" y "General"):
  - Facturas emitidas.
  - Total facturado (solo facturas `issued`).
  - Facturas invalidadas.
  - Prendas confeccionadas.
  - Servicios confeccionados.
- Indicadores de valor actual, sin categorías temporales:
  - Facturas en borrador.
  - Cantidad de clientes activos.
- Filtro opcional por rango de fechas personalizado que reemplaza las dos
  categorías.
- Lista de las facturas más recientes con enlace al detalle.
- Estados de carga, vacío y error, mobile-first.

### Fuera del alcance

- Mutaciones de cualquier tipo. El dashboard es de solo lectura.
- Server Actions y formularios con `FormData`.
- Tablas propias o migraciones de base de datos.
- Gráficos complejos o librerías de visualización.
- Auto-refresh o polling: los datos se cargan al renderizar la página.
- Acceso del rol `ADMIN` al dashboard operativo del taller (usa su propio
  dashboard en `/admin`).

---

## 2. Actores y permisos

| Actor | Descripción | Acceso |
|---|---|---|
| `CLIENT` | Propietario de un taller. | Único rol con acceso a `/dashboard`. Ve únicamente los indicadores de su propio taller. |
| `ADMIN` | Administrador global de Confectu. | Redirigido a `/admin`. No accede a `/dashboard`. |
| Usuario no autenticado | Sin sesión activa. | Redirigido a `/login`. |
| Usuario inactivo | Cuenta desactivada. | Redirigido a `/account-disabled`. |

### Reglas de permisos

- El taller se resuelve en el servidor a partir del usuario autenticado
  (`workshops.owner_id`). Nunca se acepta un `workshop_id` desde la petición.
- Todas las consultas se ejecutan con el cliente Supabase autenticado del
  usuario, respetando las políticas RLS existentes.
- La redirección de `ADMIN` a `/admin` y de no autenticados/inactivos ya está
  implementada en `proxy.ts` y no se modifica.

---

## 3. Definición de indicadores

### 3.1 Indicadores con dos categorías temporales

Estos indicadores muestran dos valores simultáneamente: **"Este mes"** y
**"General"**.

- **"Este mes"** reinicia cada día 1 del mes: comprende desde las `00:00:00`
  del primer día del mes actual hasta el momento actual.
- **"General"** es el resumen de todo el historial, sin importar la fecha.

| Indicador | Definición | Fecha usada para "Este mes" |
|---|---|---|
| Facturas emitidas | Conteo de facturas con `status = 'issued'`. | `issued_at` |
| Total facturado | Suma de `total_cop` de facturas con `status = 'issued'`. | `issued_at` |
| Facturas invalidadas | Conteo de facturas con `status = 'void'`. | `voided_at` |
| Prendas confeccionadas | Suma de `quantity` de todas las líneas (`invoice_lines`) de facturas con `status = 'issued'`. | `issued_at` de la factura padre |
| Servicios confeccionados | Conteo total de líneas distintas (`invoice_lines`) de facturas con `status = 'issued'`. | `issued_at` de la factura padre |

### 3.2 Indicadores de valor actual (sin categorías)

| Indicador | Definición |
|---|---|
| Facturas en borrador | Conteo de facturas con `status = 'draft'`. Valor actual único, sin categorías temporales y no afectado por el filtro de fechas. |
| Clientes activos | Conteo de `customers` con `is_active = true` del taller. Valor en tiempo real, sin categorías temporales y no afectado por el filtro de fechas. |

### 3.3 Facturas recientes

Lista de las **5 facturas más recientes** sin importar estado, ordenadas por
`created_at` descendente. Cada item muestra:

- Número (o "Borrador" si `number` es null).
- Nombre del cliente.
- Badge de estado (reutiliza `InvoiceStatusBadge`).
- Total en COP.
- Fecha de creación.
- Enlace a `/invoices/[id]`.

---

## 4. Filtro por rango de fechas

- El usuario puede activar un filtro opcional con una fecha de inicio y una
  fecha de fin.
- Cuando hay un filtro activo, las dos categorías ("Este mes" / "General")
  desaparecen y los **cinco indicadores temporales** (sección 3.1) muestran un
  único valor calculado para ese rango.
- Cada indicador temporal usa su fecha relevante dentro del rango:
  - `issued_at` para facturas emitidas, total facturado, prendas confeccionadas
    y servicios confeccionados.
  - `voided_at` para facturas invalidadas.
- Los indicadores "facturas en borrador" y "clientes activos" **no** se ven
  afectados por el filtro.
- El botón "Limpiar filtro" elimina el rango y restaura las dos categorías.

---

## 5. Reglas de negocio

1. **Mes presente reinicia cada 1 del mes:** la categoría "Este mes" se calcula
   desde las `00:00:00` del primer día del mes actual hasta el momento actual
   (no hasta el fin del mes, para no mostrar valores futuros).
2. **General es todo el historial:** no aplica ningún filtro de fecha.
3. **Solo facturas emitidas cuentan como facturado:** `draft` y `void` no se
   incluyen en el total facturado.
4. **Prendas vs. servicios:** "prendas confeccionadas" es la suma de las
   cantidades (`quantity`) de todas las líneas; "servicios confeccionados" es el
   número de líneas distintas. Ambos consideran solo facturas `issued`.
5. **Valores actuales sin fecha:** borradores y clientes activos son conteos del
   estado actual, no históricos.
6. **Filtro reemplaza categorías:** un rango de fechas activo sustituye las dos
   categorías por un único valor por indicador temporal.
7. **Rango válido:** la fecha de inicio no puede ser posterior a la fecha de
   fin. Si lo es, el filtro no se aplica y se mantiene el estado anterior.
8. **Sin facturas no es error:** si no hay facturas en el periodo, los
   indicadores muestran `0`. Solo se muestra el estado vacío completo cuando el
   taller no tiene facturas en absoluto.
9. **Moneda única COP:** todos los valores monetarios se formatean con
   `Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0, maximumFractionDigits: 2 })`.
10. **Sin gráficos complejos:** solo tarjetas con dos columnas y listas simples,
    sin librerías de visualización.
11. **Sin auto-refresh:** los datos se cargan al renderizar el Server Component.
    El usuario recarga la página manualmente para actualizar.
12. **Sin notificaciones toast:** el dashboard no ejecuta acciones que requieran
    `nextjs-toast-notify`.
13. **Cálculo server-side:** todas las agregaciones se calculan en el servidor
    mediante consultas a Supabase; no se calculan totales en el navegador.

---

## 6. Estados y transiciones

El dashboard no gestiona estados de entidades de negocio. Solo maneja los
estados de la vista:

```text
[loading] ──▶ [con datos] ──▶ [filtro activo] ──▶ [limpiar filtro] ──▶ [con datos]
   │              │
   │              ├──▶ [vacío] (sin facturas)
   └──▶ [error] ──▶ [reintentar] ──▶ [loading]
```

---

## 7. Modelo de datos afectado

No se crean tablas ni migraciones. El dashboard lee únicamente las tablas
existentes a través de funciones públicas:

- `invoices`: estado, `issued_at`, `voided_at`, `created_at`, `total_cop`, `number`, `customer_id`.
- `invoice_lines`: `invoice_id`, `quantity` (para prendas y servicios).
- `customers`: `is_active` (para clientes activos).

---

## 8. Relaciones entre entidades y consultas públicas

```text
invoices 1───∞ invoice_lines
invoices 1───∞ customers (vía customer_id)
```

### 8.1 Consultas públicas nuevas en `modules/invoices/queries.ts`

Se extiende el módulo de facturas con funciones públicas que el dashboard
consumirá. No se accede a tablas internas de otros módulos desde el dashboard.

```text
getInvoiceStatsForPeriod(supabase, startDate, endDate):
  Promise<InvoicePeriodStats>
  - startDate: Date (inclusive) o null si es "General".
  - endDate: Date (inclusive) o null si es "General".
  - Devuelve: issuedCount, totalInvoicedCop, voidedCount, garmentsTotal,
    servicesTotal.

getDraftInvoiceCount(supabase): Promise<number>
  - Conteo de facturas draft del taller del usuario.

getRecentInvoices(supabase, limit = 5): Promise<InvoiceListItem[]>
  - Las N facturas más recientes (created_at desc) con nombre del cliente.
```

### 8.2 Consulta pública nueva en `modules/clients/queries.ts`

```text
getActiveCustomerCount(supabase): Promise<number>
  - Conteo de customers con is_active = true del taller del usuario.
```

### 8.3 Orquestación en `modules/dashboard/queries.ts`

```text
getDashboardStats(supabase, filters?: { from?: string; to?: string }):
  Promise<DashboardStats>
  - Sin filtro: llama a getInvoiceStatsForPeriod dos veces (mes actual y
    general), getDraftInvoiceCount, getActiveCustomerCount y getRecentInvoices.
  - Con filtro: llama a getInvoiceStatsForPeriod una vez con el rango,
    getDraftInvoiceCount, getActiveCustomerCount y getRecentInvoices.
```

---

## 9. Reglas de aislamiento multi-tenant y RLS

- Todas las consultas usan el cliente Supabase autenticado del usuario
  (`createClient()` de `lib/supabase/server`).
- Las políticas RLS existentes garantizan que cada `CLIENT` solo lee datos de su
  propio taller (`workshop_id = current_workshop_id()`).
- El taller se resuelve en el servidor a partir de `auth.uid()`; el dashboard no
  recibe ni valida `workshop_id` desde la petición.
- No se usa la service role key.
- No se requiere ninguna migración de RLS: las políticas actuales de `invoices`,
  `invoice_lines` y `customers` ya permiten la lectura al owner.

---

## 10. Validaciones funcionales

| Regla | Descripción |
|---|---|
| Rango válido | La fecha de inicio no puede ser posterior a la fecha de fin. |
| Fechas opcionales | Si falta `from` o `to`, se interpreta como "sin límite" en ese extremo. |
| Datos vacíos | Si no hay facturas en el rango, los indicadores muestran `0`. |
| Sesión activa | La ruta ya está protegida por `proxy.ts`; no se repite validación en el dashboard. |

---

## 11. Errores y estados de la interfaz

### 11.1 Página `/dashboard`

| Estado | Comportamiento |
|---|---|
| Loading | `loading.tsx` con esqueleto de tarjetas (`DashboardSkeleton`). |
| Con datos (sin filtro) | Tarjetas de indicadores temporales con 2 columnas ("Este mes" / "General"), tarjetas de valor actual, y lista de facturas recientes. |
| Con datos (con filtro) | Tarjetas de indicadores temporales con 1 columna (valor del rango), tarjetas de valor actual sin cambios, y lista de facturas recientes. |
| Vacío | `EmptyDashboard` con mensaje motivador y botón "Crear factura" hacia `/invoices/new`. |
| Error de carga | Mensaje "No se pudieron cargar las estadísticas." con botón de reintentar (reutiliza `RetryButton`). |

### 11.2 Filtro de fechas

| Estado | Comportamiento |
|---|---|
| Fecha inicio > fecha fin | No se aplica el filtro; se mantiene el estado anterior. |
| Limpiar filtro | Restaura las dos categorías. |

---

## 12. Rutas y pantallas afectadas

| Ruta | Archivo | Descripción |
|---|---|---|
| `/dashboard` | `app/(private)/dashboard/page.tsx` (modifica) | Server Component que lee `?from` y `?to` de `searchParams`, orquesta consultas y renderiza el dashboard. |
| `/dashboard` (loading) | `app/(private)/dashboard/loading.tsx` (nuevo) | Esqueleto de carga. |
| `docs/modules.md` | `docs/modules.md` (modifica) | Actualizar estado del módulo 4.6 a `IMPLEMENTADO`. |

### Notas sobre organización de rutas

- `/dashboard` ya está protegida como ruta privada en `proxy.ts`.
- El `PrivateHeader` ya enlaza a `/dashboard`.
- La página es un Server Component; no se crean Server Actions.

---

## 13. Server Actions necesarias

Ninguna. El dashboard es de solo lectura y no realiza mutaciones.

---

## 14. Estructuras de `FormData` y tipos de datos esperados

No hay `FormData` (no hay mutaciones). El filtro de fechas se comunica mediante
parámetros de búsqueda en la URL (`?from=YYYY-MM-DD&to=YYYY-MM-DD`).

### 14.1 Tipos nuevos en `modules/invoices/types.ts`

```text
InvoicePeriodStats
  issuedCount: number
  totalInvoicedCop: number
  voidedCount: number
  garmentsTotal: number
  servicesTotal: number
```

### 14.2 Tipos nuevos en `modules/dashboard/types.ts`

```text
DashboardFilters
  from?: string   // ISO date YYYY-MM-DD
  to?: string     // ISO date YYYY-MM-DD

PeriodStats (alias de InvoicePeriodStats re-exportado o redefinido)
  issuedCount: number
  totalInvoicedCop: number
  voidedCount: number
  garmentsTotal: number
  servicesTotal: number

DashboardStats
  thisMonth: PeriodStats | null      // null cuando hay filtro activo
  allTime: PeriodStats | null        // null cuando hay filtro activo
  filtered: PeriodStats | null       // valor cuando hay filtro activo
  draftCount: number
  activeCustomerCount: number
  recentInvoices: InvoiceListItem[]
```

### 14.3 Funciones de query en `modules/dashboard/queries.ts`

```text
getDashboardStats(supabase, filters?: DashboardFilters): Promise<DashboardStats>
  - Sin filtro: thisMonth y allTime poblados, filtered = null.
  - Con filtro: filtered poblado, thisMonth = null, allTime = null.
```

---

## 15. Componentes de UI necesarios y responsabilidades

### 15.1 `DashboardView`

- **Ubicación**: `modules/dashboard/components/DashboardView.tsx`
- **Tipo**: server component.
- **Responsabilidad**: recibe `DashboardStats` y `filters`, y renderiza la
  estructura completa: tarjetas de indicadores, filtro y facturas recientes.
- **Props**:
  - `stats: DashboardStats`.
  - `filters: DashboardFilters`.
- **Características**:
  - Decide qué valores mostrar en cada `StatCard` según haya filtro activo o no.
  - Renderiza `DashboardFilters`, las `StatCard` y `RecentInvoicesList`.
  - Mobile-first.

### 15.2 `DashboardFilters`

- **Ubicación**: `modules/dashboard/components/DashboardFilters.tsx`
- **Tipo**: client component.
- **Responsabilidad**: selector de rango de fechas con dos inputs `date` y
  botones "Filtrar" y "Limpiar".
- **Props**:
  - `initialFrom?: string`.
  - `initialTo?: string`.
- **Características**:
  - Dos `<input type="date">` (inicio y fin).
  - Botón "Filtrar": navega con `router.push` a `/dashboard?from=...&to=...`.
  - Botón "Limpiar": navega a `/dashboard` sin parámetros.
  - Si inicio > fin, no navega (validación en cliente).
  - Mobile-first: campos a ancho completo, touch targets >= 44x44 px.

### 15.3 `StatCard`

- **Ubicación**: `modules/dashboard/components/StatCard.tsx`
- **Tipo**: server component (presentacional).
- **Responsabilidad**: tarjeta de indicador.
- **Props**:
  - `label: string`.
  - `format: "number" | "currency"`.
  - `thisMonthValue?: number`.
  - `generalValue?: number`.
  - `singleValue?: number`.
- **Características**:
  - Si `thisMonthValue` y `generalValue` están presentes: muestra dos columnas
    ("Este mes" a la izquierda, "General" a la derecha).
  - Si solo `singleValue` está presente: muestra un único valor centrado.
  - Formatea según `format` (`Intl.NumberFormat` para currency).
  - Mobile-first.

### 15.4 `RecentInvoicesList`

- **Ubicación**: `modules/dashboard/components/RecentInvoicesList.tsx`
- **Tipo**: server component (presentacional).
- **Responsabilidad**: lista de las facturas más recientes.
- **Props**:
  - `invoices: InvoiceListItem[]`.
- **Características**:
  - Reutiliza `InvoiceStatusBadge` de `modules/invoices/components/`.
  - Cada item muestra número (o "Borrador"), nombre del cliente, badge, total COP
    y fecha.
  - Enlace a `/invoices/[id]`.
  - Mobile-first: lista vertical, touch targets >= 44x44 px.

### 15.5 `DashboardSkeleton`

- **Ubicación**: `modules/dashboard/components/DashboardSkeleton.tsx`
- **Tipo**: server component (presentacional).
- **Responsabilidad**: esqueleto de carga de las tarjetas.
- **Características**:
  - Bloques `animate-pulse` que imitan la estructura de las tarjetas.

### 15.6 `EmptyDashboard`

- **Ubicación**: `modules/dashboard/components/EmptyDashboard.tsx`
- **Tipo**: server component (presentacional).
- **Responsabilidad**: estado vacío cuando el taller no tiene facturas.
- **Características**:
  - Mensaje motivador (ej. "Aún no tienes facturas").
  - Botón "Crear factura" enlazando a `/invoices/new`.
  - Mobile-first, centrado.

---

## 16. Criterios de aceptación verificables

1. Un `CLIENT` autenticado accede a `/dashboard` y ve las tarjetas de
   indicadores.
2. Los indicadores temporales muestran dos columnas: "Este mes" y "General".
3. Los valores de "Este mes" reinician cada día 1 del mes.
4. "Facturas en borrador" y "Clientes activos" se muestran como valor único, sin
   columnas.
5. "Prendas confeccionadas" muestra la suma de cantidades de líneas de facturas
   emitidas; "Servicios confeccionados" muestra el número de líneas distintas.
6. El usuario puede seleccionar un rango de fechas y las tarjetas temporales
   cambian a una sola columna con los datos del rango.
7. "Facturas en borrador" y "Clientes activos" no cambian al aplicar el filtro.
8. Al limpiar el filtro, vuelven las dos columnas.
9. Si la fecha de inicio es posterior a la de fin, el filtro no se aplica.
10. Las facturas recientes se muestran con enlace al detalle (`/invoices/[id]`).
11. Si no hay facturas, se muestra el estado vacío con botón "Crear factura".
12. Si no hay facturas en un periodo, los indicadores muestran `0` (no error).
13. `ADMIN` no accede a `/dashboard` (redirigido a `/admin`).
14. Un `CLIENT` no ve datos de otro taller.
15. Estados de carga, vacío y error funcionan correctamente.
16. Touch targets >= 44x44 px.
17. `pnpm lint` pasa sin errores.
18. `pnpm build` compila sin errores.

---

## 17. Estrategia de pruebas

### 17.1 Verificación manual con `pnpm dev`

- Login como `CLIENT` y acceso a `/dashboard`.
- Verificar que las tarjetas muestran "Este mes" y "General" en dos columnas.
- Verificar que "Facturas en borrador" y "Clientes activos" muestran un solo
  valor.
- Verificar que "Prendas confeccionadas" suma cantidades y "Servicios
  confeccionados" cuenta líneas de facturas emitidas.
- Crear/emitir facturas y verificar que los valores se actualizan al recargar.
- Activar un filtro de fechas y verificar que las tarjetas temporales pasan a
  una sola columna.
- Verificar que borradores y clientes activos no cambian con el filtro.
- Limpiar el filtro y verificar que vuelven las dos columnas.
- Probar un rango inválido (inicio > fin) y verificar que no se aplica.
- Verificar estado vacío con un taller sin facturas.
- Verificar estado de error (p. ej. deshabilitando la red) y el botón reintentar.

### 17.2 Verificación de aislamiento

- Como `CLIENT` A, verificar que el dashboard solo muestra datos de su taller.
- Crear datos en el `CLIENT` B y verificar que no aparecen en el dashboard de A.

### 17.3 Verificación de roles

- Como `ADMIN`, intentar acceder a `/dashboard` y verificar la redirección a
  `/admin`.

### 17.4 Verificación de compilación

- `pnpm lint` sin errores.
- `pnpm build` sin errores de tipos ni rutas.

---

## 18. Estructura final de archivos

```text
confectu/
├── app/
│   └── (private)/
│       └── dashboard/
│           ├── page.tsx            (modifica)
│           └── loading.tsx         (nuevo)
│
├── modules/
│   ├── dashboard/                  (nuevo)
│   │   ├── components/
│   │   │   ├── DashboardView.tsx
│   │   │   ├── DashboardFilters.tsx
│   │   │   ├── StatCard.tsx
│   │   │   ├── RecentInvoicesList.tsx
│   │   │   ├── DashboardSkeleton.tsx
│   │   │   └── EmptyDashboard.tsx
│   │   ├── queries.ts
│   │   └── types.ts
│   ├── invoices/
│   │   ├── queries.ts              (modifica: nuevas consultas públicas)
│   │   └── types.ts                (modifica: InvoicePeriodStats)
│   └── clients/
│       └── queries.ts              (modifica: getActiveCustomerCount)
│
├── docs/
│   └── modules.md                  (modifica)
│
└── specs/
    └── modulo_4.6.md               (este archivo)
```

### Notas sobre la estructura

- `modules/dashboard/` contiene los componentes, la orquestación de consultas
  (`queries.ts`) y los tipos propios (`types.ts`). No contiene `actions.ts` ni
  `validations.ts` porque no hay mutaciones ni entrada de formulario.
- Las consultas agregadas que requieren leer `invoices` y `invoice_lines` viven
  en `modules/invoices/queries.ts` como funciones públicas; el dashboard no
  accede directamente a las tablas.
- El conteo de clientes activos vive en `modules/clients/queries.ts` como
  función pública.
- Las rutas en `app/` actúan solo como entradas de pantalla y delegan la lógica
  al módulo.

---

## 19. Dependencias

### Existentes

- `@supabase/ssr` — manejo de sesión SSR con cookies.
- `@supabase/supabase-js` — cliente Supabase.
- `next` — App Router, Server Components, `searchParams`.
- `react` — componentes de presentación.
- `modules/invoices/queries.ts` — consultas públicas de facturas.
- `modules/clients/queries.ts` — consultas públicas de clientes.
- `modules/invoices/components/InvoiceStatusBadge` — badge de estado reutilizado.

### Nuevas

Ninguna. No se añaden librerías de gráficos, formularios ni UI.

---

## 20. Observaciones

- El dashboard es una vista de solo lectura: no introduce Server Actions,
  `FormData`, validaciones de formulario ni notificaciones toast.
- La definición "prendas confeccionadas = suma de cantidades" vs. "servicios
  confeccionados = número de líneas" fue confirmada explícitamente por el
  usuario durante el refinamiento del spec.
- "Clientes activos" es un valor en tiempo real sin categorías temporales,
  confirmado por el usuario.
- El filtro de fechas reemplaza las dos categorías (no se muestran
  simultáneamente), confirmado por el usuario.
- La presentación de dos columnas ("Este mes" / "General") por tarjeta fue
  confirmada por el usuario.
- El módulo 4.6 reutiliza y extiende las consultas públicas de
  `modules/invoices/` y `modules/clients/`, sin acceder a tablas internas de
  otros módulos, conforme a `docs/modules.md`.
