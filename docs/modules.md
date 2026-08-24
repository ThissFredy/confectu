# Confectu: plan técnico por módulos

## 1. Objetivo

Confectu es una aplicación web mobile-first para talleres de confección. Cada
cuenta de tipo `CLIENT` representa un taller y solo puede acceder a sus propios
clientes, servicios y facturas. La aplicación genera comprobantes internos en
PDF; no implementa facturación electrónica ni integración con la DIAN en el
MVP.

Este documento divide el desarrollo en módulos independientes. Cada módulo debe
mantener sus componentes, Server Actions, consultas, tipos, validaciones y
lógica específica dentro de `modules/<module>/`.

## 2. Decisiones de alcance

- Moneda única: COP.
- Autenticación: Google OAuth mediante Supabase Auth.
- Roles del sistema: `ADMIN` y `CLIENT`.
- `ADMIN` es el administrador global de Confectu.
- `CLIENT` es el usuario propietario de un taller.
- `CUSTOMER` no es un rol del sistema; es la persona atendida por un taller.
- Un taller tiene inicialmente un único usuario `CLIENT`.
- El nombre del cliente es el único campo obligatorio del CRUD de clientes.
- Tipo de documento y número de documento son opcionales.
- Los tipos de documento pertenecen a un catálogo global administrado por
  `ADMIN`.
- `modules/admin/` agrupa la administración global de `ADMIN`: catálogo de
  tipos de documento y gestión de talleres, clientes, configuración y
  servicios de cualquier taller.
- El catálogo de servicios permite servicios reutilizables y líneas
  personalizadas en una factura.
- Las facturas se guardan como datos relacionales. El PDF se genera para su
  descarga y no se persiste como requisito del MVP.
- Las facturas usan estados `draft`, `issued` y `void`.
- Una factura `draft` puede editarse. Una factura `issued` no se modifica: se
  anula mediante `void` para conservar el historial.
- La numeración es automática por taller y admite un prefijo configurable.

## 3. Orden de implementación

### Fase 0: base técnica

Preparar Supabase, clientes server/browser, variables de entorno, middleware de
sesión, migraciones y tipos generados. Esta fase no debe contener lógica de
negocio de facturación.

### Fase 1: autenticación y cuentas

Implementar el acceso con Google, la creación o actualización del perfil del
taller, protección de rutas y el aislamiento por usuario mediante RLS. Incluir
el estado de activación de la cuenta para que `ADMIN` pueda activar o
desactivar talleres.

### Fase 2: clientes

Implementar el CRUD de clientes del taller, incluyendo búsqueda, estados vacío,
carga, error y confirmación de eliminación o desactivación. El módulo debe
exponer una consulta pública para buscar un cliente desde el flujo de factura.

### Fase 3: catálogo de servicios

Implementar el CRUD de servicios o prendas reutilizables. Una factura podrá
seleccionar un servicio del catálogo o agregar una descripción personalizada,
con cantidad y precio COP editable.

### Fase 4: configuración del taller

Implementar nombre comercial, datos de contacto, datos fiscales básicos,
prefijo de factura, texto de condiciones o instrucciones de pago y logo
opcional en Supabase Storage. Debe existir un único perfil de configuración por
taller.

### Fase 5: facturas

Implementar creación de borradores, selección o creación previa de cliente,
 líneas de factura, ajustes, cálculo server-side, emisión, anulación, historial,
detalle y generación/descarga del PDF.

### Fase 6: dashboard y reportes

Implementar indicadores y consultas agregadas sobre facturas del taller. Este
módulo debe reutilizar consultas públicas de facturas, sin acceder a tablas
internas de otro módulo.

### Fase 7: administración global

Implementar `modules/admin/` con el CRUD de tipos de documento y la gestión de
talleres, clientes, configuración y servicios de cualquier taller. El CRUD de
tipos de documento puede iniciarse antes que el resto de submódulos porque es
requisito del módulo de clientes; los submódulos de talleres, clientes y
servicios dependen de que existan las entidades de negocio correspondientes.

