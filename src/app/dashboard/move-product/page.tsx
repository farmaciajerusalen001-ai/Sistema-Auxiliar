"use client";

import { useEffect, useMemo, useState } from "react";
import { useAppDispatch, useAppState } from "@/lib/store";
import { resolveDrugstoreIdByFamily } from "@/lib/drugstores";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SearchableSelect } from "@/components/ui/searchable-select";
import defaultMap from "@/lib/drugstores-default.json" assert { type: "json" };
import { idbGet, idbSet } from "@/lib/idb";
import Link from "next/link";

export default function MoveProductPage() {
  const { products, drugstores, familyMap, laboratories, productOverrides } = useAppState();
  const dispatch = useAppDispatch();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const [query, setQuery] = useState("");
  const [key, setKey] = useState<string>("");
  // Reasignación (producto individual)
  const [reDstDrugstore, setReDstDrugstore] = useState<string>("");
  const [reDstFamily, setReDstFamily] = useState<string>("");
  const [reNewFamily, setReNewFamily] = useState<string>("");
  // Mover familia (origen)
  const [srcFamily, setSrcFamily] = useState<string>("");
  // Mover familia (destino)
  const [famDstDrugstore, setFamDstDrugstore] = useState<string>("");
  const [famNewFamily, setFamNewFamily] = useState<string>("");

  // Admin: crear droguería y agregar familia
  const [newDsName, setNewDsName] = useState<string>("");
  const [famAddDrugstoreId, setFamAddDrugstoreId] = useState<string>("");
  const [famAddName, setFamAddName] = useState<string>("");

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [] as Array<{ key: string; label: string; currentDs: string; currentFam: string }>
    const arr: Array<{ key: string; label: string; currentDs: string; currentFam: string }> = [];
    const seen = new Set<string>();
    for (const p of products as any[]) {
      const code = String(p.CODIGO ?? p.code ?? "").trim();
      const desc = String(p.DESCRIPCION ?? p.name ?? "").trim();
      if (!code && !desc) continue;
      const match = code.toLowerCase().includes(q) || desc.toLowerCase().includes(q);
      if (!match) continue;
      const key = code || desc; // clave funcional
      if (seen.has(key)) continue; // evitar duplicados
      seen.add(key);
      const label = code ? `${code} — ${desc}` : desc;
      const fam = String(p.FAMILIA ?? "");
      const dsId = resolveDrugstoreIdByFamily(fam, familyMap, "sin-drogueria");
      const dsName = (drugstores.find(d=>d.id===dsId)?.name) || dsId;
      arr.push({ key, label, currentDs: dsName, currentFam: fam || "-" });
      if (arr.length >= 12) break;
    }
    return arr;
  }, [query, products, familyMap, drugstores]);

  const slugLocal = (s: string) => String(s || "").trim().toLowerCase()
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

  // Families available for the selected drugstore, taken from JSON mapping
  const familiesForDst = useMemo(() => {
    if (!reDstDrugstore) return [] as string[];
    const set = new Set<string>();
    const data = (defaultMap as Array<{ LABORATORIO: string; DROGUERIA: string }>);
    for (const row of data) {
      const dslug = slugLocal(String(row.DROGUERIA || ""));
      const fam = String(row.LABORATORIO || "").trim();
      if (dslug === reDstDrugstore && fam) set.add(fam);
    }
    return Array.from(set).sort((a,b)=>a.localeCompare(b));
  }, [reDstDrugstore]);

  // Familias disponibles (origen) basadas en los productos cargados
  const availableFamilies = useMemo(() => {
    const set = new Set<string>();
    for (const p of products as any[]) {
      const fam = String(p.FAMILIA ?? '').trim();
      if (fam) set.add(fam);
    }
    return Array.from(set).sort((a,b)=>a.localeCompare(b));
  }, [products]);

  // Reset family inputs when Reasignación drugstore changes
  useEffect(() => {
    setReDstFamily("");
    setReNewFamily("");
  }, [reDstDrugstore]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-headline">Mover producto</h1>
        <p className="text-muted-foreground">Reasigna un producto a otra Droguería y/o Familia (Laboratorio) sin tocar los datos originales.</p>
        <div className="mt-3">
          <Link href="/dashboard/admin-drugstores" className="inline-block">
            <Button variant="outline" size="sm">Ir a administrar Droguerías y Familias</Button>
          </Link>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Reasignación</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
            <div>
              <label className="text-sm block mb-1">Buscar producto</label>
              <Input
                value={query}
                onChange={(e)=>{
                  const v = e.target.value; setQuery(v);
                  const q = v.trim().toLowerCase();
                  const found = products.find((p:any)=> String(p.CODIGO ?? p.code ?? "").trim().toLowerCase()===q || String(p.DESCRIPCION ?? p.name ?? "").toLowerCase().includes(q));
                  if(found){
                    const code = String(found.CODIGO ?? found.code ?? "").trim();
                    const desc = String(found.DESCRIPCION ?? found.name ?? "").trim();
                    setKey(code || desc);
                  }
                }}
                placeholder="Código o nombre"
              />
              <div className="text-xs text-muted-foreground mt-1">Key: {key || "(auto)"}</div>
              {mounted && suggestions.length > 0 && (
                <div className="mt-2 border rounded-md max-h-60 overflow-auto bg-background">
                  {suggestions.map((s, i) => (
                    <button
                      key={`${s.key}-${i}`}
                      type="button"
                      className="w-full text-left px-2 py-1 hover:bg-accent"
                      onClick={() => { setKey(s.key); setQuery(s.label); }}
                    >
                      <div className="text-sm font-medium">{s.label}</div>
                      <div className="text-xs text-muted-foreground">Droguería actual: {s.currentDs} · Familia actual: {s.currentFam}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="text-sm block mb-1">Droguería destino</label>
              <SearchableSelect
                value={reDstDrugstore}
                onChange={setReDstDrugstore}
                options={drugstores.map(d=> ({ value: d.id, label: d.name }))}
                placeholder="Selecciona droguería"
                searchPlaceholder="Buscar droguería..."
                maxHeightClass="max-h-56"
              />
            </div>
            <div>
              <label className="text-sm block mb-1">Familia/Laboratorio destino</label>
              <SearchableSelect
                value={reDstFamily}
                onChange={setReDstFamily}
                options={familiesForDst.map(name => ({ value: name, label: name }))}
                placeholder="Selecciona familia"
                searchPlaceholder="Buscar familia..."
                maxHeightClass="max-h-56"
              />
            </div>
            <div>
              <label className="text-sm block mb-1">Nueva familia (opcional)</label>
              <Input value={reNewFamily} onChange={(e)=>setReNewFamily(e.target.value)} placeholder="Escribe una nueva familia" />
              <div className="text-xs text-muted-foreground mt-1">Si escribes una nueva, tendrá prioridad sobre la seleccionada.</div>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <Button
              onClick={() => {
                if (!key) return;
                if (!reDstDrugstore) return; // droguería destino es obligatoria
                const family = (reNewFamily && reNewFamily.trim()) ? reNewFamily.trim() : (reDstFamily || undefined);
                dispatch({ type: "SET_PRODUCT_OVERRIDE", payload: { key, override: { drugstoreId: reDstDrugstore, laboratory: family } } });
              }}
            >
              Guardar cambio
            </Button>
            <Button
              variant="outline"
              onClick={() => { if (key) dispatch({ type: "CLEAR_PRODUCT_OVERRIDE", payload: { key } }); }}
            >
              Quitar override
            </Button>
          </div>
        </CardContent>
      </Card>

      

      {/* Mover familia completa */}
      <Card>
        <CardHeader>
          <CardTitle>Mover familia</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
            <div>
              <label className="text-sm block mb-1">Familia/Laboratorio origen</label>
              <SearchableSelect
                value={srcFamily}
                onChange={setSrcFamily}
                options={availableFamilies.map(name => ({ value: name, label: name }))}
                placeholder="Selecciona familia origen"
                searchPlaceholder="Buscar familia..."
                maxHeightClass="max-h-56"
              />
            </div>
            <div>
              <label className="text-sm block mb-1">Droguería destino</label>
              <SearchableSelect
                value={famDstDrugstore}
                onChange={setFamDstDrugstore}
                options={drugstores.map(d=> ({ value: d.id, label: d.name }))}
                placeholder="Selecciona droguería"
                searchPlaceholder="Buscar droguería..."
              />
            </div>
            <div>
              <label className="text-sm block mb-1">Nuevo nombre de familia (opcional)</label>
              <Input value={famNewFamily} onChange={(e)=>setFamNewFamily(e.target.value)} placeholder="Escribe una nueva familia" />
              <div className="text-xs text-muted-foreground mt-1">Si escribes una nueva, se aplicará a todos los productos de la familia.</div>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <Button
              onClick={() => {
                const fam = (srcFamily || '').trim();
                if (!fam) return;
                if (!famDstDrugstore) return;
                const finalFamily = (famNewFamily && famNewFamily.trim()) ? famNewFamily.trim() : fam;
                // Aplicar override a todos los productos de la familia
                const keysApplied: string[] = [];
                for (const p of products as any[]) {
                  const pfam = String(p.FAMILIA ?? '').trim();
                  if (pfam !== fam) continue;
                  const code = String(p.CODIGO ?? p.code ?? '').trim();
                  const desc = String(p.DESCRIPCION ?? p.name ?? '').trim();
                  const k = code || desc;
                  if (!k) continue;
                  keysApplied.push(k);
                  dispatch({ type: 'SET_PRODUCT_OVERRIDE', payload: { key: k, override: { drugstoreId: famDstDrugstore, laboratory: finalFamily } } });
                }
                // Actualizar familyMap para la familia
                const nextMap = [
                  ...familyMap.filter(e => e.family !== fam),
                  { family: finalFamily, drugstoreId: famDstDrugstore },
                ];
                dispatch({ type: 'SET_FAMILY_MAP', payload: nextMap });
              }}
              disabled={!srcFamily || !famDstDrugstore}
            >
              Mover familia
            </Button>
          </div>
        </CardContent>
      </Card>
      {mounted && Object.keys(productOverrides).length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle>Overrides activos</CardTitle>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  onClick={async () => {
                    try {
                      await idbSet('pharmaPermanentOverrides', productOverrides);
                      dispatch({ type: 'MERGE_PRODUCT_OVERRIDES', payload: productOverrides });
                      alert('Overrides guardados como permanentes y aplicados.');
                    } catch {
                      alert('No fue posible guardar y aplicar los overrides permanentes.');
                    }
                  }}
                >
                  Guardar y aplicar permanentes
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="py-2 pr-2">Producto (key)</th>
                    <th className="py-2 pr-2">Droguería asignada</th>
                    <th className="py-2 pr-2">Familia/Laboratorio</th>
                    <th className="py-2 pr-2">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(productOverrides).map(([k, ov]) => (
                    <tr key={k} className="border-t">
                      <td className="py-2 pr-2">{k}</td>
                      <td className="py-2 pr-2">{drugstores.find(d=>d.id===ov.drugstoreId)?.name || ov.drugstoreId || '-'}</td>
                      <td className="py-2 pr-2">{ov.laboratory || '-'}</td>
                      <td className="py-2 pr-2">
                        <Button size="sm" variant="outline" onClick={() => dispatch({ type: "CLEAR_PRODUCT_OVERRIDE", payload: { key: k } })}>Quitar</Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
