"use client";

import { ColumnDef } from "@tanstack/react-table";

export type ConsolidatedRow = {
  CODIGO: string;
  Producto: string;
  Familia: string;
  TotalAPedir: number;
  UNI_MED: string;
  // dynamic branch fields by id
  [branchId: string]: string | number;
};

const formatNumber = (value: unknown) => {
  if (value === undefined || value === null || value === "") return <div className="text-right">{""}</div>;
  // If it's already a string (e.g., *_FMT), render as-is
  if (typeof value === "string") return <div className="text-right">{value}</div>;
  const n = parseFloat(String(value));
  if (Number.isNaN(n)) return <div className="text-right">{String(value)}</div>;
  return <div className="text-right">{n.toLocaleString(undefined, { maximumFractionDigits: 4 })}</div>;
};

export const makeConsolidatedColumns = (branchIds: { id: string; name: string }[]): ColumnDef<ConsolidatedRow>[] => {
  const base: ColumnDef<ConsolidatedRow>[] = [
    { accessorKey: "CODIGO", header: "CODIGO" },
    { accessorKey: "Producto", header: "Producto" },
    { accessorKey: "Familia", header: "Familia" },
    {
      id: "TotalAPedir",
      accessorFn: (row) => (row as any).TotalAPedir_FMT ?? row.TotalAPedir,
      header: () => <div className="text-right">Total a pedir</div>,
      cell: ({ getValue }) => formatNumber(getValue()),
    },
  ];

  const branchCols: ColumnDef<ConsolidatedRow>[] = branchIds.map((b) => ({
    id: b.id,
    header: b.name,
    accessorFn: (row) => (row as any)[`${b.id}_FMT`] ?? row[b.id] ?? 0,
    cell: ({ getValue }) => formatNumber(getValue()),
  }));

  const tail: ColumnDef<ConsolidatedRow>[] = [
    { accessorKey: "UNI_MED", header: "Unidades de Medid" },
    {
      id: "ValorTotal",
      accessorFn: (row) => (row as any).ValorTotal ?? 0,
      header: () => <div className="text-right">Valor Total</div>,
      cell: ({ getValue }) => formatNumber(getValue()),
    },
  ];

  return [...base, ...branchCols, ...tail];
};
