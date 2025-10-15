
"use client";

import { ColumnDef } from "@tanstack/react-table";
import { Product } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, ArrowUpDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const formatNumber = (value: unknown) => {
  if (value === undefined || value === null || value === "")
    return <div className="text-right font-medium">{""}</div>;

  const amount = parseFloat(String(value));
  if (isNaN(amount))
    return <div className="text-right font-medium">{String(value)}</div>;

  return (
    <div className="text-right font-medium">{amount.toLocaleString()}</div>
  );
};

export const columns: ColumnDef<Product>[] = [
  {
    accessorKey: "CODIGO",
    header: "Código",
  },
  {
    accessorKey: "DESCRIPCION",
    header: ({ column }) => {
      return (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
        >
          Descripción
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => (
      <div className="font-medium">{row.getValue("DESCRIPCION")}</div>
    ),
  },
  {
    accessorKey: "FAMILIA",
    header: "Familia",
    cell: ({ row }) => {
      const familia = row.getValue("FAMILIA");
      return familia ? <Badge variant="secondary">{String(familia)}</Badge> : <span className="text-muted-foreground">-</span>;
    },
  },
  {
    id: "VALOR_UNIT",
    header: () => <div className="text-right">Valor Unit.</div>,
    accessorFn: (row) => {
      return row.VALOR_UNIT ?? row.VALOR ?? row['VALOR_UNIT'] ?? row['VALOR UNIT'] ?? undefined;
    },
    cell: ({ getValue }) => formatNumber(getValue()),
  },
  {
    id: "EXISTENCIA",
    header: () => <div className="text-right">Existencia</div>,
    accessorFn: (row) => {
      return row.EXISTENCIA ?? row.EXISTEN ?? row.STOCK ?? row['EXISTENCIA'] ?? undefined;
    },
    cell: ({ getValue }) => formatNumber(getValue()),
  },
  {
    id: "VTA_PROMMENSUAL",
    header: () => <div className="text-right">Prom.Mens</div>,
    accessorFn: (row) => {
      return (
        row.VTA_PROMMENSUAL ?? row.VTA_PROM_MENSUAL ?? row['VTA_PROM.MENSUAL'] ?? row.VTA_PROM ?? row.PROM_MENS ?? undefined
      );
    },
    cell: ({ getValue }) => formatNumber(getValue()),
  },
  {
    id: "COBERTURA",
    header: () => <div className="text-right">Cobertura</div>,
    accessorFn: (row) => {
      return row.COBERTURA ?? undefined;
    },
    cell: ({ getValue }) => formatNumber(getValue()),
  },
  {
    id: "A_PEDIR",
    header: () => <div className="text-right">A Pedir</div>,
    accessorFn: (row) => {
      return row.A_PEDIR ?? row.APEDIR ?? row['A PEDIR'] ?? undefined;
    },
    cell: ({ getValue }) => formatNumber(getValue()),
  },
  {
    header: "Uni.Med",
    accessorFn: (row) => {
      return row.UNI_MED ?? row.UNIDAD ?? row.UNI_MEDIC ?? row.unit ?? row['UNI.MED'] ?? '';
    },
    id: "UNI_MED",
  },
  {
    id: "actions",
    cell: ({ row }) => {
      const product = row.original;

      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-8 w-8 p-0">
              <span className="sr-only">Open menu</span>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuLabel>Acciones</DropdownMenuLabel>
            <DropdownMenuItem
              onClick={() => navigator.clipboard.writeText(product.CODIGO)}
            >
              Copiar Código
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Ver detalles</DropdownMenuItem>
            <DropdownMenuItem>Editar producto</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      );
    },
  },
];