## 4. Módulos

### 4.1 `modules/auth/`

- **Título:** Autenticación, autorización y contexto de cuenta.
- **Descripción:** Gestiona el acceso de usuarios mediante Google OAuth, la
creación del perfil de taller asociado a `auth.users.id`, la resolución del rol
(`ADMIN` o `CLIENT`), el estado de la cuenta y la protección de rutas privadas.
- **Lo que se espera que pueda hacer el usuario:**
  - Iniciar y cerrar sesión con Google OAuth.
  - Acceder a la aplicación solo si su cuenta está activa.
  - Como `ADMIN`, listar cuentas `CLIENT` y activarlas o desactivarlas.
- **Estado actual:** IMPLEMENTADO.
- **Observaciones:** Login con Google OAuth, callback `/api/auth/callback`,
proxy de protección de rutas, onboarding de taller, layouts privado y
admin, y Server Actions de logout y configuración inicial están implementados.
La columna `profiles.workshop_setup_completed` y la función atómica
`complete_workshop_setup` garantizan un solo taller por usuario.

Estructura esperada:

```text
modules/auth/
├── components/
├── actions.ts
├── queries.ts
├── types.ts
└── validations.ts
```

Entidades sugeridas:

- `profiles`: `id`, `role`, `is_active`, `created_at`, `updated_at`.
- `workshops`: `id`, `owner_id`, `is_active`, `created_at`, `updated_at`.

Regla: el rol no se acepta desde un formulario del cliente. Debe resolverse y
validarse en el servidor.

### 4.2 `modules/clients/`

- **Título:** Clientes atendidos por un taller.
- **Descripción:** Administra las personas atendidas por un taller. No confundir
`CLIENT`, que es el rol del propietario del taller, con `CUSTOMER`, que es un
registro de negocio. Cada cliente pertenece a un único `workshop_id`.
- **Lo que se espera que pueda hacer el usuario:**
  - Listar, buscar, crear, editar y desactivar clientes.
  - Asociar opcionalmente un tipo de documento del catálogo global.
  - Seleccionar un cliente existente o crear uno nuevo durante el flujo de
    factura.
- **Estado actual:** IMPLEMENTADO.
- **Observaciones:** CRUD completo para `CLIENT` en `/customers`, con búsqueda,
  filtro de inactivos, doble confirmación en desactivar/reactivar y validación
  de unicidad de documento por taller. La consulta pública
  `searchCustomersForInvoice` está disponible para el flujo de factura.

Entidades sugeridas:

- `customers`: `id`, `workshop_id`, `name`, `document_type_id`,
  `document_number`, `phone`, `email`, `address`, `notes`, `is_active`,
  `created_at`, `updated_at`.
- `document_types`: `id`, `code`, `name`, `is_active`, `created_at`,
  `updated_at`.

`document_types` es un catálogo global. Solo `ADMIN` puede ejecutar su CRUD;
los talleres únicamente pueden consultarlo. El número de documento no debe
forzarse como único global porque la misma persona puede pertenecer a talleres
distintos.

### 4.3 `modules/services/`

- **Título:** Catálogo de servicios, prendas y precios base.
- **Descripción:** Permite crear y mantener servicios reutilizables para un
taller. Una factura podrá seleccionar un servicio del catálogo o agregar una
línea personalizada que no cree un registro en el catálogo.
- **Lo que se espera que pueda hacer el usuario:**
  - Crear, editar, activar/desactivar y eliminar servicios del catálogo.
  - Definir nombre, descripción, categoría opcional y precio base en COP.
  - Seleccionar servicios del catálogo al armar una factura.
- **Estado actual:** NO IMPLEMENTADO.
- **Observaciones:** La tabla `services`, índices y RLS están listos en la
migración inicial. Falta todo el código de aplicación (componentes, Server
Actions, consultas y rutas).

Entidad sugerida:

