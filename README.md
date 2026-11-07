# Soto Instalaciones Integrales — gestión

Web app instalable (PWA) para gestionar **clientes, presupuestos y facturas**, pensada para usar desde el móvil,
con un **asistente de voz** ("Haz un presupuesto para Casa García: cambiar caldera, 1200 euros").

## Arrancar

```bash
npm install
cp .env.example .env.local   # añade ANTHROPIC_API_KEY para el asistente de voz
npm run dev                  # http://localhost:3000
```

## Qué hay

- Clientes (ficha, historial de documentos), presupuestos y facturas con IVA por línea e IRPF opcional.
- Numeración correlativa por año (`P-2026-0001`, `F-2026-0001`); las facturas emitidas no se pueden borrar.
- Presupuesto → factura en un toque; estados; facturas vencidas; panel con pendiente de cobro.
- **Descargar PDF** (archivo real, con tu logo) y **Compartir PDF** desde el móvil (WhatsApp, correo…), además de la vista previa / imprimir. Generador en `lib/pdf.ts`.
- PDF/Imprimir con diseño de marca (presupuesto con firma de aceptación, factura con datos de pago), y envío por WhatsApp / email.
- Recordatorios de pago por email o WhatsApp (abren tu app de correo/WhatsApp con el texto preparado y guardan la fecha del último recordatorio). No se envían desde un servidor.
- Presupuesto aceptado → "Crear factura" (banner en el presupuesto y en Inicio); la factura copia conceptos, IVA y cliente y queda enlazada.
- Asistente de voz: dictado del navegador (es-ES) + Claude (`app/api/assistant`) que convierte la orden en acciones.
  Sin `ANTHROPIC_API_KEY` solo entiende órdenes simples ("abre facturas", "nuevo cliente Ana").
- Instalable en el móvil (Añadir a pantalla de inicio).
- Modo claro / oscuro / automático (Ajustes → Apariencia; se guarda en cada dispositivo).
- Bizum e IBAN como formas de pago en facturas y recordatorios.

## Catálogo de servicios y productos

Guarda tus servicios con precio e IVA (Ajustes → Catálogo, o el botón "Guardar en el catálogo" en cualquier línea de un
presupuesto/factura). Al escribir en una línea aparecen sugerencias; al elegir una se rellenan precio e IVA y solo hay que
poner la cantidad. El asistente de voz también las usa ("presupuesto para Casa García: cambio de caldera").

## Datos compartidos entre móvil y ordenador

Los datos viven en Supabase (proyecto `soto-instalaciones`, esquema en `supabase/migrations/`) y se sincronizan al editar,
al volver a abrir la app y en tiempo real. Cada cambio se guarda primero en el dispositivo, así que funciona sin conexión y
se sube al recuperarla. Hace falta iniciar sesión (email + contraseña); cada cuenta solo ve sus datos.

Configura `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` en `.env.local` (ver `.env.example`).
Sin ellas la app funciona en modo local.

En el panel de Supabase (Authentication → Sign In / Providers → Email) decide si exiges confirmar el email al registrarte y,
cuando hayas creado tu cuenta, desactiva los registros nuevos ("Allow new users to sign up").

## Limitaciones actuales

- Si dos dispositivos crean un documento sin conexión a la vez pueden repetir el número (p. ej. dos `F-2026-0005`); revísalo si pasa.
- Dictado por voz: Chrome/Edge/Safari; Firefox no lo soporta (se puede escribir la orden).
- Las facturas no cumplen aún Verifactu / factura electrónica; revisar con el gestor antes de usar en producción.

## Estructura

`lib/store.ts` datos · `lib/sync.ts` sincronización con Supabase · `lib/catalog.ts` sugerencias · `lib/actions.ts` acciones del asistente · `lib/assistant-tools.ts` herramientas de Claude ·
`app/documentos/[id]` editor · `components/Voice.tsx` micrófono.
