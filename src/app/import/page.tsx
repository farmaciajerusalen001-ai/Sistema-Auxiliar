"use client";
import Image from "next/image";
import { ImportForm } from "@/components/import-form";
import placeholderImages from "@/lib/placeholder-images.json";
import { Pill } from "lucide-react";

export default function ImportPage() {
  const heroImage = (placeholderImages as any).placeholderImages.find((p: any) => p.id === "hero-image");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background p-4 md:p-8">
      <div className="w-full max-w-6xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-6 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary font-semibold py-1 px-3 rounded-full">
              <Pill className="h-5 w-5" />
              <span>Farmacia Jerusalen</span>
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold font-headline tracking-tighter">
              Importar Excel de Pedidos
            </h1>
            <p className="text-lg text-muted-foreground">
              Importa el Excel con las sugerencias de pedidos. Se generará el consolidado y la sugerencia de compra clasificados por droguerías y sucursales.
            </p>
            {heroImage && (
              <div className="relative w-full h-64 rounded-xl overflow-hidden shadow-xl lg:hidden">
                <Image
                  src={(heroImage as any).imageUrl}
                  alt={(heroImage as any).description}
                  fill
                  style={{ objectFit: "cover" }}
                  data-ai-hint={(heroImage as any).imageHint}
                  sizes="100vw"
                  priority
                />
              </div>
            )}
            <ImportForm />
          </div>
          <div className="hidden lg:block">
            {heroImage && (
              <div className="relative w-full h-[500px] rounded-2xl overflow-hidden shadow-2xl transform hover:scale-105 transition-transform duration-300">
                <Image
                  src={(heroImage as any).imageUrl}
                  alt={(heroImage as any).description}
                  fill
                  style={{ objectFit: "cover" }}
                  data-ai-hint={(heroImage as any).imageHint}
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  priority
                />
              </div>
            )}
          </div>
        </div>
      </div>
      <footer className="mt-16 text-center text-muted-foreground text-sm">
        <p>&copy; {new Date().getFullYear()} Farmacia Jerusalen. Todos los derechos reservados.</p>
      </footer>
    </main>
  );
}
