"use client";

import { useState, useMemo, useEffect } from "react";
import { useAppDispatch, useAppState } from "@/lib/store";
import { ALL_UNITS, Product, unitGroups } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";

export function ConversionTool() {
  const { products, conversions, exportAfterSave } = useAppState();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [targetUnit, setTargetUnit] = useState<string>("");
  const [equivalence, setEquivalence] = useState<number>(1);
  const [query, setQuery] = useState<string>("");
  const [amount, setAmount] = useState<number>(1);
  const [targetFactor, setTargetFactor] = useState<number>(10); // 1 target = factor source
  const [comment, setComment] = useState<string>("");
  const [roundUp, setRoundUp] = useState<boolean>(false);

  const selectedProduct = useMemo(
    () => products.find((p) => p.id === selectedProductId),
    [products, selectedProductId]
  );

  // Prefill amount with total A_PEDIR del producto (sumando todas las sucursales por mismo código y unidad)
  useEffect(() => {
    if (!selectedProduct) return;
    const code = String((selectedProduct as any).CODIGO ?? selectedProduct.code ?? "").trim();
    const name = String((selectedProduct as any).DESCRIPCION ?? selectedProduct.name ?? "").trim();
    const unit = String((selectedProduct as any).UNI_MED ?? selectedProduct.unit ?? "").trim();
    const sameProduct = products.filter((p) => {
      const c = String((p as any).CODIGO ?? p.code ?? "").trim();
      const n = String((p as any).DESCRIPCION ?? p.name ?? "").trim();
      const u = String((p as any).UNI_MED ?? p.unit ?? "").trim();
      return (code ? c === code : n === name) && u === unit;
    });
    const toNum = (v: any) => {
      const n = parseFloat(String(v ?? "").toString().replace(",", "."));
      return Number.isFinite(n) ? n : 0;
    };
    const sum = sameProduct.reduce((acc, p) => acc + toNum((p as any).A_PEDIR ?? (p as any).APEDIR), 0);
    setAmount(sum > 0 ? sum : 1);
  }, [selectedProduct, products]);

  const normalized = (s: any) => String(s ?? "").toLowerCase();
  const filteredProducts = useMemo(() => {
    // Si hay productos filtrados desde la exportación, usar solo esos
    if (exportAfterSave?.filteredProducts && Array.isArray(exportAfterSave.filteredProducts)) {
      const filteredCodes = exportAfterSave.filteredProducts;
      return products.filter((p) => {
        const code = String((p as any).CODIGO ?? p.code ?? "").trim();
        const name = String((p as any).DESCRIPCION ?? p.name ?? "").trim();
        return filteredCodes.includes(code) || filteredCodes.includes(name);
      });
    }
    
    // Comportamiento normal: filtrar por búsqueda
    const q = normalized(query);
    if (q.length < 2) return [] as typeof products;
    const res = products.filter((p) => {
      const code = normalized((p as any).CODIGO ?? p.code);
      const name = normalized((p as any).DESCRIPCION ?? p.name);
      return code.includes(q) || name.includes(q);
    });
    return res.slice(0, 200);
  }, [products, query, exportAfterSave?.filteredProducts]);

  const getUnitGroup = (unit?: string) => {
    if (!unit) return ALL_UNITS;
    for (const groupName in unitGroups) {
      const key = groupName as keyof typeof unitGroups;
      if (unitGroups[key].includes(unit as any)) {
        return unitGroups[key];
      }
    }
    return ALL_UNITS;
  };

  const coherentUnits = useMemo(() => {
    if (!selectedProduct) return [];
    return getUnitGroup(selectedProduct.unit);
  }, [selectedProduct]);

  const convertedQuantity = useMemo(() => {
    if (!selectedProduct || !targetUnit) return 0;

    // Quantity comes from user input; default 1
    const qty = Number(amount ?? 0);
    if (!Number.isFinite(qty) || qty <= 0) return 0;

    const sourceUnit = selectedProduct.unit ?? "";
    if (sourceUnit === targetUnit) return qty;

    const f = Number(targetFactor);
    if (!Number.isFinite(f) || f <= 0) return 0;
    // 1 target = f source -> source -> target = qty / f
    const val = qty / f;
    return roundUp ? Math.ceil(val) : val;
  }, [selectedProduct, targetUnit, amount, targetFactor, roundUp]);

  const isFactorValid = useMemo(() => Number(targetFactor) > 0, [targetFactor]);

  const { toast } = useToast();

  const handleCalculate = () => {
    if (!selectedProduct || !targetUnit || !isFactorValid) return;
    toast({ title: "Conversión calculada", description: `Convertidos ${amount} ${selectedProduct.unit} a ${convertedQuantity} ${targetUnit}` });
  };

  // Persist conversion into global store so other pages recompute
  // UI equivalence means: 1 sourceUnit = eq targetUnit
  // Store expects: 1 targetUnit = factor sourceUnit -> factor = 1/eq
  const convKey = useMemo(() => {
    if (!selectedProduct) return "";
    const code = String(selectedProduct.code ?? selectedProduct["CODIGO"] ?? "").trim();
    const desc = String(selectedProduct.name ?? selectedProduct["DESCRIPCION"] ?? "").trim();
    return code || desc;
  }, [selectedProduct]);

  const existing = convKey ? conversions[convKey] : undefined;

  const handleRemove = () => {
    if (!convKey) return;
    dispatch({ type: "REMOVE_CONVERSION", payload: { key: convKey } });
    toast({ title: "Eliminado", description: "Conversión eliminada para este producto" });
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="product-search">Producto</Label>
        <Input
          id="product-search"
          placeholder={
            exportAfterSave?.filteredProducts 
              ? `Productos de ${exportAfterSave.page === 'drugstores' ? 'la droguería' : 'consolidado'} (${filteredProducts.length})` 
              : "Escribe al menos 2 letras del código o nombre..."
          }
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          disabled={!!exportAfterSave?.filteredProducts} // Deshabilitar búsqueda cuando hay filtro específico
        />
        <Select
          onValueChange={(value) => {
            setSelectedProductId(value);
            setTargetUnit("");
          }}
        >
          <SelectTrigger id="product-select">
            <SelectValue placeholder={
              exportAfterSave?.filteredProducts 
                ? `Selecciona producto (${filteredProducts.length} disponibles)` 
                : query.length < 2 ? "Escribe para buscar" : `Resultados: ${filteredProducts.length}`
            } />
          </SelectTrigger>
          <SelectContent>
            {filteredProducts.map((product) => (
              <SelectItem key={product.id} value={product.id}>
                {(product as any).CODIGO ?? product.code ?? ""} - {(product as any).DESCRIPCION ?? product.name ?? ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {exportAfterSave?.filteredProducts ? (
          <p className="text-xs text-muted-foreground">
            Solo puedes editar conversiones para productos de {exportAfterSave.page === 'drugstores' ? 'esta droguería' : 'consolidado'}.
            Al guardar, se descargará automáticamente el archivo con las conversiones aplicadas.
          </p>
        ) : query.length < 2 && (
          <p className="text-xs text-muted-foreground">Empieza a escribir para cargar resultados (mín 2 caracteres).</p>
        )}
      </div>

      {selectedProduct && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 items-end gap-4">
            <div className="space-y-2">
              <Label>From</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={amount}
                  onChange={(e) => setAmount(Number(e.target.value))}
                  className="w-40"
                />
                <Input value={String(selectedProduct.unit ?? "")} disabled className="flex-1" />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="target-unit">To</Label>
              <Select value={targetUnit} onValueChange={setTargetUnit}>
                <SelectTrigger id="target-unit">
                  <SelectValue placeholder="Target Unit..." />
                </SelectTrigger>
                <SelectContent>
                  {coherentUnits.map((unit) => (
                    <SelectItem key={unit} value={unit} disabled={unit === selectedProduct.unit}>
                      {unit}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

          <div className="space-y-2">
            <Label>Equivalencia</Label>
            <div className="flex items-center gap-2">
                <span className="text-xs">1 {targetUnit || "[destino]"} =</span>
                <Input
                  type="number"
                  step="any"
                  placeholder={selectedProduct.unit ? `${selectedProduct.unit}` : `unidad origen`}
                  value={targetFactor}
                  onChange={(e) => setTargetFactor(Number(e.target.value))}
                  disabled={!targetUnit}
                  className="w-28"
                />
                <span className="text-xs">{String(selectedProduct.unit ?? "")}</span>
              </div>
            <div className="space-y-1">
              <Label htmlFor="obs" className="text-xs">Observaciones (opcional)</Label>
              <Input id="obs" placeholder="Ej.: Convertido a cajas por presentación de 10 tabletas" value={comment} onChange={(e) => setComment(e.target.value)} />
            </div>
          </div>
        </div>
          <div className="flex items-center justify-center">
            <Button disabled={!targetUnit || !isFactorValid} onClick={handleCalculate}>
              Calculate Conversion
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>

          <Card className="text-center bg-secondary">
            <CardContent className="p-6">
                <Label className="text-muted-foreground">Result</Label>
                <p className="text-3xl font-bold font-headline tracking-tight">
                    {convertedQuantity.toLocaleString()} {targetUnit}
                </p>
            </CardContent>
          </Card>
          {!isFactorValid && (
            <p className="text-sm text-red-500 mt-2">Please enter a valid equivalence greater than 0.</p>
          )}

          <div className="flex gap-2 justify-center">
            <Button
              variant="secondary"
              disabled={!targetUnit || !isFactorValid}
              onClick={() => {
                if (!selectedProduct || !targetUnit) return;
                const key = convKey;
                if (!key) return;
                const factor = Number(targetFactor);
                dispatch({
                  type: "SET_CONVERSION",
                  payload: {
                    key,
                    def: {
                      sourceUnit: String(selectedProduct.unit ?? ""),
                      targetUnit: targetUnit,
                      factor,
                      comment: comment?.trim() || undefined,
                      roundUp: !!roundUp,
                    },
                  },
                });
                toast({ title: "Guardado", description: `1 ${targetUnit} = ${factor} ${selectedProduct.unit}` });
                
                // Modo lote: acumular hasta 100 conversiones antes de exportar
                if (exportAfterSave && exportAfterSave.page === 'drugstores') {
                  try {
                    const { drugstoreId } = exportAfterSave.params || {};
                    const type = exportAfterSave.type;
                    const raw = window.sessionStorage.getItem('phc_conv_batch');
                    let batch = raw ? JSON.parse(raw) : { drugstoreId, type, count: 0 };
                    // Si cambia el destino o tipo, reiniciar batch
                    if (!batch || batch.drugstoreId !== drugstoreId || batch.type !== type) {
                      batch = { drugstoreId, type, count: 0 };
                    }
                    batch.count = Number(batch.count || 0) + 1;
                    window.sessionStorage.setItem('phc_conv_batch', JSON.stringify(batch));
                    toast({ title: 'Conversión agregada', description: `Acumuladas ${batch.count}/100. Puedes seguir agregando o descargar ahora.` });
                    // Disparar automáticamente al llegar a 100
                    if (batch.count >= 100 && drugstoreId) {
                      const exportUrl = `/dashboard/drugstores?autoExport=${type}&params=${encodeURIComponent(JSON.stringify({ drugstoreId }))}`;
                      window.location.href = exportUrl;
                      return;
                    }
                  } catch {}
                  // No limpiar exportAfterSave; el usuario puede seguir acumulando y usar el botón de descarga
                  return;
                }
                
                // Caso normal (sin auto export): limpiar bandera si existía
                dispatch({ type: "CLEAR_EXPORT_AFTER_SAVE" });
              }}
            >
              Guardar conversión para este producto
            </Button>
            {existing && (
              <Button variant="outline" onClick={handleRemove}>Quitar conversión</Button>
            )}
            <Button
              variant="ghost"
              onClick={() => {
                dispatch({ type: "CLEAR_CONVERSIONS" });
                toast({ title: "Conversiónes limpiadas", description: "Se eliminaron todas las conversiones guardadas." });
              }}
            >
              Limpiar todas las conversiones
            </Button>
            {exportAfterSave?.page === 'drugstores' && (
              <Button
                onClick={() => {
                  try {
                    const { drugstoreId } = exportAfterSave.params || {};
                    if (!drugstoreId) return;
                    const type = exportAfterSave.type;
                    const exportUrl = `/dashboard/drugstores?autoExport=${type}&params=${encodeURIComponent(JSON.stringify({ drugstoreId }))}`;
                    window.location.href = exportUrl;
                  } catch {}
                }}
              >
                Descargar ahora
              </Button>
            )}
          </div>

          {existing && (
            <p className="text-sm text-muted-foreground text-center">
              Actual: 1 {existing.targetUnit} = {existing.factor} {existing.sourceUnit}
            </p>
          )}
        </>
      )}
    </div>
  );
}
