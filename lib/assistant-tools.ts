// Tool definitions shared by the API route. The model picks tools; the browser executes them
// against the local store (so the server never needs the user's data persisted).
export const TOOLS = [
  {
    name: "create_client",
    description: "Crear un cliente nuevo.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string" },
        phone: { type: "string" },
        email: { type: "string" },
        nif: { type: "string" },
        address: { type: "string" },
      },
      required: ["name"],
    },
  },
  {
    name: "create_document",
    description:
      "Crear un presupuesto o una factura en borrador. Si el cliente no existe se crea. Los precios son SIN IVA salvo que el usuario diga lo contrario (en ese caso divide entre 1+IVA).",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string", enum: ["quote", "invoice"] },
        client_name: { type: "string" },
        lines: {
          type: "array",
          items: {
            type: "object",
            properties: {
              description: { type: "string" },
              qty: { type: "number" },
              price: {
                type: "number",
                description:
                  "Precio unitario sin IVA, en euros. OMÍTELO si el usuario no lo dice y el concepto coincide con un artículo del catálogo: se rellenará solo.",
              },
            },
            required: ["description", "qty"],
          },
        },
        notes: { type: "string" },
      },
      required: ["type", "client_name", "lines"],
    },
  },
  {
    name: "set_status",
    description: "Cambiar el estado de un presupuesto o factura existente (por su número).",
    input_schema: {
      type: "object",
      properties: {
        number: { type: "string", description: "Número del documento, p.ej. F-2026-0003 o solo 0003" },
        status: { type: "string", enum: ["draft", "sent", "accepted", "rejected", "paid"] },
      },
      required: ["number", "status"],
    },
  },
  {
    name: "convert_quote_to_invoice",
    description: "Convertir un presupuesto en factura.",
    input_schema: {
      type: "object",
      properties: { number: { type: "string" } },
      required: ["number"],
    },
  },
  {
    name: "open",
    description:
      "Navegar a una pantalla o abrir un documento/cliente. target: inicio, clientes, presupuestos, facturas, ajustes, un número de documento o el nombre de un cliente.",
    input_schema: {
      type: "object",
      properties: { target: { type: "string" } },
      required: ["target"],
    },
  },
] as const;

export const SYSTEM_PROMPT = `Eres el asistente de voz de "Soto Instalaciones Integrales", una empresa de instalaciones (fontanería, electricidad, climatización...) en España. Ayudas al dueño a gestionar clientes, presupuestos y facturas desde el móvil.

Reglas:
- Responde SIEMPRE en español, en una o dos frases cortas, pensadas para ser leídas en voz alta. Nada de markdown ni listas.
- Para crear/modificar datos usa las herramientas. Puedes llamar a varias a la vez.
- Los documentos se crean como BORRADOR; nunca digas que se han enviado.
- El contexto incluye el "catalog" (servicios/productos guardados con su precio). Si el usuario nombra uno, usa el nombre del catálogo y no inventes el precio.
- Si falta un dato imprescindible (por ejemplo el cliente o el importe), pregunta en vez de inventarlo.
- Para preguntas sobre el negocio (cuánto me deben, qué presupuestos están pendientes...) responde con los datos del contexto; no inventes cifras.
- Los importes hablados como "mil doscientos euros" son 1200. Interpreta "más IVA" como precio sin IVA.`;
