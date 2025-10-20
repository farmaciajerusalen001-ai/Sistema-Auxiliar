"use client";

import { useMemo, useState } from "react";
import { useAppDispatch, useAppState } from "@/lib/store";
import { resolveDrugstoreIdByFamily } from "@/lib/drugstores";
import { baseCanonicalFor, convertQuantity } from "@/lib/units";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// A simple greedy redistribution plan builder within a drugstore scope
function buildPlan(params: {
  rows: any[];
  pharmacies: { id: string; name: string }[];
  bufferByBranch: Record<string, number>;
}) {
  const { rows, pharmacies, bufferByBranch } = params;
  type Move = {
    CODIGO: string;
    Producto: string;
    Drogueria: string;
    From: string;
    FromId: string;
    To: string;
    ToId: string;
    Cantidad: number;
    UNI_MED: string;
    Stocks: Record<string, number>;
    NeedDestino: number;
    LocalCubierto: number;
    DeficitAntes: number;
    DeficitDespues: number;
    Key: string;
  };
  const plan: Move[] = [];

  // Group by (drugstore, product key)
  const byKey = new Map<string, { info: any; perBranch: Record<string, { need: number; stock: number }> }>();

  for (const r of rows) {
    const drug = r.__drugstoreId as string;
    const key = `${drug}|${r.CODIGO}|${r.Producto}|${r.UNI_MED}`;
    if (!byKey.has(key)) byKey.set(key, { info: r, perBranch: {} });
    const g = byKey.get(key)!;
    for (const ph of pharmacies) {
      const need = Number(r[`${ph.id}_APEDIR`] ?? 0);
      const stock = Number(r[`${ph.id}_EXISTENCIA`] ?? 0);
      const buffer = Number(bufferByBranch[ph.id] ?? 0);
      g.perBranch[ph.id] = { need, stock: Math.max(0, stock - buffer) };
    }
  }

  for (const [, group] of byKey) {
    const info = group.info;
    
    // PRIMERO: cada sucursal cubre su propia demanda con su propio stock
    for (const [id, data] of Object.entries(group.perBranch)) {
      const { need, stock } = data;
      const covered = Math.min(need, stock);
      // Registrar como "traslado" de la misma sucursal a sí misma para visibilidad
      if (covered > 0) {
        const movedAdj = Math.max(0, Number(covered.toFixed(4)));
        const stocks: Record<string, number> = Object.fromEntries(
          Object.entries(group.perBranch).map(([bid, v]) => [bid, v.stock])
        );
        plan.push({
          CODIGO: info.CODIGO,
          Producto: info.Producto,
          Drogueria: info.__drugstoreName,
          From: pharmacies.find(p=>p.id===id)?.name || id,
          FromId: id,
          To: pharmacies.find(p=>p.id===id)?.name || id,
          ToId: id,
          Cantidad: movedAdj,
          UNI_MED: info.UNI_MED,
          Stocks: stocks,
          NeedDestino: need,
          LocalCubierto: movedAdj,
          DeficitAntes: Number(need.toFixed(4)),
          DeficitDespues: Math.max(0, Number((need - movedAdj).toFixed(4))),
          Key: info.__key,
        });
      }
      // Actualizamos el stock restando lo que se usó para cubrir la demanda local
      group.perBranch[id].stock -= covered;
      group.perBranch[id].need = Math.max(0, need - covered);
    }
    
    // Sucursales donantes: excedente = stock restante después de cubrir necesidad local
    const donors = Object.entries(group.perBranch)
      .map(([id, v]) => ({ id, surplus: Math.max(0, v.stock) }))
      .filter(d => d.surplus > 0)
      .sort((a,b)=>b.surplus - a.surplus);
    // Sucursales receptoras: déficit = necesidad restante después de cubrir con stock local
    const receivers = Object.entries(group.perBranch)
      .map(([id, v]) => ({ id, deficit: Math.max(0, v.need) }))
      .filter(d => d.deficit > 0)
      .sort((a,b)=>b.deficit - a.deficit);

    for (const recv of receivers) {
      const need = group.perBranch[recv.id].need;
      const stock = group.perBranch[recv.id].stock;
      const localCovered = Math.min(need, stock);
      let remain = recv.deficit;
      for (const donor of donors) {
        if (remain <= 0) break;
        if (donor.surplus <= 0) continue;
        let moved = Math.min(remain, donor.surplus);
        // Redondeo a 4 decimales para evitar residuos flotantes
        const movedAdj = Math.max(0, Number(moved.toFixed(4)));
        if (movedAdj > 0) {
          const stocks: Record<string, number> = Object.fromEntries(
            Object.entries(group.perBranch).map(([id, v]) => [id, v.stock])
          );
          plan.push({
            CODIGO: info.CODIGO,
            Producto: info.Producto,
            Drogueria: info.__drugstoreName,
            From: pharmacies.find(p=>p.id===donor.id)?.name || donor.id,
            FromId: donor.id,
            To: pharmacies.find(p=>p.id===recv.id)?.name || recv.id,
            ToId: recv.id,
            Cantidad: movedAdj,
            UNI_MED: info.UNI_MED,
            Stocks: stocks,
            NeedDestino: need,
            LocalCubierto: localCovered,
            DeficitAntes: Number(remain.toFixed(4)),
            DeficitDespues: Math.max(0, Number((remain - movedAdj).toFixed(4))),
            Key: info.__key,
          });
          donor.surplus = Math.max(0, Number((donor.surplus - movedAdj).toFixed(4)));
          remain = Math.max(0, Number((remain - movedAdj).toFixed(4)));
        }
      }
    }
  }
  return plan;
}