- `services`: `id`, `workshop_id`, `name`, `description`, `category`,
  `default_price_cop`, `is_active`, `created_at`, `updated_at`.

Una línea de factura debe guardar una copia de la descripción y del precio
seleccionado. Nunca debe depender de que el servicio siga existiendo o conserve
el mismo precio.

### 4.4 `modules/workshops/`

- **Título:** Configuración e identidad del taller.
- **Descripción:** Administra la información del taller que se muestra en los
comprobantes: nombre comercial, datos de contacto, identificación fiscal,
prefijo y consecutivo de facturas, instrucciones de pago y logo opcional.
- **Lo que se espera que pueda hacer el usuario:**
  - Configurar los datos comerciales del taller.
  - Definir el prefijo y el siguiente número de factura.
  - Establecer texto de condiciones o instrucciones de pago.
  - Subir y reemplazar un logo opcional en Supabase Storage.
- **Estado actual:** NO IMPLEMENTADO.
- **Observaciones:** La tabla `workshop_settings` y sus restricciones están
listas. Falta la interfaz de configuración, la gestión del logo en Storage y
las validaciones de acceso en Server Actions.

Entidades sugeridas:

- `workshop_settings`: `workshop_id`, `business_name`, `tax_id`, `phone`,
  `email`, `address`, `invoice_prefix`, `next_invoice_number`,
  `payment_instructions`, `logo_path`, `created_at`, `updated_at`.

El consecutivo debe reservarse en una operación server-side segura para evitar
duplicados si se emiten dos facturas simultáneamente.

**Feature futuro (no incluido en el spec de autenticación):** Subida de imagen
del taller durante el onboarding. El formulario de onboarding del módulo
`modules/auth/` actualmente captura solo `business_name` e `invoice_prefix`.
Como evolución, se añadirá un campo opcional para subir una imagen del taller
(logo o foto) que se almacenará en Supabase Storage y se referenciará en
`workshop_settings.logo_path`. Este feature requiere:

- Configurar un bucket privado en Supabase Storage.
- Server Action que reciba `FormData` con un `File`, valide tipo y tamaño, y
  suba el archivo a Storage.
- Actualizar `workshop_settings.logo_path` con la ruta del archivo.
- Políticas de Storage que permitan al owner del taller leer y escribir su
  logo.
- Reutilización de esta lógica desde el módulo `modules/workshops/` para
  reemplazar el logo posteriormente.

### 4.5 `modules/invoices/`

- **Título:** Ciclo de vida, cálculo y comprobantes de facturas.
- **Descripción:** Gestiona el ciclo completo de una factura: borradores,
selección de cliente, líneas de servicio o personalizadas, ajustes, cálculo
server-side, emisión, numeración, anulación, historial y generación/descarga de
PDF.
- **Lo que se espera que pueda hacer el usuario:**
  - Crear y editar borradores de factura.
  - Seleccionar un cliente activo y ver sus datos actuales.
  - Agregar servicios del catálogo o líneas personalizadas con cantidad y
    precio COP.
  - Aplicar impuestos, retenciones, descuentos y cobros adicionales.
  - Revisar subtotal, ajustes y total calculados por el servidor.
  - Emitir, consultar, anular y descargar comprobantes en PDF.
- **Estado actual:** NO IMPLEMENTADO.
- **Observaciones:** Las tablas `invoices`, `invoice_lines` e
`invoice_adjustments`, junto con sus restricciones, índices y políticas RLS,
están definidas en la migración inicial. Falta toda la lógica de aplicación,
incluyendo el recálculo server-side, la reserva segura de consecutivos y la
generación del PDF.

Entidades sugeridas:

- `invoices`: `id`, `workshop_id`, `customer_id`, `number`, `status`,
  `currency`, `issued_at`, `customer_name_snapshot`,
  `customer_document_snapshot`, `customer_contact_snapshot`, `subtotal_cop`,
  `total_adjustments_cop`, `total_cop`, `payment_method`,
  `payment_instructions`, `notes`, `created_at`, `updated_at`, `voided_at`.
