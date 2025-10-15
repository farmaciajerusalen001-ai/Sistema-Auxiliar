"use client";

import { useMemo } from "react";
import { useAppState } from "@/lib/store";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import {
  ChartContainer,
  ChartTooltipContent,
} from "@/components/ui/chart";

export default function ReportCharts() {
  const { products } = useAppState();

  const chartData = useMemo(() => {
    const dataMap = new Map<string, number>();

    (products as any[]).forEach((p) => {
      const fam = String((p as any).FAMILIA ?? "").trim() || "Sin familia";
      dataMap.set(fam, (dataMap.get(fam) || 0) + 1);
    });

    return Array.from(dataMap.entries()).map(([name, total]) => ({
      name,
      total,
    }));
  }, [products]);
  
  if (!products || products.length === 0) {
    return (
        <div className="flex items-center justify-center h-80 w-full text-muted-foreground">
            No hay datos disponibles para mostrar gráficos.
        </div>
    )
  }

  return (
    <div className="h-80 w-full">
        <ChartContainer config={{
            total: {
                label: "Familias",
                color: "hsl(var(--primary))",
            }
        }}>
            <BarChart data={chartData} margin={{ top: 20, right: 20, bottom: 5, left: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                dataKey="name"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                />
                <YAxis />
                <Tooltip
                    cursor={false}
                    content={<ChartTooltipContent indicator="dot" />}
                />
                <Legend />
                <Bar dataKey="total" fill="var(--color-total)" radius={4} />
            </BarChart>
        </ChartContainer>
    </div>
  );
}
