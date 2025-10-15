"use client";

import { ColumnDef } from "@tanstack/react-table";

export type DrugstoreRow = {
  CODIGO: string;
  PRODUCTO: string;
  FAMILIA: string;
  TOTAL: number;
  UNI_MED: string;
  OBSERVACIONES?: string | number;
  [key: string]: string | number | undefined; // dynamic per-branch metrics
};

const num = (v: unknown) => {
  const n = parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : 0;
};

const fmtPlain = (n: number) => {
  // Hasta 4 decimales, sin separador de miles y con punto como decimal
  const s = n.toFixed(4);
  return s.replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
};

const NumCell = ({ value }: { value: unknown }) => (
  <div className="text-right">{fmtPlain(num(value))}</div>
);

export const makeDrugstoreColumns = (branches: { id: string; name: string }[]): ColumnDef<DrugstoreRow>[] => {
  const base: ColumnDef<DrugstoreRow>[] = [
    { accessorKey: "CODIGO", header: "CODIGO" },
    { accessorKey: "PRODUCTO", header: "Producto" },
    { accessorKey: "FAMILIA", header: "Familia" },
    {
      id: "TOTAL",
      header: () => <div className="text-right">Total a pedir</div>,
      accessorFn: (r) => r.TOTAL,
      cell: ({ row, getValue }) => {
        const fmt = (row.original as any).TOTAL_FMT;
        return <div className="text-right">{fmt ?? fmtPlain(num(getValue()))}</div>;
      },
    },
  ];

  const branchCols: ColumnDef<DrugstoreRow>[] = branches.flatMap((b) => [
    {
      id: `${b.id}_APEDIR`,
      header: () => <div className="text-right">{b.name} A Pedir</div>,
      accessorFn: (r) => r[`${b.id}_APEDIR`] ?? 0,
      cell: ({ row, getValue }) => {
        const fmt = (row.original as any)[`${b.id}_APEDIR_FMT`];
        return <div className="text-right">{fmt ?? fmtPlain(num(getValue()))}</div>;
      },
    },
    {
      id: `${b.id}_EXISTENCIA`,
      header: () => <div className="text-right">{b.name} Existencia</div>,
      accessorFn: (r) => r[`${b.id}_EXISTENCIA`] ?? 0,
      cell: ({ row, getValue }) => {
        const fmt = (row.original as any)[`${b.id}_EXISTENCIA_FMT`];
        return <div className="text-right">{fmt ?? fmtPlain(num(getValue()))}</div>;
      },
    },
    {
      id: `${b.id}_VENTAS`,
      header: () => <div className="text-right">{b.name} Ventas</div>,
      accessorFn: (r) => r[`${b.id}_VENTAS`] ?? 0,
      cell: ({ row, getValue }) => {
        const fmt = (row.original as any)[`${b.id}_VENTAS_FMT`];
        return <div className="text-right">{fmt ?? fmtPlain(num(getValue()))}</div>;
      },
    },
  ]);

  const tail: ColumnDef<DrugstoreRow>[] = [
    { accessorKey: "UNI_MED", header: "Unidades de Medid" },
    {
      id: "VALOR_TOTAL",
      header: () => <div className="text-right">Valor Total</div>,
      accessorFn: (r) => (r as any).VALOR_TOTAL ?? 0,
      cell: ({ row, getValue }) => {
        const fmt = (row.original as any).VALOR_TOTAL_FMT;
        return <div className="text-right">{fmt ?? fmtPlain(num(getValue()))}</div>;
      },
    },
    { accessorKey: "OBSERVACIONES", header: "Observaciones" },
  ];

  return [...base, ...branchCols, ...tail];
};