- `invoice_lines`: `id`, `invoice_id`, `service_id` opcional,
  `description_snapshot`, `quantity`, `unit_price_cop`, `line_total_cop`,
  `created_at`.
- `invoice_adjustments`: `id`, `invoice_id`, `label`, `category`, `mode`,
  `value`, `base_cop`, `amount_cop`, `effect`, `sort_order`, `created_at`.

Modelo de ajustes:

- `category`: `tax`, `withholding`, `discount` o `fee`.
- `mode`: `percentage` o `fixed`.
- `value`: porcentaje o valor COP introducido por el usuario.
- `base_cop`: base usada cuando el modo es porcentual.
- `amount_cop`: importe COP calculado y congelado al guardar/emitar.
- `effect`: `add` o `subtract`.
- `sort_order`: orden explícito de aplicación.

La fórmula base será `subtotal + ajustes positivos - ajustes negativos`. Para un
porcentaje, el servidor determina la base según el orden y guarda esa base. Esto
permite representar tanto un impuesto del 19% como una retención del 2.5%, un
descuento fijo o un cobro adicional, sin crear columnas nuevas por cada tipo.
La interfaz debe mostrar claramente el efecto de cada ajuste y validar que los
porcentajes y valores sean válidos y que el total no sea negativo.

Todas las cantidades monetarias deben manejarse como enteros COP o un tipo
decimal exacto, nunca como cálculos flotantes del navegador.

### 4.6 `modules/dashboard/`

- **Título:** Resumen operativo del taller.
- **Descripción:** Muestra indicadores y consultas agregadas sobre las facturas
del taller. Debe reutilizar consultas públicas del módulo de facturas sin
acceder directamente a tablas internas de otro módulo.
- **Lo que se espera que pueda hacer el usuario:**
  - Ver el total facturado por periodo.
  - Ver la cantidad de facturas por estado.
  - Consultar las facturas recientes.
  - Identificar clientes y servicios más utilizados, si las consultas son
    necesarias.
- **Estado actual:** NO IMPLEMENTADO.
- **Observaciones:** Depende de la implementación previa de `modules/invoices/`.
No requiere tablas propias en el MVP.

### 4.7 `modules/admin/`

- **Título:** Administración global de Confectu.
- **Descripción:** Agrupa la gestión que solo `ADMIN` puede realizar sobre
catálogos globales y sobre talleres existentes. No pertenece a un taller;
opera de forma transversal y valida siempre el rol `ADMIN` en el servidor.
Contiene submódulos independientes, cada uno con sus componentes, Server
Actions, consultas, tipos y validaciones.
- **Lo que se espera que pueda hacer el usuario:**
  - Administrar el catálogo global de tipos de documento.
  - Listar y gestionar clientes de cualquier taller.
  - Desde un cliente, acceder a la gestión del taller al que pertenece: cuenta
    del taller, configuración del taller y servicios del taller.
  - Activar o desactivar talleres y administrar su configuración.
  - Administrar los servicios de cualquier taller.
- **Estado actual:** NO IMPLEMENTADO.
- **Observaciones:** El layout `(admin)/admin` y `AdminHeader` ya existen. Las
RLS actuales permiten a `ADMIN` leer y mutar `document_types`, `profiles`,
`workshops`, `workshop_settings` y `customers`. Para administrar `services`
se requiere ajustar las políticas RLS de `services` para permitir a `ADMIN`,
ya que actualmente solo permiten al taller propietario. Todas las Server
Actions deben validar rol `ADMIN`; en creación de clientes por `ADMIN`, el
`workshop_id` se valida contra un taller existente seleccionado en el
contexto admin, nunca se toma sin validación del formulario.

Estructura esperada:

