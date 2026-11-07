"use client";
import { useState } from "react";
import { addCatalogItem, deleteCatalogItem, updateCatalogItem, useStore } from "@/lib/store";
import { money, norm } from "@/lib/format";
import { CATEGORIES, type CatalogItem } from "@/lib/types";
import { NumInput } from "@/components/NumInput";
import { Icon } from "@/components/Icon";

export default function Catalogo() {
  const { ready, catalog } = useStore();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [editing, setEditing] = useState<string | null>(null);
  if (!ready) return null;

  const rows = catalog
    .filter((c) => cat === "all" || c.category === cat)
    .filter((c) => !q || norm(c.name).includes(norm(q)))
    .sort((a, b) => a.name.localeCompare(b.name, "es"));
  const groups = [...CATEGORIES, ""].map((g) => ({ name: g, items: rows.filter((r) => (CATEGORIES.includes(r.category) ? r.category : "") === g) })).filter((g) => g.items.length);

  return (
    <div className="stack">
      <div className="row between wrap">
        <div>
          <h1>Catálogo</h1>
          <p className="muted" style={{ margin: 0 }}>{catalog.length} {catalog.length === 1 ? "servicio o producto" : "servicios y productos"}. Al escribirlos en un presupuesto o factura se rellenan solos.</p>
        </div>
        <button className="btn primary" onClick={() => setEditing(addCatalogItem({ name: "Nuevo servicio", category: cat === "all" ? "" : cat }).id)}>
          <Icon name="plus" size={18} /> Nuevo
        </button>
      </div>

      <div className="note">
        <strong>Cambiar un precio solo afecta a lo nuevo.</strong> Los presupuestos y facturas que ya has creado conservan el precio con el que se hicieron; el nuevo precio se usa a partir del siguiente documento.
      </div>

      <input placeholder="Buscar…" aria-label="Buscar en el catálogo" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="chips">
        {["all", ...CATEGORIES].map((c) => (
          <button key={c} className={`chip ${cat === c ? "on" : ""}`} onClick={() => setCat(c)}>{c === "all" ? "Todos" : c}</button>
        ))}
      </div>

      <div className="card">
        {rows.length === 0 ? (
          <div className="empty">{catalog.length ? "Sin resultados." : "Aún no hay nada. Añade servicios aquí o pulsa “Guardar en el catálogo” al escribirlos en un presupuesto."}</div>
        ) : (
          groups.map((g) => (
            <section key={g.name || "none"}>
              <div className="group-h"><h2>{g.name || "Sin clasificar"}</h2><span className="muted">{g.items.length}</span></div>
              <div className="list">
                {g.items.map((c) =>
                  editing === c.id ? (
                    <Editor key={c.id} item={c} onDone={() => setEditing(null)} />
                  ) : (
                    <button key={c.id} className="item" onClick={() => setEditing(c.id)} aria-label={`Editar ${c.name}`}
                      style={{ font: "inherit", color: "inherit", textAlign: "left" }}>
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <strong>{c.name}</strong>
                        <span className="muted" style={{ display: "block", fontSize: ".85rem" }}>
                          {[`IVA ${c.vat}%`, c.uses ? `usado ${c.uses} ${c.uses === 1 ? "vez" : "veces"}` : ""].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <strong>{money(c.price)}{c.unit ? ` / ${c.unit}` : ""}</strong>
                      <span className="muted" aria-hidden><Icon name="pencil" size={18} /></span>
                    </button>
                  ),
                )}
              </div>
            </section>
          ))
        )}
      </div>
    </div>
  );
}

function Editor({ item, onDone }: { item: CatalogItem; onDone: () => void }) {
  const set = (p: Partial<CatalogItem>) => updateCatalogItem(item.id, p);
  return (
    <div style={{ padding: ".8rem 0" }} className="stack">
      <div><label>Nombre</label><input value={item.name} autoFocus onChange={(e) => set({ name: e.target.value })} /></div>
      <div className="grid g3">
        <div><label>Precio (sin IVA)</label><NumInput value={item.price} onChange={(n) => set({ price: n })} /></div>
        <div><label>IVA %</label><NumInput value={item.vat} onChange={(n) => set({ vat: n })} /></div>
        <div><label>Unidad</label><input value={item.unit} placeholder="ud, h, m…" onChange={(e) => set({ unit: e.target.value })} /></div>
      </div>
      <div><label>Tipo</label>
        <select value={item.category} onChange={(e) => set({ category: e.target.value })}>
          <option value="">Sin clasificar</option>
          {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
        </select></div>
      <div className="muted" style={{ fontSize: ".85rem" }}>Los cambios se aplican a los documentos nuevos. Los ya creados no cambian.</div>
      <div className="row between">
        <button className="btn danger sm" onClick={() => { if (confirm(`¿Quitar “${item.name}” del catálogo? Los documentos ya creados no cambian.`)) deleteCatalogItem(item.id); }}>Eliminar</button>
        <button className="btn primary sm" onClick={onDone}>Hecho</button>
      </div>
    </div>
  );
}
