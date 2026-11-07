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
- PDF/Imprimir, y envío por WhatsApp / email.
- Asistente de voz: dictado del navegador (es-ES) + Claude (`app/api/assistant`) que convierte la orden en acciones.
  Sin `ANTHROPIC_API_KEY` solo entiende órdenes simples ("abre facturas", "nuevo cliente Ana").
- Instalable en el móvil (Añadir a pantalla de inicio).

## Limitaciones actuales

- **Los datos se guardan en el navegador del dispositivo** (`localStorage`). No se sincronizan entre móvil y ordenador:
  usa Ajustes → Copia de seguridad. Siguiente paso natural: base de datos en la nube (p. ej. Supabase) + login.
- Dictado por voz: Chrome/Edge/Safari; Firefox no lo soporta (se puede escribir la orden).
- Las facturas no cumplen aún Verifactu / factura electrónica; revisar con el gestor antes de usar en producción.

## Estructura

`lib/store.ts` datos · `lib/actions.ts` acciones del asistente · `lib/assistant-tools.ts` herramientas de Claude ·
`app/documentos/[id]` editor · `components/Voice.tsx` micrófono.
