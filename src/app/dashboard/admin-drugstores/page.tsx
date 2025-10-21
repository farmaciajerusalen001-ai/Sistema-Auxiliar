"use client";

import { useAppDispatch, useAppState } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { useMemo, useState } from "react";

function slugLocal(s: string) {
  return String(s || "").trim().toLowerCase()
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");
}

export default function AdminDrugstoresPage() {
  const { drugstores, familyMap } = useAppState();
  const dispatch = useAppDispatch();

  const [newDsName, setNewDsName] = useState("");
  const [famAddDrugstoreId, setFamAddDrugstoreId] = useState<string>("");
  const [famAddName, setFamAddName] = useState<string>("");
  const [dsQuery, setDsQuery] = useState("");
  const [famQuery, setFamQuery] = useState("");
  const [editDsId, setEditDsId] = useState<string>("");
  const [editDsName, setEditDsName] = useState<string>("");
  const [famRename, setFamRename] = useState<Record<string, string>>({});

  const drugstoresSorted = useMemo(() => {
    const q = dsQuery.trim().toLowerCase();
    const base = [...drugstores].sort((a,b)=> a.name.localeCompare(b.name));
    if (!q) return base;
    return base.filter(d => d.name.toLowerCase().includes(q) || d.id.toLowerCase().includes(q));
  }, [drugstores, dsQuery]);
  const familiesFiltered = useMemo(() => {
    const q = famQuery.trim().toLowerCase();
    if (!q) return familyMap;
    return familyMap.filter(e => {
      const fam = e.family?.toLowerCase() || "";
      const ds = drugstores.find(d=>d.id===e.drugstoreId)?.name?.toLowerCase() || e.drugstoreId.toLowerCase();
      return fam.includes(q) || ds.includes(q);
    });
  }, [familyMap, famQuery, drugstores]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-headline">Administrar Droguerías y Familias</h1>
        <p className="text-muted-foreground">Crea, asigna y elimina droguerías y familias del mapeo general.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Crear nueva Droguería</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 max-w-xl">
            <Input placeholder="Nombre de la droguería" value={newDsName} onChange={(e)=>setNewDsName(e.target.value)} />
            <Button
              onClick={() => {
                const name = newDsName.trim();
                if (!name) return;
                const id = slugLocal(name) || 'sin-drogueria';
                if (drugstores.some(d=>d.id===id)) { alert('La droguería ya existe.'); return; }
                const next = [{ id: 'sin-drogueria', name: 'Sin Droguería' }, ...drugstores.filter(d=>d.id!=='sin-drogueria'), { id, name }]
                  .filter((v,i,a)=> a.findIndex(x=>x.id===v.id)===i);
                dispatch({ type: 'SET_DRUGSTORES', payload: next });
                setNewDsName("");
              }}
            >
              Agregar
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Agregar Familia a una Droguería</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-4xl">
            <SearchableSelect
              value={famAddDrugstoreId}
              onChange={setFamAddDrugstoreId}
              options={drugstores.map(d=> ({ value: d.id, label: d.name }))}
              placeholder="Selecciona droguería"
              searchPlaceholder="Buscar droguería..."
            />
            <Input placeholder="Nombre de la familia/laboratorio" value={famAddName} onChange={(e)=>setFamAddName(e.target.value)} />
            <Button
              variant="secondary"
              onClick={() => {
                const fam = famAddName.trim();
                const dsId = famAddDrugstoreId;
                if (!fam || !dsId) return;
                const exists = familyMap.some(e => e.family.trim().toUpperCase() === fam.toUpperCase());
                const next = exists
                  ? familyMap.map(e => e.family.trim().toUpperCase() === fam.toUpperCase() ? { family: fam, drugstoreId: dsId } : e)
                  : [...familyMap, { family: fam, drugstoreId: dsId }];
                dispatch({ type: 'SET_FAMILY_MAP', payload: next });
                setFamAddName("");
              }}
            >
              Agregar
            </Button>
          </div>
          <div className="text-xs text-muted-foreground mt-2">El mapeo afecta la clasificación en “Droguerías”.</div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Droguerías actuales</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-2 max-w-md">
            <Input placeholder="Buscar por nombre o ID" value={dsQuery} onChange={(e)=>setDsQuery(e.target.value)} />
          </div>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="py-2 pr-2">Nombre</th>
                  <th className="py-2 pr-2">ID</th>
                  <th className="py-2 pr-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {drugstoresSorted.filter(d=>d.id!=="sin-drogueria").map(d=> (
                  <tr key={d.id} className="border-t">
                    <td className="py-2 pr-2">{d.name}</td>
                    <td className="py-2 pr-2">{d.id}</td>
                    <td className="py-2 pr-2">
                      <Button
                        size="sm"
                        className="mr-2"
                        onClick={() => {
                          setEditDsId(d.id);
                          setEditDsName(d.name);
                          setFamRename({});
                        }}
                      >
                        Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const ok = window.confirm(`¿Eliminar la droguería "${d.name}"? Las familias mapeadas a esta droguería se asignarán a "Sin Droguería".`);
                          if (!ok) return;
                          const nextDs = drugstores.filter(x => x.id !== d.id);
                          const nextMap = familyMap.map(e => (e.drugstoreId === d.id ? { ...e, drugstoreId: 'sin-drogueria' } : e));
                          dispatch({ type: 'SET_DRUGSTORES', payload: nextDs });
                          dispatch({ type: 'SET_FAMILY_MAP', payload: nextMap });
                          if (editDsId === d.id) { setEditDsId(""); setEditDsName(""); setFamRename({}); }
                        }}
                      >
                        Eliminar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {editDsId && (
        <Card>
          <CardHeader>
            <CardTitle>Editar Droguería</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 max-w-4xl">
              <div className="md:col-span-2">
                <label className="text-sm block mb-1">Nombre de la droguería</label>
                <Input value={editDsName} onChange={(e)=>setEditDsName(e.target.value)} />
              </div>
              <div className="flex items-end gap-2">
                <Button
                  onClick={() => {
                    const name = editDsName.trim();
                    if (!name) return;
                    const next = drugstores.map(d => d.id === editDsId ? { ...d, name } : d);
                    dispatch({ type: 'SET_DRUGSTORES', payload: next });
                    alert('Droguería actualizada');
                  }}
                >
                  Guardar cambios
                </Button>
                <Button variant="outline" onClick={()=>{ setEditDsId(""); setEditDsName(""); setFamRename({}); }}>Cerrar</Button>
              </div>
            </div>

            <div className="mt-6">
              <div className="text-sm font-medium mb-2">Familias de esta droguería</div>
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left">
                      <th className="py-2 pr-2">Familia (actual)</th>
                      <th className="py-2 pr-2">Nuevo nombre</th>
                      <th className="py-2 pr-2">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {familyMap.filter(e=>e.drugstoreId===editDsId).map((e, idx) => {
                      const key = e.family;
                      const nextName = famRename[key] ?? e.family;
                      return (
                        <tr key={`${e.family}-${idx}`} className="border-t">
                          <td className="py-2 pr-2">{e.family}</td>
                          <td className="py-2 pr-2">
                            <Input
                              value={nextName}
                              onChange={(ev)=>setFamRename(prev=>({ ...prev, [key]: ev.target.value }))}
                            />
                          </td>
                          <td className="py-2 pr-2">
                            <Button
                              size="sm"
                              onClick={() => {
                                const newName = (famRename[key] ?? e.family).trim();
                                if (!newName) return;
                                const updated = familyMap.map(f => f.family === e.family ? { ...f, family: newName } : f);
                                dispatch({ type: 'SET_FAMILY_MAP', payload: updated });
                                setFamRename(prev=> ({ ...prev, [key]: newName }));
                              }}
                            >
                              Guardar
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Familias mapeadas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 mb-2 max-w-md">
            <Input placeholder="Buscar por familia o droguería" value={famQuery} onChange={(e)=>setFamQuery(e.target.value)} />
          </div>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left">
                  <th className="py-2 pr-2">Familia</th>
                  <th className="py-2 pr-2">Droguería</th>
                  <th className="py-2 pr-2">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {familiesFiltered.map((e, idx) => {
                  const dsName = drugstores.find(d=>d.id===e.drugstoreId)?.name || e.drugstoreId;
                  return (
                    <tr key={`${e.family}-${idx}`} className="border-t">
                      <td className="py-2 pr-2">{e.family}</td>
                      <td className="py-2 pr-2">{dsName}</td>
                      <td className="py-2 pr-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const ok = window.confirm(`¿Eliminar la familia "${e.family}" del mapeo?`);
                            if (!ok) return;
                            const next = familyMap.filter((x,i)=> i!==idx);
                            dispatch({ type: 'SET_FAMILY_MAP', payload: next });
                          }}
                        >
                          Eliminar
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
