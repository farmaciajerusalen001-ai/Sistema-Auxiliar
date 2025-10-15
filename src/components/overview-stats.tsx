"use client";

import { useAppState } from "@/lib/store";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Pill, Boxes, FlaskConical, Package } from "lucide-react";

export default function OverviewStats() {
  const { products, pharmacies, laboratories, familyMap } = useAppState();
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  const familiesCount = (() => {
    try {
      const set = new Set<string>();
      for (const f of familyMap || []) {
        const name = String((f as any)?.family ?? '').trim();
        if (name) set.add(name);
      }
      return set.size;
    } catch {
      return 0;
    }
  })();

  const totalQuantity = products.reduce((sum, p) => {
    const q = Number(p.quantity ?? 0);
    return sum + (Number.isNaN(q) ? 0 : q);
  }, 0);

  const stats = [
    {
      title: "Productos Totales",
      value: products.length,
      icon: Pill,
    },
    {
      title: "Unidades Totales",
      value: totalQuantity.toLocaleString(),
      icon: Package,
    },
    {
      title: "Farmacias",
      value: pharmacies.length,
      icon: Boxes,
    },
    {
      title: "Laboratorios",
      value: laboratories.length,
      icon: FlaskConical,
    },
  ];

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, index) => (
        <Card key={index}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
            <stat.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mounted ? stat.value : '—'}</div>
            {stat.title === 'Laboratorios' && (
              <div className="text-xs text-muted-foreground">Familias: {mounted ? familiesCount : '—'}</div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
