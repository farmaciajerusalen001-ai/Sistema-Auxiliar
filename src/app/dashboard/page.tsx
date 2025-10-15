import OverviewStats from "@/components/overview-stats";
import ReportCharts from "@/components/report-charts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-bold tracking-tight font-headline">
            Dashboard
          </h1>
          <p className="text-muted-foreground">
            Vista de inventario de Produtos
          </p>
        </div>
      </div>

      <OverviewStats />

      <Card>
        <CardHeader>
          <CardTitle>Productos por Laboratorio</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <div className="min-w-[640px]">
            <ReportCharts />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