// ... resto del código se mantiene igual ...

export default function RedistributionPage() {
  const { products, pharmacies, familyMap, drugstores, productOverrides } = useAppState();
  const dispatch = useAppDispatch();

  const [selectedDrugstore, setSelectedDrugstore] = useState<string>("all");
  const [buffers, setBuffers] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const p of pharmacies) init[p.id] = 0; // reserva mínima para no dejar en 0
    return init;
  });
  const [hideZeros, setHideZeros] = useState<boolean>(true);

  const byDrugstoreRows = useMemo(() => {
    // Build rows similar to drugstores page but minimal fields and include both A_PEDIR and EXISTENCIA per branch
    const toNum = (v: any) => {
      const n = parseFloat(String(v ?? "").toString().replace(",", "."));
      return Number.isFinite(n) ? n : 0;
    };

    const buckets = new Map<string, any[]>(); // drugstoreId -> rows

    for (const p of products as any[]) {
      let fam = p.FAMILIA ?? "";
      const code = String(p.CODIGO ?? p.code ?? "").trim();
      const desc = String(p.DESCRIPCION ?? p.name ?? "").trim();
      const convKey = code || desc;
      const ov = productOverrides[convKey];
      if (ov?.laboratory) fam = ov.laboratory;
      let drugstoreId = resolveDrugstoreIdByFamily(fam, familyMap, "sin-drogueria");
      if (ov?.drugstoreId) drugstoreId = ov.drugstoreId;

      const unitRaw = String(p.UNI_MED ?? p.UNIDAD ?? p.unit ?? "").trim();
      let base = baseCanonicalFor(unitRaw);

      const aPedirRaw = toNum(p.A_PEDIR ?? p.APEDIR);
      const existRaw = toNum(p.EXISTENCIA ?? p.EXISTEN ?? p.STOCK);
      let aPedirConv = convertQuantity(aPedirRaw, unitRaw, base);
      let existConv = convertQuantity(existRaw, unitRaw, base);
      // Fallback por campo: si una conversión falla, usar el valor bruto
      if (aPedirConv === null && existConv === null) {
        // si ninguna conversión es posible, mantener la unidad original como base
        base = unitRaw as any;
        aPedirConv = aPedirRaw;
        existConv = existRaw;
      } else {
        if (aPedirConv === null) aPedirConv = aPedirRaw;
        if (existConv === null) existConv = existRaw;
      }

      const key = `${code}|${desc}|${base}`;
      const arr = buckets.get(drugstoreId) ?? [];
      let row = arr.find((r: any) => r.__key === key);
      if (!row) {
        row = { __key: key, __drugstoreId: drugstoreId, __drugstoreName: drugstores.find(d=>d.id===drugstoreId)?.name || drugstoreId, CODIGO: code, Producto: desc, UNI_MED: base };
        for (const ph of pharmacies) {
          row[`${ph.id}_APEDIR`] = 0;
          row[`${ph.id}_EXISTENCIA`] = 0;
        }
        arr.push(row);
        buckets.set(drugstoreId, arr);
      }
      const branch = String(p.pharmacy ?? "");
      if (branch) {
        row[`${branch}_APEDIR`] += aPedirConv ?? 0;
        row[`${branch}_EXISTENCIA`] += existConv ?? 0;
      }
    }

    return Object.fromEntries(Array.from(buckets.entries()));
  }, [products, pharmacies, familyMap, drugstores, productOverrides]);

  const currentRows = useMemo(() => {
    if (selectedDrugstore === "all") {
      // Merge all drugstores into a synthetic plan by processing each and concatenating
      return Object.values(byDrugstoreRows).flat();
    }
    return byDrugstoreRows[selectedDrugstore] ?? [];
  }, [selectedDrugstore, byDrugstoreRows]);

  // Solo considerar productos con necesidad en al menos una sucursal
  const rowsWithNeed = useMemo(() => {
    return (currentRows as any[]).filter((row: any) =>
      pharmacies.some(ph => Number(row[`${ph.id}_APEDIR`] ?? 0) > 0)
    );
  }, [currentRows, pharmacies]);

  const plan = useMemo(() => {
    return buildPlan({ rows: rowsWithNeed, pharmacies, bufferByBranch: buffers });
  }, [rowsWithNeed, pharmacies, buffers]);

  // Construir sugerencia final de compra considerando traslados
  const finalSuggestion = useMemo(() => {
    // Índices de incoming/outgoing por Key y branchId
    const incoming = new Map<string, number>(); // `${key}|${branchId}` -> cantidad
    const outgoing = new Map<string, number>();
    for (const m of plan) {
      const kIn = `${m.Key}|${m.ToId}`;
      const kOut = `${m.Key}|${m.FromId}`;
      incoming.set(kIn, (incoming.get(kIn) ?? 0) + m.Cantidad);
      outgoing.set(kOut, (outgoing.get(kOut) ?? 0) + m.Cantidad);
    }

    type Row = {
      Drogueria: string;
      Sucursal: string;
      SucursalId: string;
      CODIGO: string;
      Producto: string;
      UNI_MED: string;
      Necesidad: number;
      CubiertoLocal: number;
      CubiertoTraslados: number;
      NuevoAPedir: number;
    };
    const rows: Row[] = [];

    for (const base of rowsWithNeed as any[]) {
      const key = base.__key as string;
      const drug = base.__drugstoreName as string;
      for (const ph of pharmacies) {
        const need = Number(base[`${ph.id}_APEDIR`] ?? 0);
        const stockEff = Math.max(0, Number(base[`${ph.id}_EXISTENCIA`] ?? 0) - Number(buffers[ph.id] ?? 0));
        if (need <= 0 && stockEff <= 0) continue;
        const inQty = incoming.get(`${key}|${ph.id}`) ?? 0;
        const localCovered = Math.min(need, stockEff);
        const remainAfterLocal = Math.max(0, need - localCovered);
        const transferCovered = Math.min(remainAfterLocal, inQty);
        const newToOrder = Math.max(0, need - (localCovered + transferCovered));
        rows.push({
          Drogueria: drug,
          Sucursal: ph.name,
          SucursalId: ph.id,
          CODIGO: base.CODIGO,
          Producto: base.Producto,
          UNI_MED: base.UNI_MED,
          Necesidad: Number(need.toFixed(4)),
          CubiertoLocal: Number(localCovered.toFixed(4)),
          CubiertoTraslados: Number(transferCovered.toFixed(4)),
          NuevoAPedir: Number(newToOrder.toFixed(4)),
        });
      }
    }
    return rows;
  }, [currentRows, plan, pharmacies, buffers]);

  const exportPlan = async () => {
    const XLSX = await import("xlsx");
    const branchIds = pharmacies.map((p) => p.id);
    const branchNames = pharmacies.map((p) => p.name);
    const header = [
      "Droguería", "CODIGO", "Producto", "De Sucursal", "A Sucursal", "Cantidad", "Unidad",
      ...branchNames.map(n => `Existencia ${n}`),
    ];
    const body = plan.map(m => [
      m.Drogueria, m.CODIGO, m.Producto, m.From, m.To, m.Cantidad, m.UNI_MED,
      ...branchIds.map(id => m.Stocks?.[id] ?? 0),
    ]);
    const aoa = [header, ...body];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Redistribucion");
    const dateStr = new Date().toISOString().slice(0,10);
    XLSX.writeFile(wb, `Redistribucion_${dateStr}.xlsx`);
  };

  // Exportar MOVIMIENTOS (plan) a PDF: incluye el resumen por producto (existencias, a pedir, totales, transferencias, reservas)
  const exportMovementsPdf = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    const title = `Farmacia Jerusalen — Movimientos y Resumen por producto`;
    const style = `
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; }
        h1 { font-size: 18px; margin-bottom: 8px; }
        h2 { font-size: 16px; margin: 18px 0 8px; }
        .card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 12px; margin-bottom: 12px; }
        table { width: 100%; border-collapse: collapse; margin-top: 6px; }
        th, td { border: 1px solid #ddd; padding: 6px; font-size: 12px; }
        th { background: #f8fafc; text-align: left; }
        .right { text-align: right; }
        .muted { color: #6b7280; font-size: 12px; }
        .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
      </style>`;
    // Construimos el contenido (solo BODY) para descarga con html2pdf
    let pdfBody = ``;
    w.document.write(`<html><head><title>${title}</title>${style}</head><body>`);
    w.document.write(`<h1>${title}</h1>`);
    pdfBody += `<h1>${title}</h1>`;

    // Sección 1: Resumen por producto (igual que la UI)
    w.document.write(`<h2>Resumen por producto (existencias, a pedir y transferencias)</h2>`);
    pdfBody += `<h2>Resumen por producto (existencias, a pedir y transferencias)</h2>`;
    for (const row of rowsWithNeed as any[]) {
      const totalAPedir = pharmacies.reduce((acc, ph) => acc + Number(row[`${ph.id}_APEDIR`] ?? 0), 0);
      const totalExist = pharmacies.reduce((acc, ph) => acc + Number(row[`${ph.id}_EXISTENCIA`] ?? 0), 0);
      const moves = plan.filter(m => m.Key === row.__key);
      w.document.write(`<div class="card">`);
      pdfBody += `<div class="card">`;
      w.document.write(`<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">`);
      w.document.write(`<div><strong>${row.CODIGO}</strong> — ${row.Producto} (${row.UNI_MED})</div>`);
      w.document.write(`<div class="muted">Droguería: ${row.__drugstoreName}</div>`);
      w.document.write(`</div>`);
      pdfBody += `<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap">`;
      pdfBody += `<div><strong>${row.CODIGO}</strong> — ${row.Producto} (${row.UNI_MED})</div>`;
      pdfBody += `<div class="muted">Droguería: ${row.__drugstoreName}</div>`;
      pdfBody += `</div>`;
      w.document.write(`<div class="grid">`);
      pdfBody += `<div class="grid">`;
      // Por sucursal
      w.document.write(`<div>`);
      w.document.write(`<div class="muted" style="font-weight:600">Por sucursal</div>`);
      w.document.write(`<table><thead><tr>
        <th>Sucursal</th><th class="right">Existencia</th><th class="right">A Pedir</th>
      </tr></thead><tbody>`);
      pdfBody += `<div>`;
      pdfBody += `<div class="muted" style="font-weight:600">Por sucursal</div>`;
      pdfBody += `<table><thead><tr>
        <th>Sucursal</th><th class="right">Existencia</th><th class="right">A Pedir</th>
      </tr></thead><tbody>`;
      for (const ph of pharmacies) {
        const ex = Number(row[`${ph.id}_EXISTENCIA`] ?? 0);
        const ap = Number(row[`${ph.id}_APEDIR`] ?? 0);
        w.document.write(`<tr><td>${ph.name}</td><td class="right">${ex.toLocaleString(undefined,{maximumFractionDigits:4})}</td><td class="right">${ap.toLocaleString(undefined,{maximumFractionDigits:4})}</td></tr>`);
        pdfBody += `<tr><td>${ph.name}</td><td class="right">${ex.toLocaleString(undefined,{maximumFractionDigits:4})}</td><td class="right">${ap.toLocaleString(undefined,{maximumFractionDigits:4})}</td></tr>`;
      }
      w.document.write(`</tbody><tfoot><tr><td><strong>Totales</strong></td><td class="right"><strong>${totalExist.toLocaleString(undefined,{maximumFractionDigits:4})}</strong></td><td class="right"><strong>${totalAPedir.toLocaleString(undefined,{maximumFractionDigits:4})}</strong></td></tr></tfoot></table>`);
      pdfBody += `</tbody><tfoot><tr><td><strong>Totales</strong></td><td class="right"><strong>${totalExist.toLocaleString(undefined,{maximumFractionDigits:4})}</strong></td><td class="right"><strong>${totalAPedir.toLocaleString(undefined,{maximumFractionDigits:4})}</strong></td></tr></tfoot></table>`;
      w.document.write(`</div>`);
      pdfBody += `</div>`;
      // Transferencias
      w.document.write(`<div>`);
      w.document.write(`<div class="muted" style="font-weight:600">Transferencias planificadas</div>`);
      pdfBody += `<div>`;
      pdfBody += `<div class="muted" style="font-weight:600">Transferencias planificadas</div>`;
      if (moves.length === 0) {
        w.document.write(`<div class="muted">No hay traslados para este producto.</div>`);
        pdfBody += `<div class="muted">No hay traslados para este producto.</div>`;
      } else {
        w.document.write(`<table><thead><tr>
          <th>De</th><th>A</th><th class="right">Cantidad</th><th>Unidad</th>
        </tr></thead><tbody>`);
        pdfBody += `<table><thead><tr>
          <th>De</th><th>A</th><th class="right">Cantidad</th><th>Unidad</th>
        </tr></thead><tbody>`;
        for (const m of moves) {
          w.document.write(`<tr><td>${m.From}</td><td>${m.To}</td><td class="right">${m.Cantidad.toLocaleString(undefined,{maximumFractionDigits:4})}</td><td>${m.UNI_MED}</td></tr>`);
          pdfBody += `<tr><td>${m.From}</td><td>${m.To}</td><td class="right">${m.Cantidad.toLocaleString(undefined,{maximumFractionDigits:4})}</td><td>${m.UNI_MED}</td></tr>`;
        }
        w.document.write(`</tbody></table>`);
        pdfBody += `</tbody></table>`;
      }
      w.document.write(`</div>`);
      pdfBody += `</div>`;
      // Reservas
      w.document.write(`<div>`);
      w.document.write(`<div class="muted" style="font-weight:600">Existencias usadas como reserva</div>`);
      w.document.write(`<ul style="margin:4px 0 0 18px;">`);
      pdfBody += `<div>`;
      pdfBody += `<div class="muted" style="font-weight:600">Existencias usadas como reserva</div>`;
      pdfBody += `<ul style="margin:4px 0 0 18px;">`;
      for (const ph of pharmacies) {
        w.document.write(`<li>${ph.name}: reserva mínima ${Number(buffers[ph.id] ?? 0).toLocaleString()}</li>`);
        pdfBody += `<li>${ph.name}: reserva mínima ${Number(buffers[ph.id] ?? 0).toLocaleString()}</li>`;
      }
      w.document.write(`</ul>`);
      w.document.write(`</div>`);
      pdfBody += `</ul>`;
      pdfBody += `</div>`;
      w.document.write(`</div>`);
      pdfBody += `</div>`;
    }

    // Sección 2: Tabla plana de movimientos (opcional para auditoría)
    w.document.write(`<h2>Tabla de movimientos</h2>`);
    pdfBody += `<h2>Tabla de movimientos</h2>`;
    const branchDefs = pharmacies.map((p) => ({ id: p.id, name: p.name }));
    const head = [
      'Droguería','CODIGO','Producto','De Sucursal','A Sucursal','Cantidad','Unidad',
      ...branchDefs.map(b=>`Existencia ${b.name}`)
    ];
    w.document.write('<table><thead><tr>' + head.map(c=>`<th>${c}</th>`).join('') + '</tr></thead><tbody>');
    pdfBody += '<table><thead><tr>' + head.map(c=>`<th>${c}</th>`).join('') + '</tr></thead><tbody>';
    for (const m of plan as any[]) {
      const row = [
        m.Drogueria,
        m.CODIGO,
        m.Producto,
        m.From,
        m.To,
        m.Cantidad,
        m.UNI_MED,
        ...branchDefs.map(b => (m as any).Stocks?.[b.id] ?? 0)
      ];
      w.document.write('<tr>' + row.map((c,i)=>`<td class="${i>=5?'right':''}">${c}</td>`).join('') + '</tr>');
      pdfBody += '<tr>' + row.map((c,i)=>`<td class="${i>=5?'right':''}">${c}</td>`).join('') + '</tr>';
    }
    w.document.write('</tbody></table>');
    pdfBody += '</tbody></table>';

    w.document.write('</body></html>');
    w.document.close();
    w.focus();
    w.print();

    // Descarga automática de PDF usando html2pdf.js (CDN) sobre un contenedor oculto
    const dateStr = new Date().toISOString().slice(0,10);
    const fileName = `Movimientos_${dateStr}.pdf`;
    const holder = document.createElement('div');
    holder.style.position = 'fixed';
    holder.style.left = '-99999px';
    holder.style.top = '0';
    holder.innerHTML = `${style}<div id=\"pdf-root\">${pdfBody}</div>`;
    document.body.appendChild(holder);
    const doDownload = () => {
      const anyWin = window as any;
      if (anyWin.html2pdf) {
        const node = document.getElementById('pdf-root');
        anyWin.html2pdf().from(node).set({
          filename: fileName,
          html2canvas: { scale: 2 },
          jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait' },
        }).save().then(() => {
          holder.remove();
        }).catch(() => {
          holder.remove();
        });
      }
    };
    if (!(window as any).html2pdf) {
      const s = document.createElement('script');
      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js';
      s.onload = doDownload;
      s.onerror = () => {
        // si falla el CDN, al menos dejamos la vista de impresión abierta
      };
      document.body.appendChild(s);
    } else {
      doDownload();
    }
  };

  const visibleFinal = useMemo(() => {
    return hideZeros ? finalSuggestion.filter((r) => r.NuevoAPedir > 0) : finalSuggestion;
  }, [finalSuggestion, hideZeros]);

  // Exporta la sugerencia final (compra) a Excel (solo > 0 cuando hideZeros activo)
  const exportFinalSuggestion = async () => {
    const XLSX = await import("xlsx");
    const header = [
      "Droguería", "Sucursal", "CODIGO", "Producto",
      "Necesidad", "Cubierto local", "Cubierto traslados", "Nuevo A Pedir", "Unidad",
    ];
    const body = visibleFinal.map((r: any) => [
      r.Drogueria, r.Sucursal, r.CODIGO, r.Producto,
      r.Necesidad, r.CubiertoLocal, r.CubiertoTraslados, r.NuevoAPedir, r.UNI_MED,
    ]);
    const aoa = [header, ...body];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "CompraFinal");
    const dateStr = new Date().toISOString().slice(0,10);
    XLSX.writeFile(wb, `CompraFinal_${dateStr}.xlsx`);
  };

  // Aplica la redistribución al estado global y guarda snapshot para deshacer
  const applyRedistribution = () => {
    if (plan.length === 0 && finalSuggestion.length === 0) return;
    const ok = window.confirm("¿Aplicar redistribución y actualizar A Pedir por sucursal? Esta acción modificará los datos cargados.");
    if (!ok) return;
    try {
      window.sessionStorage.setItem('phc_prevProducts', JSON.stringify(products));
    } catch {}
    const moves = plan.map((m: any) => ({
      CODIGO: m.CODIGO,
      Producto: m.Producto,
      FromId: m.FromId,
      ToId: m.ToId,
      Cantidad: m.Cantidad,
    }));
    const updates = finalSuggestion.map((r: any) => ({
      CODIGO: r.CODIGO,
      Producto: r.Producto,
      SucursalId: r.SucursalId,
      NuevoAPedir: r.NuevoAPedir,
    }));
    dispatch({ type: "APPLY_REDISTRIBUTION", payload: { moves, updates } });
    alert("Redistribución aplicada. Las vistas se actualizarán con los nuevos valores.");
  };

  // Deshacer usando snapshot previo
  const undoRedistribution = () => {
    try {
      const raw = window.sessionStorage.getItem('phc_prevProducts');
      if (!raw) {
        alert('No hay una redistribución previa para deshacer.');
        return;
      }
      const prev = JSON.parse(raw);
      if (!Array.isArray(prev)) {
        alert('Snapshot inválido.');
        return;
      }
      dispatch({ type: 'ADD_PRODUCTS', payload: prev });
      alert('Se restauraron los productos previos a la última redistribución.');
    } catch {
      alert('No fue posible deshacer.');
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-bold tracking-tight font-headline">Redistribución</h1>
          <p className="text-muted-foreground">Sugerencia de traslados entre sucursales usando existencias y pedidos. No modifica datos.</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <Select value={selectedDrugstore} onValueChange={setSelectedDrugstore}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Droguería" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {drugstores.map(d => (
                <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardHeader><CardTitle>Parámetros</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {pharmacies.map(ph => (
              <div key={ph.id} className="space-y-1">
                <label className="text-sm block">Reserva mínima para {ph.name} (no dejar en 0)</label>
                <Input type="number" step="any" value={buffers[ph.id] ?? 0} onChange={(e)=> setBuffers(prev=> ({ ...prev, [ph.id]: Number(e.target.value) }))} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Sugerencia final de compra</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm flex items-center gap-2">
              <input type="checkbox" checked={hideZeros} onChange={(e)=>setHideZeros(e.target.checked)} />
              Ocultar filas con Nuevo A Pedir = 0
            </label>
            <div className="flex gap-2 flex-wrap">
              <Button variant="outline" onClick={undoRedistribution}>Deshacer</Button>
              <Button variant="secondary" onClick={applyRedistribution} disabled={plan.length===0 && visibleFinal.length===0}>Aplicar redistribución</Button>
              <Button variant="outline" onClick={exportMovementsPdf} disabled={plan.length===0}>Exportar movimientos (PDF)</Button>
              <Button onClick={exportFinalSuggestion} disabled={visibleFinal.length===0}>Exportar compra final (Excel)</Button>
            </div>
          </div>
          {visibleFinal.length === 0 ? (
            <div className="text-sm text-muted-foreground">No hay filas con necesidad.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left">
                    <th className="py-2 pr-2">Droguería</th>
                    <th className="py-2 pr-2">Sucursal</th>
                    <th className="py-2 pr-2">CODIGO</th>
                    <th className="py-2 pr-2">Producto</th>
                    <th className="py-2 pr-2 text-right">Necesidad</th>
                    <th className="py-2 pr-2 text-right">Cubierto local</th>
                    <th className="py-2 pr-2 text-right">Cubierto traslados</th>
                    <th className="py-2 pr-2 text-right">Nuevo A Pedir</th>
                    <th className="py-2 pr-2">Unidad</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleFinal.map((r, i) => (
                    <tr key={`f-${i}`} className="border-top">
                      <td className="py-2 pr-2">{r.Drogueria}</td>
                      <td className="py-2 pr-2">{r.Sucursal}</td>
                      <td className="py-2 pr-2">{r.CODIGO}</td>
                      <td className="py-2 pr-2">{r.Producto}</td>
                      <td className="py-2 pr-2 text-right">{r.Necesidad.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                      <td className="py-2 pr-2 text-right">{r.CubiertoLocal.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                      <td className="py-2 pr-2 text-right">{r.CubiertoTraslados.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                      <td className="py-2 pr-2 text-right">{r.NuevoAPedir.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                      <td className="py-2 pr-2">{r.UNI_MED}</td>
                      
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Resumen por producto (existencias, a pedir y transferencias)</CardTitle></CardHeader>
        <CardContent>
          {rowsWithNeed.length === 0 ? (
            <div className="text-sm text-muted-foreground">No hay productos con necesidad.</div>
          ) : (
            <div className="space-y-6">
              {(rowsWithNeed as any[]).map((row, idx) => {
                const totalAPedir = pharmacies.reduce((acc, ph) => acc + Number(row[`${ph.id}_APEDIR`] ?? 0), 0);
                const totalExist = pharmacies.reduce((acc, ph) => acc + Number(row[`${ph.id}_EXISTENCIA`] ?? 0), 0);
                const moves = plan.filter(m => m.Key === row.__key);
                return (
                  <div key={`sum-${idx}`} className="border rounded-md p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="font-medium">{row.CODIGO} — {row.Producto} ({row.UNI_MED})</div>
                      <div className="text-sm text-muted-foreground">Droguería: {row.__drugstoreName}</div>
                    </div>
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <div className="text-sm font-semibold mb-1">Por sucursal</div>
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left">
                              <th className="py-1 pr-2">Sucursal</th>
                              <th className="py-1 pr-2 text-right">Existencia</th>
                              <th className="py-1 pr-2 text-right">A Pedir</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pharmacies.map(ph => (
                              <tr key={`b-${ph.id}`}>
                                <td className="py-1 pr-2">{ph.name}</td>
                                <td className="py-1 pr-2 text-right">{Number(row[`${ph.id}_EXISTENCIA`] ?? 0).toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                                <td className="py-1 pr-2 text-right">{Number(row[`${ph.id}_APEDIR`] ?? 0).toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="font-semibold">
                              <td className="py-1 pr-2">Totales</td>
                              <td className="py-1 pr-2 text-right">{totalExist.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                              <td className="py-1 pr-2 text-right">{totalAPedir.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                      <div>
                        <div className="text-sm font-semibold mb-1">Transferencias planificadas</div>
                        {moves.length === 0 ? (
                          <div className="text-sm text-muted-foreground">No hay traslados para este producto.</div>
                        ) : (
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left">
                                <th className="py-1 pr-2">De</th>
                                <th className="py-1 pr-2">A</th>
                                <th className="py-1 pr-2 text-right">Cantidad</th>
                                <th className="py-1 pr-2">Unidad</th>
                              </tr>
                            </thead>
                            <tbody>
                              {moves.map((m, i) => (
                                <tr key={`mv-${i}`}>
                                  <td className="py-1 pr-2">{m.From}</td>
                                  <td className="py-1 pr-2">{m.To}</td>
                                  <td className="py-1 pr-2 text-right">{m.Cantidad.toLocaleString(undefined, { maximumFractionDigits: 4 })}</td>
                                  <td className="py-1 pr-2">{m.UNI_MED}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-semibold mb-1">Existencias usadas como reserva</div>
                        <ul className="text-sm list-disc pl-5">
                          {pharmacies.map(ph => (
                            <li key={`buf-${ph.id}`}>{ph.name}: reserva mínima {Number(buffers[ph.id] ?? 0).toLocaleString()}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

