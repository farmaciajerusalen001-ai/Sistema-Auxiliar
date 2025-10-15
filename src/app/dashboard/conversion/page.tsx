"use client";
import { useAppState } from "@/lib/store";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ConversionTool } from "@/components/conversion-tool";

export default function ConversionPage() {
  const { canAccessConversion } = useAppState();
  const router = useRouter();
  if (!canAccessConversion) {
    return (
      <div className="max-w-xl mx-auto">
        <Card>
          <CardHeader><CardTitle>Conversión bloqueada</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground mb-4">Debes iniciar la conversión desde el Consolidado. Genera el archivo y cuando se te pregunte, elige "Sí".</p>
            <Button variant="secondary" onClick={() => router.push("/dashboard/consolidated")}>Ir al Consolidado</Button>
          </CardContent>
        </Card>
      </div>
    );
  }
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-headline">
          Conversión de Unidades
        </h1>
        <p className="text-muted-foreground">
          Conversión de unidades con cálculos automáticos.
        </p>
      </div>

      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Conversión de Unidades</CardTitle>
          <CardDescription>
            Selecciona un producto, elige la unidad objetivo y define la
            equivalencia para ver el resultado.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ConversionTool />
        </CardContent>
      </Card>
    </div>
  );
}
