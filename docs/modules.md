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

## 4. Módulos

### 4.1 `modules/auth/`

Responsabilidad: autenticación, autorización y contexto de cuenta.

Estructura esperada:

```text
modules/auth/
├── components/
├── actions.ts
├── queries.ts
├── types.ts
└── validations.ts
```

Capacidades:

- Iniciar sesión y cerrar sesión con Google OAuth.
- Obtener el usuario autenticado en el servidor.
- Crear o actualizar el perfil de taller asociado a `auth.users.id`.
- Resolver el rol global (`ADMIN` o `CLIENT`) y el estado de la cuenta.
- Proteger rutas privadas y rechazar acciones sin sesión válida.
- Permitir a `ADMIN` listar y activar/desactivar cuentas `CLIENT`.

Entidades sugeridas:

- `profiles`: `id`, `role`, `is_active`, `created_at`, `updated_at`.
- `workshops`: `id`, `owner_id`, `is_active`, `created_at`, `updated_at`.

Regla: el rol no se acepta desde un formulario del cliente. Debe resolverse y
validarse en el servidor.

### 4.2 `modules/clients/`

Responsabilidad: personas atendidas por un taller. No confundir `CLIENT`, que
es el rol del propietario del taller, con `CUSTOMER`, que es un registro de
negocio.

Capacidades:

- Listar, buscar, crear, editar y desactivar clientes.
- Asociar cada cliente a un `workshop_id`.
- Asociar opcionalmente un tipo de documento del catálogo global.
- Exponer `getClientById` y búsquedas limitadas al taller actual para facturas.

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

Responsabilidad: catálogo de servicios, prendas y precios base.

Capacidades:

- CRUD de servicios del taller.
- Activar/desactivar servicios sin borrar facturas históricas.
- Guardar nombre, descripción, categoría opcional y precio base en COP.
- Seleccionar servicios en una factura.
- Permitir líneas personalizadas que no creen un registro en el catálogo.

Entidad sugerida:

- `services`: `id`, `workshop_id`, `name`, `description`, `category`,
  `default_price_cop`, `is_active`, `created_at`, `updated_at`.

Una línea de factura debe guardar una copia de la descripción y del precio
seleccionado. Nunca debe depender de que el servicio siga existiendo o conserve
el mismo precio.

### 4.4 `modules/workshops/`

Responsabilidad: identidad y configuración del taller que se muestra en los
comprobantes.

Capacidades:

- Editar nombre comercial, identificación fiscal opcional, teléfono, email y
  dirección.
- Configurar prefijo y consecutivo de facturas.
- Guardar texto comercial, método de pago o instrucciones para el cliente.
- Subir y reemplazar un logo opcional en Supabase Storage.

Entidades sugeridas:

- `workshop_settings`: `workshop_id`, `business_name`, `tax_id`, `phone`,
  `email`, `address`, `invoice_prefix`, `next_invoice_number`,
  `payment_instructions`, `logo_path`, `created_at`, `updated_at`.

El consecutivo debe reservarse en una operación server-side segura para evitar
duplicados si se emiten dos facturas simultáneamente.

### 4.5 `modules/invoices/`

Responsabilidad: ciclo de vida, cálculo, persistencia y representación de
comprobantes.

Capacidades:

- Crear y editar borradores.
- Seleccionar un cliente activo y mostrar sus datos actuales.
- Agregar servicios del catálogo o líneas personalizadas.
- Recibir cantidad y precio COP por línea.
- Aplicar impuestos, retenciones, descuentos y otros cobros opcionales.
- Validar y recalcular todos los totales en el servidor antes de guardar.
- Emitir, numerar, consultar, anular y descargar comprobantes.

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

Responsabilidad: resumen operativo del taller.

Primera versión:

- Total facturado por periodo.
- Cantidad de facturas por estado.
- Facturas recientes.
- Clientes y servicios más utilizados, si las consultas son necesarias.

Las consultas deben filtrar siempre por `workshop_id` y respetar RLS. Los
reportes históricos y exportaciones pueden añadirse después sin cambiar el
contrato de facturas.

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
└── (admin)/admin/document-types/
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
  documento.
- Las pantallas tienen estados de carga, vacío, éxito y error, y funcionan
  primero en móvil.

## 9. Fuera del MVP

- Facturación electrónica o validación ante la DIAN.
- Pagos en línea y conciliación de abonos.
- Varios usuarios dentro de un mismo taller.
- Inventario, órdenes de trabajo y notificaciones.
- Compartir por enlace público y almacenamiento permanente de PDFs.
