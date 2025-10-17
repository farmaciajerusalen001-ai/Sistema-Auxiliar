
"use client";

import { useAppState, useAppDispatch } from "@/lib/store";
import { baseCanonicalFor, convertQuantity, humanLabelFor } from "@/lib/units";
import { ProductDataTable } from "@/components/product-data-table";
import { columns } from "@/components/columns";
import { makeConsolidatedColumns, type ConsolidatedRow } from "@/components/consolidated-columns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { useEffect, useMemo, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function ConsolidatedContent() {
  const { products, pharmacies, conversions } = useAppState();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const search = useSearchParams();
  const [isClient, setIsClient] = useState(false);
  const [hasAutoExported, setHasAutoExported] = useState(false);
  const [visibleCols, setVisibleCols] = useState<string[]>([]);

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    const autoExport = search.get('autoExport');
    if (autoExport && !hasAutoExported) {
      if (autoExport === 'excel') {
        handleGenerateConsolidated(true);
      } else if (autoExport === 'pdf') {
        handleGenerateConsolidatedPdf(true);
      }
      setHasAutoExported(true);
    }
  }, [search, hasAutoExported]);

  const consolidatedRows: ConsolidatedRow[] = useMemo(() => {
    const toNum = (v: any): number => {
      const n = parseFloat(String(v ?? '').toString().replace(',', '.'));
      return Number.isFinite(n) ? n : 0;
    };
    // Helper para preservar decimales tal cual Excel
    const formatWithSrc = (src: any, value: number): string => {
      const raw = String(src ?? '').trim();
      const m = raw.match(/[\.,](\d+)/);
      const decimals = m ? m[1].length : 0;
      const fixed = value.toFixed(decimals);
      const [intPart, decPart] = fixed.split('.') as [string, string?];
      // Formato: miles con coma, decimales con punto
      const intWithGroup = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return decPart !== undefined ? `${intWithGroup}.${decPart}` : intWithGroup;
    };

    const branchIds = pharmacies.map((p) => p.id);
    type Row = ConsolidatedRow;
    const map = new Map<string, Row>();

    for (const p of products as any[]) {
      const code = String(p.CODIGO ?? p.code ?? '').trim();
      const desc = String(p.DESCRIPCION ?? p.name ?? '').trim();
      const unitRaw = String(p.UNI_MED ?? p.UNIDAD ?? p.unit ?? '').trim();
      const fam = String(p.FAMILIA ?? '').trim();
      if (!code && !desc) continue;

      // En pantalla NO aplicar conversiones guardadas; base y cantidades según unidad original
      const convKey = code || desc; // solo para exportación
      const conv = conversions[convKey];
      let base = baseCanonicalFor(unitRaw);
      let aPedirRaw = toNum(p.A_PEDIR ?? p.APEDIR);
      let aPedirConv = convertQuantity(aPedirRaw, unitRaw, base);
      const unitPrice = toNum((p as any).VALOR_UNIT ?? (p as any).VALOR_UNITARIO ?? (p as any).PRECIO);
      if (aPedirConv === null) {
        // si no se puede convertir, mantén la unidad original como clave
        base = unitRaw as any;
        aPedirConv = aPedirRaw;
      }

      const key = `${code}|${desc}|${base}`;

      const curr: Row = map.get(key) ?? {
        CODIGO: code,
        Producto: desc,
        Familia: fam,
        TotalAPedir: 0,
        UNI_MED: humanLabelFor(base as any),
        ValorTotal: 0,
      } as any;

      // Aumentar por sucursal en unidad base
      const branch = String(p.pharmacy ?? '').trim();
      if (branch) {
        const currBranch = toNum(curr[branch] ?? 0);
        const newVal = currBranch + (aPedirConv ?? 0);
        curr[branch] = newVal;
        const pedirSrc = (p as any).A_PEDIR__SRC ?? (p as any).APEDIR__SRC;
        if (aPedirConv != null) (curr as any)[`${branch}_FMT`] = formatWithSrc(pedirSrc, newVal);
        // Acumular la máxima cantidad de decimales observada entre sucursales
        const rawSrc = String(pedirSrc ?? '').trim();
        const mDec = rawSrc.match(/[\.,](\d+)/);
        const decs = mDec ? mDec[1].length : 0;
        (curr as any).__totalDecs = Math.max(Number((curr as any).__totalDecs ?? 0), decs);
      }
      curr.TotalAPedir += (aPedirConv ?? 0);
      // acumular valor total (cantidad * precio unitario por fila)
      if (aPedirConv != null && Number.isFinite(unitPrice)) {
        (curr as any).ValorTotal = Number((curr as any).ValorTotal ?? 0) + aPedirConv * unitPrice;
      }

      map.set(key, curr);
    }

    // Asegurar que todas las columnas por sucursal existan, aunque sean 0
    const arr = Array.from(map.values()).map((r) => {
      for (const id of branchIds) {
        if (r[id] === undefined) r[id] = 0;
      }
      // TotalAPedir_FMT: respetar la máxima cantidad de decimales observada entre sucursales
      const decs = Number((r as any).__totalDecs ?? 0);
      if (Number.isFinite(decs) && decs > 0) {
        const sample = `0.${'0'.repeat(decs)}`;
        (r as any).TotalAPedir_FMT = formatWithSrc(sample, r.TotalAPedir);
      } else {
        (r as any).TotalAPedir_FMT = undefined; // usar número puro
      }
      return r;
    }).filter((r) => {
      // mostrar solo si hay algo a pedir en total (>0)
      return (r.TotalAPedir ?? 0) > 0;
    });

    return arr;
  }, [products, pharmacies, conversions]);

  const handleGenerateConsolidated = async (skipPrompt = false) => {
    if (consolidatedRows.length === 0) return;
    
    if (!skipPrompt) {
      // Preguntar si desea realizar una conversión antes de descargar
      const realizarConversion = window.confirm("¿Desea realizar una conversión antes de descargar?");
      
      if (realizarConversion) {
        dispatch({ type: "SET_EXPORT_AFTER_SAVE", payload: { page: 'consolidated', type: 'excel' } });
        dispatch({ type: "UNLOCK_CONVERSION" });
        router.push("/dashboard/conversion");
        return;
      }
    }
    
    // Si elige no realizar conversión, continuar con la descarga del Excel
    const XLSX = await import("xlsx");
    const branchDefs = pharmacies.map((p) => ({ id: p.id, name: p.name }));
    const rows = consolidatedRows.filter(r => Number(r.TotalAPedir ?? 0) > 0);

    // Confirmación: aplicar conversiones solo en el archivo (con conteo y preferencia de sesión)
    let applyConv = false;
    if (typeof window !== 'undefined') {
      try {
        const stored = window.sessionStorage.getItem('phc_applyConvExport');
        if (stored === 'yes') applyConv = true;
        if (stored === 'no') applyConv = false;
        if (stored !== 'yes' && stored !== 'no') {
          const convCount = consolidatedRows.filter(r => !!conversions[r.CODIGO || r.Producto]).length;
          const msg = `¿Aplicar conversiones guardadas al archivo Excel? (${convCount} producto(s) con conversión)`;
          applyConv = window.confirm(msg);
          window.sessionStorage.setItem('phc_applyConvExport', applyConv ? 'yes' : 'no');
        }
      } catch {
        const convCount = consolidatedRows.filter(r => !!conversions[r.CODIGO || r.Producto]).length;
        const msg = `¿Aplicar conversiones guardadas al archivo Excel? (${convCount} producto(s) con conversión)`;
        applyConv = window.confirm(msg);
      }
    }

    // Build header/body based on selected visible columns order
    const labelFor = (id: string) => {
      if (id === 'TotalAPedir') return 'Total a pedir';
      if (id === 'UNI_MED') return 'Unidades de Medid';
      if (id === 'ValorTotal') return 'Valor Total';
      const ph = pharmacies.find(p => p.id === id);
      if (ph) return ph.name; // branch column
      return id;
    };
    const cols = visibleCols.length > 0 ? visibleCols : [
      'CODIGO','Producto','Familia','TotalAPedir',...pharmacies.map(p=>p.id),'UNI_MED','ValorTotal'
    ];
    const header = cols.map(labelFor);

    const body = rows.map((r) => {
      const convKey = r.CODIGO || r.Producto;
      const conv = applyConv ? conversions[convKey] : undefined;
      const factor = conv ? Number(conv.factor) || 1 : 1;
      return cols.map((id) => {
        if (id === 'CODIGO') return (r as any).CODIGO;
        if (id === 'Producto') return (r as any).Producto;
        if (id === 'Familia') return (r as any).Familia;
        if (id === 'TotalAPedir') return conv ? (Number(r.TotalAPedir) / factor) : r.TotalAPedir;
        if (id === 'UNI_MED') return conv ? (conversions[convKey]?.targetUnit ?? r.UNI_MED) : r.UNI_MED;
        if (id === 'ValorTotal') return Number((r as any).ValorTotal ?? 0);
        // branch id
        const val = Number((r as any)[id] ?? 0);
        return conv ? val / factor : val;
      });
    });

    const aoa = [header, ...body];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    // Aplicar formato numérico con hasta 4 decimales a columnas numéricas (Total, por sucursal y Valor Total)
    const firstNumericCol = 3; // index de "Total a pedir"
    const lastNumericCol = 3 + branchDefs.length + 1; // incluye todas las sucursales + Valor Total
    for (let r = 1; r < aoa.length; r++) { // desde la fila de datos (salta encabezado)
      for (let c = firstNumericCol; c <= lastNumericCol; c++) {
        const ref = XLSX.utils.encode_cell({ r, c });
        const cell = (ws as any)[ref];
        if (cell && typeof cell.v === 'number') {
          cell.z = "0.####"; // hasta 4 decimales, sin forzar decimales innecesarios
        }
      }
    }
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Consolidado");
    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Consolidado_${dateStr}.xlsx`);
  };

  // Exportar PDF con confirmación de conversiones
  const handleGenerateConsolidatedPdf = (skipPrompt = false) => {
    if (consolidatedRows.length === 0) return;

    if (!skipPrompt) {
      // Preguntar si desea realizar una conversión antes de descargar
      const realizarConversion = window.confirm("¿Desea realizar una conversión antes de descargar?");
      
      if (realizarConversion) {
        dispatch({ type: "SET_EXPORT_AFTER_SAVE", payload: { page: 'consolidated', type: 'pdf' } });
        dispatch({ type: "UNLOCK_CONVERSION" });
        router.push("/dashboard/conversion");
        return;
      }
    }

    const branchDefs = pharmacies.map((p) => ({ id: p.id, name: p.name }));
    let applyConv = false;
    if (skipPrompt) {
      applyConv = true;
    } else {
      try {
        const stored = window.sessionStorage.getItem('phc_applyConvExport');
        if (stored === 'yes') applyConv = true;
        if (stored === 'no') applyConv = false;
        if (stored !== 'yes' && stored !== 'no') {
          const convCount = consolidatedRows.filter(r => !!conversions[r.CODIGO || r.Producto]).length;
          const msg = `¿Aplicar conversiones guardadas al PDF? (${convCount} producto(s) con conversión)`;
          applyConv = window.confirm(msg);
          window.sessionStorage.setItem('phc_applyConvExport', applyConv ? 'yes' : 'no');
        }
      } catch {}
    }

    const title = `Farmacia Jerusalen — Consolidado`;
    const style = `
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; }
        h1 { font-size: 18px; margin-bottom: 8px; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 6px; font-size: 12px; }
        th { background: #f0f0f0; text-align: left; }
        .right { text-align: right; }
      </style>`;
    const labelFor = (id: string) => {
      if (id === 'TotalAPedir') return 'Total a pedir';
      if (id === 'UNI_MED') return 'Unidades de Medid';
      if (id === 'ValorTotal') return 'Valor Total';
      const ph = pharmacies.find(p => p.id === id);
      if (ph) return ph.name;
      return id;
    };
    const cols = visibleCols.length > 0 ? visibleCols : [
      'CODIGO','Producto','Familia','TotalAPedir',...pharmacies.map(p=>p.id),'UNI_MED','ValorTotal'
    ];
    const head = cols.map(labelFor);
    const rows = consolidatedRows.filter(r => Number(r.TotalAPedir ?? 0) > 0);
    const body = rows.map((r) => {
      const convKey = r.CODIGO || r.Producto;
      const conv = applyConv ? conversions[convKey] : undefined;
      const factor = conv ? Number(conv.factor) || 1 : 1;
      return cols.map((id, idx) => {
        if (id === 'CODIGO') return (r as any).CODIGO;
        if (id === 'Producto') return (r as any).Producto;
        if (id === 'Familia') return (r as any).Familia;
        if (id === 'TotalAPedir') {
          const total = conv ? (Number(r.TotalAPedir) / factor) : r.TotalAPedir;
          const totalStr = (r as any).TotalAPedir_FMT ?? total;
          return typeof totalStr === 'number' ? totalStr.toFixed(4).replace(/\.0+$/,'').replace(/\.$/,'') : totalStr;
        }
        if (id === 'UNI_MED') return conv ? (conversions[convKey]?.targetUnit ?? r.UNI_MED) : r.UNI_MED;
        if (id === 'ValorTotal') return Number((r as any).ValorTotal ?? 0).toFixed(4).replace(/\.0+$/,'').replace(/\.$/,'');
        // branch id
        const raw = Number((r as any)[id] ?? 0);
        if (conv) return (raw / factor).toFixed(4).replace(/\.0+$/,'').replace(/\.$/,'');
        return (r as any)[`${id}_FMT`] ?? raw.toLocaleString(undefined, { maximumFractionDigits: 4 });
      });
    });
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<html><head><title>${title}</title>${style}</head><body>`);
    w.document.write(`<h1>${title}</h1>`);
    w.document.write('<table><thead><tr>' + head.map(c=>`<th>${c}</th>`).join('') + '</tr></thead><tbody>');
    for (const row of body) {
      w.document.write('<tr>' + row.map((c,i)=>`<td class="${i>2?'right':''}">${c}</td>`).join('') + '</tr>');
    }
    w.document.write('</tbody></table></body></html>');
    w.document.close();
    w.focus();
    w.print();
  };
  if (!isClient) {
    // Render a placeholder or null on the server to avoid hydration mismatch
    return null;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-bold tracking-tight font-headline">
            Consolidado de Productos
          </h1>
          <p className="text-muted-foreground">
            Un resumen de todos los productos importados, agrupados por sucursal.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 md:flex-nowrap md:flex-row">
          <Button onClick={() => router.push("/dashboard/drugstores?auto=1")}>
            Clasificar por Droguería
          </Button>
          <Button onClick={() => handleGenerateConsolidated(false)} disabled={consolidatedRows.length === 0}>
            <Sparkles className="mr-2 h-4 w-4" />
            Generar Consolidado (Excel)
          </Button>
          <Button variant="secondary" onClick={() => handleGenerateConsolidatedPdf(false)} disabled={consolidatedRows.length === 0}>
            Exportar PDF
          </Button>
        </div>
      </div>

      {consolidatedRows.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Consolidado General</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <ProductDataTable
              columns={makeConsolidatedColumns(pharmacies)}
              data={consolidatedRows as any}
              filterColumnId="Producto"
              filterPlaceholder="Filtrar por producto..."
              instanceKey={`consolidated-${pharmacies.map(p=>p.id).join(',')}`}
              onVisibleColumnsChange={setVisibleCols}
            />
          </CardContent>
        </Card>
      )}
      
      {pharmacies.length === 0 && products.length > 0 && (
         <Card>
            <CardHeader>
                <CardTitle>Todos los Productos Importados</CardTitle>
            </CardHeader>
            <CardContent>
                <ProductDataTable columns={columns} data={products} />
            </CardContent>
         </Card>
      )}

      {pharmacies.map((pharmacy) => {
        const pharmacyProducts = products.filter(
          (p) => p.pharmacy === pharmacy.id
        );
        if (pharmacyProducts.length === 0) return null;
        return (
          <Card key={pharmacy.id}>
            <CardHeader>
              <CardTitle>{pharmacy.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <ProductDataTable columns={columns} data={pharmacyProducts} />
            </CardContent>
          </Card>
        );
      })}

      {products.length === 0 && (
        <div className="text-center text-muted-foreground py-12">
            No hay productos importados para mostrar.
        </div>
      )}
    </div>
  );
}

export default function ConsolidatedPage() {
  return (
    <Suspense fallback={null}>
      <ConsolidatedContent />
    </Suspense>
  );
}
