"use client";

import { useEffect, useMemo, useState, Suspense } from "react";
import { useAppDispatch, useAppState } from "@/lib/store";
import { baseCanonicalFor, convertQuantity, humanLabelFor } from "@/lib/units";
import { resolveDrugstoreIdByFamily } from "@/lib/drugstores";
import { makeDrugstoreColumns, type DrugstoreRow } from "@/components/drugstore-columns";
import { ProductDataTable } from "@/components/product-data-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download } from "lucide-react";
import defaultMap from "@/lib/drugstores-default.json" assert { type: "json" };
import { useRouter, useSearchParams } from "next/navigation";
function DrugstoresContent() {
  const { products, pharmacies, conversions, drugstores: dsFromStore, familyMap: fmFromStore, productOverrides } = useAppState();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const search = useSearchParams();
  const autoExport = search.get("auto") === "1";
  const [hasAutoExported, setHasAutoExported] = useState(false);
  const [drugstores, setDrugstores] = useState<{ id: string; name: string }[]>([]);
  const [familyMap, setFamilyMap] = useState<{ family: string; drugstoreId: string }[]>([]);
  const [selected, setSelected] = useState<string>("all");
  const [visibleCols, setVisibleCols] = useState<string[]>([]);
  // Estado para controlar la hidratación (ya no usado)
  const [isClient, setIsClient] = useState(true);

  const slugLocal = (s: string) => String(s || "").trim().toLowerCase()
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "");

  const buildStateFromJson = (data: Array<{ LABORATORIO: string; DROGUERIA: string }>) => {
    const dsMap = new Map<string, { id: string; name: string }>();
    for (const row of data) {
      const name = String(row.DROGUERIA || "").trim();
      if (!name) continue;
      const id = slugLocal(name) || "sin-drogueria";
      if (!dsMap.has(id)) dsMap.set(id, { id, name });
    }
    const dsList = Array.from(dsMap.values());
    const fm = data
      .filter((r) => r.LABORATORIO && r.DROGUERIA)
      .map((r) => ({ family: String(r.LABORATORIO).trim(), drugstoreId: slugLocal(String(r.DROGUERIA).trim()) || "sin-drogueria" }));
    const withFallback = [{ id: "sin-drogueria", name: "Sin Droguería" }, ...dsList];
    setDrugstores(withFallback);
    setFamilyMap(fm);
    // Persist to global store so it survives navigation
    dispatch({ type: "SET_DRUGSTORES_DATA", payload: { drugstores: withFallback, familyMap: fm } });
  };

  // Inicializar droguerías y el mapeo
  useEffect(() => {
    // Si no hay droguerías cargadas, usar el mapeo por defecto
    if (drugstores.length === 0) {
      buildStateFromJson(defaultMap);
    }
  }, []);

  const normalize = (s: string) =>
    String(s || "")
      .trim()
      .toUpperCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/\s+/g, " ");

  // Efecto para auto-exportar si es necesario
  useEffect(() => {
    const autoExport = search.get('autoExport');
    const paramsStr = search.get('params');
    let params: any = {};
    if (paramsStr) {
      try {
        params = JSON.parse(decodeURIComponent(paramsStr));
      } catch {}
    }
    if (autoExport && !hasAutoExported && drugstores.length > 0) {
      if (params.drugstoreId) {
        if (autoExport === 'excel') {
          exportExcel(params.drugstoreId, true);
        } else if (autoExport === 'pdf') {
          handleExportPdf(params.drugstoreId, true);
        }
      }
      setHasAutoExported(true);
    }
  }, [search, hasAutoExported, drugstores]);

  const byDrugstore: Record<string, DrugstoreRow[]> = useMemo(() => {
    const toNum = (v: any): number => {
      const n = parseFloat(String(v ?? "").toString().replace(",", "."));
      return Number.isFinite(n) ? n : 0;
    };

    const formatWithSrc = (src: any, value: number): string => {
      const raw = String(src ?? "").trim();
      if (!raw) return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
      const hasComma = raw.includes(",");
      const m = raw.match(/[\.,](\d+)/);
      const decimals = m ? m[1].length : 0;
      const fixed = value.toFixed(decimals);
      if (hasComma) {
        // use comma as decimal, dot as thousands
        const [intPart, decPart] = fixed.split(".");
        const intWithGroup = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        return decPart !== undefined ? `${intWithGroup},${decPart}` : intWithGroup;
      } else {
        // use dot, comma as thousands
        const [intPart, decPart] = fixed.split(".");
        const intWithGroup = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        return decPart !== undefined ? `${intWithGroup}.${decPart}` : intWithGroup;
      }
    };

    const branches = pharmacies.map((p) => p.id);
    const buckets = new Map<string, Map<string, DrugstoreRow>>(); // drugstoreId -> key -> row

    const formatCurrencyWithSrc = (src: any, value: number): string => {
      const raw = String(src ?? '').trim();
      const hasComma = raw.includes(',');
      const m = raw.match(/[\.,](\d+)/);
      const decimals = m ? m[1].length : 2;
      const fixed = value.toFixed(decimals);
      if (hasComma) {
        const [intPart, decPart] = fixed.split('.') as [string, string?];
        const intWithGroup = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return decPart !== undefined ? `${intWithGroup},${decPart}` : intWithGroup;
      } else {
        const [intPart, decPart] = fixed.split('.') as [string, string?];
        const intWithGroup = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        return decPart !== undefined ? `${intWithGroup}.${decPart}` : intWithGroup;
      }
    };

    for (const p of products as any[]) {
      let fam = p.FAMILIA ?? "";
      const code = String(p.CODIGO ?? p.code ?? "").trim();
      const desc = String(p.DESCRIPCION ?? p.name ?? "").trim();
      const convKey = code || desc;
      const ov = productOverrides[convKey];
      if (ov?.laboratory) fam = ov.laboratory; // override de familia/laboratorio
      let drugstoreId = resolveDrugstoreIdByFamily(fam, familyMap, "sin-drogueria");
      // aplicar override de droguería ANTES de acceder a buckets
      if (ov?.drugstoreId) drugstoreId = ov.drugstoreId;
      if (!buckets.has(drugstoreId)) buckets.set(drugstoreId, new Map());

      const unitRaw = String(p.UNI_MED ?? p.UNIDAD ?? p.unit ?? "").trim();
      // aplicar conversión específica por producto si existe (solo para export, en pantalla no)
      const conv = conversions[convKey];
      // En pantalla NO aplicar conversiones guardadas; base según unidad original
      let base = baseCanonicalFor(unitRaw);

      const bag = buckets.get(drugstoreId)!;
      // Precalcular conversiones
      const aPedirRaw = toNum(p.A_PEDIR ?? p.APEDIR);
      let aPedirConv = convertQuantity(aPedirRaw, unitRaw, base);
      const existenciaRaw = toNum(p.EXISTENCIA ?? p.EXISTEN ?? p.STOCK);
      let existenciaConv = convertQuantity(existenciaRaw, unitRaw, base);
      const ventasRaw = toNum(p.VTA_PROMMENSUAL ?? p.VTA_PROM_MENSUAL ?? p["VTA_PROM.MENSUAL"] ?? p.VTA_PROM ?? p.PROM_MENS);
      let ventasConv = convertQuantity(ventasRaw, unitRaw, base);

      // Precio unitario
      const unitPrice = toNum((p as any).VALOR_UNIT ?? (p as any).VALOR_UNITARIO ?? (p as any).PRECIO);

      if (aPedirConv === null && existenciaConv === null && ventasConv === null) {
        // no se puede convertir nada: mantén la unidad original como base
        base = unitRaw as any;
        aPedirConv = aPedirRaw;
        existenciaConv = existenciaRaw;
        ventasConv = ventasRaw;
      }

      const key = `${code}|${desc}|${base}|${fam}`;

      const curr = bag.get(key) ?? ({
        CODIGO: code,
        PRODUCTO: desc,
        FAMILIA: String(fam ?? ""),
        TOTAL: 0,
        UNI_MED: humanLabelFor(base as any),
        VALOR_TOTAL: 0,
      } as DrugstoreRow);

      // Observaciones no se muestran por defecto en pantalla si no se aplica conversión

      // Totales a pedir (suma en todas las sucursales)
      curr.TOTAL += (aPedirConv ?? 0);

      // Métricas por sucursal
      const branch = String(p.pharmacy ?? "");
      if (branch) {
        const existKey = `${branch}_EXISTENCIA`;
        const vtasKey = `${branch}_VENTAS`;
        const pedirKey = `${branch}_APEDIR`;
        const newExist = toNum(curr[existKey] ?? 0) + (existenciaConv ?? 0);
        const newVtas = toNum(curr[vtasKey] ?? 0) + (ventasConv ?? 0);
        const newPedir = toNum(curr[pedirKey] ?? 0) + (aPedirConv ?? 0);
        curr[existKey] = newExist;
        curr[vtasKey] = newVtas;
        curr[pedirKey] = newPedir;

        // Valor total acumulado por producto (sumar el incremento de esta fila sucursal)
        if (Number.isFinite(unitPrice) && aPedirConv != null) {
          (curr as any).VALOR_TOTAL = toNum((curr as any).VALOR_TOTAL ?? 0) + (aPedirConv ?? 0) * unitPrice;
        }

        // Guardar formato original basado en __SRC
        const pedirFmtKey = `${branch}_APEDIR_FMT`;
        const existFmtKey = `${branch}_EXISTENCIA_FMT`;
        const vtasFmtKey = `${branch}_VENTAS_FMT`;
        const pedirSrc = (p as any).A_PEDIR__SRC ?? (p as any).APEDIR__SRC;
        const existSrc = (p as any).EXISTENCIA__SRC ?? (p as any).EXISTEN__SRC ?? (p as any).STOCK__SRC;
        const vtasSrc = (p as any).VTA_PROMMENSUAL__SRC ?? (p as any).VTA_PROM_MENSUAL__SRC ?? (p as any)["VTA_PROM.MENSUAL__SRC"] ?? (p as any).VTA_PROM__SRC ?? (p as any).PROM_MENS__SRC;
        if (aPedirConv != null) (curr as any)[pedirFmtKey] = formatWithSrc(pedirSrc, aPedirConv);
        if (existenciaConv != null) (curr as any)[existFmtKey] = formatWithSrc(existSrc, existenciaConv);
        if (ventasConv != null) (curr as any)[vtasFmtKey] = formatWithSrc(vtasSrc, ventasConv);
        // Acumular la máxima cantidad de decimales observada para TOTAL a partir de la fuente A_PEDIR
        const rawSrc = String(pedirSrc ?? '').trim();
        const mDec = rawSrc.match(/[\.,](\d+)/);
        const decs = mDec ? mDec[1].length : 0;
        (curr as any).__totalDecs = Math.max(Number((curr as any).__totalDecs ?? 0), decs);
      }

      bag.set(key, curr);
    }

    // Convertir mapas a arrays (no ocultar TOTAL 0 para evitar exportes en blanco)
    const result: Record<string, DrugstoreRow[]> = {};
    for (const [drugstoreId, bag] of buckets) {
      const rows = Array.from(bag.values()).map((r) => {
        // Formato de TOTAL respetando la máxima cantidad de decimales observada entre sucursales
        const decs = Number((r as any).__totalDecs ?? 0);
        if (Number.isFinite(decs) && decs > 0) {
          const sample = `0.${'0'.repeat(decs)}`;
          (r as any).TOTAL_FMT = formatWithSrc(sample, Number((r as any).TOTAL ?? 0));
        } else {
          (r as any).TOTAL_FMT = undefined;
        }
        // Formato de VALOR_TOTAL basado en fuente de precio si existe
        const samplePriceSrc = (products.find((p:any)=> String(p.CODIGO ?? p.code ?? '').trim()===(r as any).CODIGO)?.VALOR_UNIT__SRC) ?? '';
        if ((r as any).VALOR_TOTAL != null) (r as any).VALOR_TOTAL_FMT = formatCurrencyWithSrc(samplePriceSrc, Number((r as any).VALOR_TOTAL));
        return r;
      });
      result[drugstoreId] = rows;
    }
    return result;
  }, [products, pharmacies, familyMap, conversions]);

  const exportExcel = async (drugstoreId: string, skipPrompt = false) => {
    if (!skipPrompt) {
      // Preguntar si desea realizar una conversión antes de descargar
      const realizarConversion = window.confirm("¿Deseas realizar conversiones antes de descargar?");
      
      if (realizarConversion) {
        // Obtener productos específicos de esta droguería
        const drugstoreProducts = byDrugstore[drugstoreId] ?? [];
        const productCodes = drugstoreProducts.map(p => p.CODIGO || p.PRODUCTO).filter(Boolean);
        
        dispatch({ type: "SET_EXPORT_AFTER_SAVE", payload: { 
          page: 'drugstores', 
          type: 'excel', 
          params: { drugstoreId },
          filteredProducts: productCodes // Solo productos de esta droguería
        } });
        dispatch({ type: "UNLOCK_CONVERSION" });
        router.push("/dashboard/conversion");
        return;
      }
    }
    
    const XLSX = await import("xlsx");
    const ds = drugstores.find((d) => d.id === drugstoreId);
    const rows = byDrugstore[drugstoreId] ?? [];
    const branchDefs = pharmacies.map((p) => ({ id: p.id, name: p.name }));

    // Confirmación: aplicar conversiones solo en el archivo, con conteo y preferencia de sesión
    let applyConv = false;
    if (skipPrompt) {
      applyConv = true;
    } else {
      if (typeof window !== 'undefined') {
        try {
          const stored = window.sessionStorage.getItem('phc_applyConvExport');
          if (stored === 'yes') applyConv = true;
          if (stored === 'no') applyConv = false;
          if (stored !== 'yes' && stored !== 'no') {
            const convCount = rows.filter(r => !!conversions[r.CODIGO || r.PRODUCTO]).length;
            const msg = `¿Aplicar conversiones guardadas al archivo Excel? (${convCount} producto(s) con conversión)`;
            applyConv = window.confirm(msg);
            window.sessionStorage.setItem('phc_applyConvExport', applyConv ? 'yes' : 'no');
          }
        } catch {
          const convCount = rows.filter(r => !!conversions[r.CODIGO || r.PRODUCTO]).length;
          const msg = `¿Aplicar conversiones guardadas al archivo Excel? (${convCount} producto(s) con conversión)`;
          applyConv = window.confirm(msg);
        }
      }
    }

    const labelFor = (id: string) => {
      if (id === 'CODIGO') return 'CODIGO';
      if (id === 'PRODUCTO') return 'Producto';
      if (id === 'FAMILIA') return 'Familia';
      if (id === 'TOTAL') return 'Total';
      if (id === 'UNI_MED') return 'Unidades de Medid';
      if (id === 'VALOR_TOTAL') return 'Valor Total';
      if (id === 'OBSERVACIONES') return 'Observaciones';
      const b = pharmacies.find(p => `${p.id}_APEDIR` === id || `${p.id}_EXISTENCIA` === id || `${p.id}_VENTAS` === id);
      if (b) {
        if (id.endsWith('_APEDIR')) return `${b.name} A Pedir`;
        if (id.endsWith('_EXISTENCIA')) return `${b.name} Existencia`;
        if (id.endsWith('_VENTAS')) return `${b.name} Ventas`;
      }
      return id;
    };
    const defaultCols = [
      'CODIGO','PRODUCTO','FAMILIA','TOTAL',
      ...branchDefs.flatMap(b => [`${b.id}_APEDIR`, `${b.id}_EXISTENCIA`, `${b.id}_VENTAS`]),
      'UNI_MED','VALOR_TOTAL','OBSERVACIONES'
    ];
    const cols = visibleCols.length > 0 ? visibleCols : defaultCols;
    const header = cols.map(labelFor);

    const body = rows.map((r) => {
      const convKey = r.CODIGO || r.PRODUCTO;
      const conv = applyConv ? conversions[convKey] : undefined;
      const factor = conv ? Number(conv.factor) || 1 : 1;
      return cols.map((id) => {
        if (id === 'CODIGO') return (r as any).CODIGO;
        if (id === 'PRODUCTO') return (r as any).PRODUCTO;
        if (id === 'FAMILIA') return (r as any).FAMILIA;
        if (id === 'TOTAL') {
          if (!conv) return (r as any).TOTAL;
          const raw = Number((r as any).TOTAL);
          let val = raw / factor;
          if ((conv as any).roundUp) val = Math.ceil(val);
          return val;
        }
        if (id === 'UNI_MED') return conv ? (conversions[convKey]?.targetUnit ?? (r as any).UNI_MED) : (r as any).UNI_MED;
        if (id === 'VALOR_TOTAL') return Number((r as any).VALOR_TOTAL ?? 0);
        if (id === 'OBSERVACIONES') return (r as any).OBSERVACIONES ?? '';
        // branch metrics
        const v = Number((r as any)[id] ?? 0);
        if (!conv) return v;
        let val = v / factor;
        if ((conv as any).roundUp) val = Math.ceil(val);
        return val;
      });
    });

    const aoa = [header, ...body];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    // Formato hasta 4 decimales para numéricos
    const firstNumericCol = 3; // Total
    const lastNumericCol = 3 + branchDefs.length * 3; // incluye Valor Total
    for (let r = 1; r < aoa.length; r++) {
      for (let c = firstNumericCol; c <= lastNumericCol; c++) {
        const ref = XLSX.utils.encode_cell({ r, c });
        const cell = (ws as any)[ref];
        if (cell && typeof cell.v === "number") cell.z = "0.####"; // Máximo 4 decimales
      }
    }

    const wb = XLSX.utils.book_new();
    const sheetName = ds ? ds.name.slice(0, 31) : "Drogueria";
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Pedidos_${sheetName}_${dateStr}.xlsx`);

    // Limpiar conversiones después de descargar
    dispatch({ type: "CLEAR_CONVERSIONS" });
  };

  const handleExportPdf = (drugstoreId: string, skipPrompt = false) => {
    const ds = drugstores.find((d) => d.id === drugstoreId);
    const rows = byDrugstore[drugstoreId] ?? [];
    const branchDefs = pharmacies.map((p) => ({ id: p.id, name: p.name }));

    // Confirmación: aplicar conversiones con preferencia de sesión (igual que Excel)
    let applyConv = false;
    if (skipPrompt) {
      applyConv = true;
    } else {
      try {
        const stored = window.sessionStorage.getItem('phc_applyConvExport');
        if (stored === 'yes') applyConv = true;
        if (stored === 'no') applyConv = false;
        if (stored !== 'yes' && stored !== 'no') {
          const convCount = rows.filter(r => !!conversions[r.CODIGO || r.PRODUCTO]).length;
          const msg = `¿Aplicar conversiones guardadas al PDF? (${convCount} producto(s) con conversión)`;
          applyConv = window.confirm(msg);
          window.sessionStorage.setItem('phc_applyConvExport', applyConv ? 'yes' : 'no');
        }
      } catch {}
    }

    const w = window.open('', '_blank');
    if (!w) return;
    const title = `Farmacia Jerusalen — ${ds?.name ?? drugstoreId}`;
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
      if (id === 'CODIGO') return 'CODIGO';
      if (id === 'PRODUCTO') return 'Producto';
      if (id === 'FAMILIA') return 'Familia';
      if (id === 'TOTAL') return 'Total';
      if (id === 'UNI_MED') return 'Unidades de Medid';
      if (id === 'VALOR_TOTAL') return 'Valor Total';
      if (id === 'OBSERVACIONES') return 'Observaciones';
      const b = pharmacies.find(p => `${p.id}_APEDIR` === id || `${p.id}_EXISTENCIA` === id || `${p.id}_VENTAS` === id);
      if (b) {
        if (id.endsWith('_APEDIR')) return `${b.name} A Pedir`;
        if (id.endsWith('_EXISTENCIA')) return `${b.name} Existencia`;
        if (id.endsWith('_VENTAS')) return `${b.name} Ventas`;
      }
      return id;
    };
    const defaultCols = [
      'CODIGO','PRODUCTO','FAMILIA','TOTAL',
      ...branchDefs.flatMap(b => [`${b.id}_APEDIR`, `${b.id}_EXISTENCIA`, `${b.id}_VENTAS`]),
      'UNI_MED','VALOR_TOTAL','OBSERVACIONES'
    ];
    const cols = visibleCols.length > 0 ? visibleCols : defaultCols;
    const headCols = cols.map(labelFor);
    const bodyRows = rows.map(r => {
      const convKey = r.CODIGO || r.PRODUCTO;
      const conv = applyConv ? conversions[convKey] : undefined;
      const factor = conv ? Number(conv.factor) || 1 : 1;
      return cols.map((id) => {
        if (id === 'CODIGO') return (r as any).CODIGO;
        if (id === 'PRODUCTO') return (r as any).PRODUCTO;
        if (id === 'FAMILIA') return (r as any).FAMILIA;
        if (id === 'TOTAL') {
          const val = conv ? (Number((r as any).TOTAL) / factor) : (r as any).TOTAL;
          const rounded = conv && (conv as any).roundUp ? Math.ceil(Number(val)) : val;
          const fmt = (r as any).TOTAL_FMT;
          return fmt ?? (typeof rounded === 'number' ? Number(rounded).toLocaleString(undefined, { maximumFractionDigits: 4 }) : rounded);
        }
        if (id === 'UNI_MED') return conv ? (conversions[convKey]?.targetUnit ?? (r as any).UNI_MED) : (r as any).UNI_MED;
        if (id === 'VALOR_TOTAL') {
          const vt = (r as any).VALOR_TOTAL;
          const fmt = (r as any).VALOR_TOTAL_FMT;
          return fmt ?? (typeof vt === 'number' ? vt.toLocaleString(undefined, { maximumFractionDigits: 4 }) : vt ?? '');
        }
        if (id === 'OBSERVACIONES') return conv ? (conversions[convKey]?.comment ?? (r as any).OBSERVACIONES ?? '') : ((r as any).OBSERVACIONES ?? '');
        const raw = Number((r as any)[id] ?? 0);
        if (conv) {
          let val = raw / factor;
          if ((conv as any).roundUp) val = Math.ceil(val);
          return val.toLocaleString(undefined, { maximumFractionDigits: 4 });
        }
        const fmt = (r as any)[`${id}_FMT`];
        return fmt ?? raw.toLocaleString(undefined, { maximumFractionDigits: 4 });
      });
    });
    w.document.write(`<html><head><title>${title}</title>${style}</head><body>`);
    w.document.write(`<h1>${title}</h1>`);
    w.document.write('<table><thead><tr>' + headCols.map(c=>`<th>${c}</th>`).join('') + '</tr></thead><tbody>');
    for (const row of bodyRows) {
      w.document.write('<tr>' + row.map((c,i)=>`<td class="${i>2?'right':''}">${c}</td>`).join('') + '</tr>');
    }
    w.document.write('</tbody></table></body></html>');
    w.document.close();
    w.focus();
    w.print();

    // Descarga automática de PDF usando html2pdf.js en un contenedor oculto
    try {
      const stylePdf = `
        <style>
          body { font-family: Arial, sans-serif; padding: 24px; }
          h1 { font-size: 18px; margin-bottom: 8px; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #ddd; padding: 6px; font-size: 12px; }
          th { background: #f0f0f0; text-align: left; }
          .right { text-align: right; }
        </style>`;
      const holder = document.createElement('div');
      holder.style.position = 'fixed';
      holder.style.left = '-99999px';
      holder.style.top = '0';
      const headColsHtml = headCols.map(c=>`<th>${c}</th>`).join('');
      const bodyRowsHtml = bodyRows.map(row=>'<tr>' + row.map((c,i)=>`<td class="${i>2?'right':''}">${c}</td>`).join('') + '</tr>').join('');
      holder.innerHTML = `${stylePdf}<div id="pdf-drugstore-root"><h1>${title}</h1><table><thead><tr>${headColsHtml}</tr></thead><tbody>${bodyRowsHtml}</tbody></table></div>`;
      document.body.appendChild(holder);
      const dateStr = new Date().toISOString().slice(0,10);
      const fileName = `Pedidos_${ds?.name ?? drugstoreId}_${dateStr}.pdf`;
      const doDownload = () => {
        const anyWin = window as any;
        const node = document.getElementById('pdf-drugstore-root');
        if (anyWin.html2pdf && node) {
          anyWin.html2pdf().from(node).set({
            filename: fileName,
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait' },
          }).save().finally(() => holder.remove());
        } else {
          holder.remove();
        }
      };
      if (!(window as any).html2pdf) {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
        s.onload = doDownload;
        s.onerror = () => holder.remove();
        document.body.appendChild(s);
      } else {
        doDownload();
      }
    } catch {}

    // Limpiar conversiones después de descargar
    dispatch({ type: "CLEAR_CONVERSIONS" });
  };

  const branchesForColumns = pharmacies.map((p) => ({ id: p.id, name: p.name }));

  return (
    <div className="space-y-8">
      
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-bold tracking-tight font-headline">Pedidos por Droguería</h1>
          <p className="text-muted-foreground">Filtrado por mapeo Familia → Droguería (mostrar "Sin Droguería" si no hay mapeo).</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Todas las droguerías" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {drugstores.map((d) => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selected !== "all" && (
            <Button variant="secondary" onClick={() => exportExcel(selected, false)}>
              <Download className="mr-2 h-4 w-4" /> Exportar {drugstores.find((d) => d.id === selected)?.name}
            </Button>
          )}
          <Button
            onClick={() => {
              const data = defaultMap as Array<{ LABORATORIO: string; DROGUERIA: string }>;
              buildStateFromJson(data);
            }}
          >
            Clasificar
          </Button>
        </div>
      </div>

      {drugstores.length <= 1 && (
        <div className="text-sm text-muted-foreground">Pulsa "Clasificar" para agrupar por Droguería usando el JSON local.</div>
      )}

      {(selected === "all" ? drugstores.map((d) => d.id) : [selected]).map((dsId) => {
        const ds = drugstores.find((d) => d.id === dsId);
        const rows = byDrugstore[dsId] ?? [];
        if (rows.length === 0) return null;
        return (
          <Card key={dsId}>
            <CardHeader>
              <CardTitle>{ds?.name ?? dsId}</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
                <ProductDataTable
                  columns={makeDrugstoreColumns(branchesForColumns)}
                  data={rows as any}
                  filterColumnId="PRODUCTO"
                  instanceKey={`drugstore-${dsId}-${branchesForColumns.map(b=>b.id).join(',')}`}
                  onVisibleColumnsChange={setVisibleCols}
                />
              <div className="mt-4 flex gap-2">
                <Button size="sm" onClick={() => exportExcel(dsId, false)}>
                  <Download className="mr-2 h-4 w-4" /> Exportar {ds?.name ?? dsId}
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => {
                    const realizarConversion = window.confirm("¿Deseas realizar conversiones antes de descargar?");
                    if (realizarConversion) {
                      // Obtener productos específicos de esta droguería
                      const drugstoreProducts = byDrugstore[dsId] ?? [];
                      const productCodes = drugstoreProducts.map(p => p.CODIGO || p.PRODUCTO).filter(Boolean);
                      
                      dispatch({ type: "SET_EXPORT_AFTER_SAVE", payload: { 
                        page: 'drugstores', 
                        type: 'pdf', 
                        params: { drugstoreId: dsId },
                        filteredProducts: productCodes // Solo productos de esta droguería
                      } });
                      dispatch({ type: "UNLOCK_CONVERSION" });
                      router.push("/dashboard/conversion");
                      return;
                    }
                    handleExportPdf(dsId, false);
                  }}
                >
                  Exportar PDF
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}

      {Object.values(byDrugstore).every((arr) => (arr?.length ?? 0) === 0) && (
        <div className="text-center text-muted-foreground py-12">No hay filas para mostrar. Verifica el mapeo de familias a droguerías.</div>
      )}
    </div>
  );
}

export default function DrugstoresPage() {
  return (
    <Suspense fallback={null}>
      <DrugstoresContent />
    </Suspense>
  );
}
