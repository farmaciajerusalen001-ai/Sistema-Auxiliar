import ReportCharts from "@/components/report-charts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ReportsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-headline">
          Reports
        </h1>
        <p className="text-muted-foreground">
          Visualize your inventory data with dynamic charts.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Inventory Analysis</CardTitle>
          <CardDescription>
            Product distribution across different laboratories.
          </CardDescription>
        </CardHeader>
        <CardContent className="pl-2">
          <ReportCharts />
        </CardContent>
      </Card>
    </div>
  );
}