```text
modules/admin/
├── document-types/
│   ├── components/
│   ├── actions.ts
│   ├── queries.ts
│   ├── types.ts
│   └── validations.ts
├── clients/
│   ├── components/
│   ├── actions.ts
│   ├── queries.ts
│   ├── types.ts
│   └── validations.ts
├── workshops/
│   ├── components/
│   ├── actions.ts
│   ├── queries.ts
│   ├── types.ts
│   └── validations.ts
└── services/
    ├── components/
    ├── actions.ts
    ├── queries.ts
    ├── types.ts
    └── validations.ts
```

#### 4.7.1 `modules/admin/document-types/`

- **Título:** Catálogo global de tipos de documento.
- **Descripción:** CRUD del catálogo `document_types` administrado por
`ADMIN`. Los talleres consultan este catálogo desde `modules/clients/`, pero
no pueden mutarlo.
- **Lo que se espera que pueda hacer el usuario:**
  - Listar, crear, editar y activar o desactivar tipos de documento.
  - Definir `code` único y `name`.
- **Entidades:**
  - `document_types`: `id`, `code`, `name`, `is_active`, `created_at`,
    `updated_at`.
- **Reglas:**
  - `code` es obligatorio y único globalmente.
  - `name` es obligatorio.
  - No se elimina físicamente: se desactiva para no romper clientes que
    referencian el tipo. La eliminación física queda fuera del MVP.
  - Las Server Actions validan rol `ADMIN` y devuelven `fieldErrors` por
    campo.

#### 4.7.2 `modules/admin/clients/`

- **Título:** Clientes gestionados por `ADMIN`.
- **Descripción:** Gestión transversal de `customers` para `ADMIN`. Permite
  editar, desactivar y reactivar clientes de cualquier taller desde la vista
  unificada de talleres. No incluye creación de clientes, que es responsabilidad
  de `CLIENT`.
- **Lo que se espera que pueda hacer el usuario:**
  - Listar clientes agrupados bajo cada taller en `/admin/workshops`.
  - Editar, desactivar y reactivar clientes de cualquier taller.
- **Estado actual:** IMPLEMENTADO.
- **Entidades:**
  - `customers`: mismas columnas que en `modules/clients/`.
- **Reglas:**
  - Las validaciones de campos son las mismas que en `modules/clients/`.
  - `workshop_id` se obtiene del registro existente; no se confía en el
    formulario sin verificación.
  - La unicidad de documento por taller se mantiene igual.
  - Las Server Actions validan rol `ADMIN`.

#### 4.7.3 `modules/admin/workshops/`

- **Título:** Talleres y configuración gestionados por `ADMIN`.
- **Descripción:** Permite a `ADMIN` gestionar la cuenta del taller
  (`workshops`) y su configuración (`workshop_settings`) de cualquier taller,
  incluyendo la vista unificada de talleres con sus clientes agrupados.
- **Lo que se espera que pueda hacer el usuario:**
  - Listar talleres con sus clientes agrupados y filtrar por nombre comercial.
  - Activar o desactivar un taller.
  - Editar nombre comercial, datos de contacto, identificación fiscal,
    prefijo de factura, siguiente número de factura, instrucciones de pago y
    logo opcional.
- **Estado actual:** IMPLEMENTADO.
- **Entidades:**
  - `workshops`: `id`, `owner_id`, `is_active`, `created_at`, `updated_at`.
  - `workshop_settings`: `workshop_id`, `business_name`, `tax_id`, `phone`,
    `email`, `address`, `invoice_prefix`, `next_invoice_number`,
    `payment_instructions`, `logo_path`, `created_at`, `updated_at`.
- **Reglas:**
  - `next_invoice_number` no puede disminuir.
  - `invoice_prefix` mantiene `^[A-Z0-9]{1,3}$`.
  - El logo se gestiona en Supabase Storage con políticas que permitan a
    `ADMIN` y al owner del taller leer y escribir.

#### 4.7.4 `modules/admin/services/`

- **Título:** Servicios gestionados por `ADMIN`.
- **Descripción:** CRUD transversal de `services` de cualquier taller.
- **Lo que se espera que pueda hacer el usuario:**
  - Listar servicios de todos los talleres con filtro por taller.
  - Crear, editar, activar o desactivar y eliminar servicios.
  - Definir nombre, descripción, categoría opcional y precio base en COP.
