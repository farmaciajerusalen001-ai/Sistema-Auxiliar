
"use client";

import { useAppState } from "@/lib/store";
import { ProductDataTable } from "@/components/product-data-table";
import { columns } from "@/components/columns";
import { notFound, useParams } from "next/navigation";
import { useEffect, useState } from "react";

export default function ProductsByPharmacyPage() {
  const params = useParams();
  const slug = params.slug as string;

  const { products, pharmacies } = useAppState();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const pharmacy = pharmacies.find((d) => d.id === slug);

  if (isClient && !pharmacy) {
    notFound();
  }
  
  if (!isClient) {
    // Render a placeholder or null on the server to avoid hydration mismatch
    return null;
  }
  
  const filteredProducts = products.filter(
    (p) => p.pharmacy === slug
  );

  return (
    <div className="space-y-8">
       <div>
        <h1 className="text-3xl font-bold tracking-tight font-headline">
          {pharmacy?.name}
        </h1>
        <p className="text-muted-foreground">
          Productos disponibles en {pharmacy?.name}.
        </p>
      </div>
      <ProductDataTable
        columns={columns}
        data={filteredProducts}
        filterColumnId="DESCRIPCION"
        filterPlaceholder="Filtrar por descripción..."
      />
    </div>
  );
}