- **Entidades:**
  - `services`: `id`, `workshop_id`, `name`, `description`, `category`,
    `default_price_cop`, `is_active`, `created_at`, `updated_at`.
- **Reglas:**
  - Requiere migración de RLS para permitir a `ADMIN` leer y mutar
    `services`.
  - `default_price_cop` debe ser mayor o igual a `0`.
  - `workshop_id` se valida contra un taller existente.
  - Las Server Actions validan rol `ADMIN`.

## 5. Rutas de aplicación

Las rutas viven en `app/` y solo actúan como entradas de pantalla. No deben
contener consultas de Supabase ni Server Actions específicas de negocio.

```text
app/
├── (public)/login/
├── (private)/dashboard/
├── (private)/customers/
├── (private)/services/
├── (private)/invoices/
│   ├── new/
│   └── [id]/
├── (private)/settings/
└── (admin)/admin/
    ├── document-types/
    │   └── [id]/
    ├── clients/
    │   └── [id]/
    ├── workshops/
    │   └── [id]/
    └── services/
        └── [id]/
```

Los nombres de grupos de rutas son orientativos; deben adaptarse a la
estructura existente sin crear una carpeta `src/` alternativa.

## 6. Reglas de comunicación entre módulos

- Un módulo solo importa funciones públicas del módulo consumidor.
- No se importan archivos internos de otro módulo.
- Los Server Actions viven en el módulo dueño de la mutación.
- Todos los Server Actions reciben `FormData` y validan sesión, rol,
  pertenencia al taller y datos de entrada en el servidor.
- Las operaciones que afectan varias entidades deben ser atómicas mediante una
  función SQL o una operación server-side equivalente.
- `modules/admin/` valida rol `ADMIN` en todas sus Server Actions y no
  sustituye a las RLS; las políticas deben permitir las operaciones admin
  correspondientes.
- Las facturas guardan snapshots de cliente y líneas cuando sea necesario para
  que el documento histórico no cambie al editar el catálogo.

## 7. Seguridad y base de datos

- Toda tabla debe tener RLS habilitado.
- Las tablas del taller deben incluir `workshop_id` directa o indirectamente y
  sus políticas deben resolver la propiedad mediante el usuario autenticado.
- `ADMIN` puede administrar catálogos globales y cuentas; `CLIENT` solo puede
  operar sobre su propio taller.
- Nunca exponer la service role key en componentes cliente.
- El servidor debe volver a consultar clientes y servicios antes de emitir una
  factura; no confiar en IDs, precios o totales enviados por el navegador.
- Usar migraciones versionadas para tablas, índices, restricciones y políticas.

## 8. Criterios mínimos de finalización del MVP

- Un usuario puede autenticarse con Google y acceder únicamente si su cuenta
  está activa.
- Un taller puede administrar clientes y servicios propios.
- Un taller puede crear una factura con líneas del catálogo o personalizadas.
- La factura puede usar cero o más ajustes fijos o porcentuales en COP.
- El servidor recalcula subtotal, ajustes y total antes de emitir.
- La factura emitida recibe un número único con el prefijo configurado.
- El historial conserva facturas emitidas y anuladas sin borrarlas.
- El comprobante se puede descargar como PDF con los datos del taller, cliente,
  líneas, ajustes, totales, método de pago y logo si existe.
- `ADMIN` puede activar/desactivar cuentas de talleres y administrar tipos de
  documento, clientes, configuración y servicios de cualquier taller.
- Las pantallas tienen estados de carga, vacío, éxito y error, y funcionan
  primero en móvil.

## 9. Fuera del MVP

- Facturación electrónica o validación ante la DIAN.
- Pagos en línea y conciliación de abonos.
- Varios usuarios dentro de un mismo taller.
- Inventario, órdenes de trabajo y notificaciones.
- Compartir por enlace público y almacenamiento permanente de PDFs.
