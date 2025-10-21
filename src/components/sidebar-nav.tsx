
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { useAppState, useAppDispatch } from "@/lib/store";
import {
  LayoutDashboard,
  Boxes,
  FileText,
  ChevronRight,
  Replace,
  Library,
  FileUp,
  Building2,
  Shuffle,
  MoveRight,
  LogOut,
} from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

export function SidebarNav() {
  const pathname = usePathname();
  const { pharmacies, user, canAccessConversion } = useAppState();
  const dispatch = useAppDispatch();
  const router = useRouter();
  const [isPharmaciesOpen, setIsPharmaciesOpen] = useState(true);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const handleConversionClick = useCallback(() => {
    if (canAccessConversion) {
      router.push("/dashboard/conversion");
    } else {
      alert("Bloqueado hasta confirmar conversión desde el Consolidado.");
    }
  }, [canAccessConversion, router]);

  const isActive = (path: string) => pathname === path;
  const isProductsActive = (slug: string) => pathname === `/dashboard/products/${slug}`;

  return (
    <>
      <SidebarHeader>
        {/* Can be used for a logo or title if needed */}
      </SidebarHeader>
      <SidebarContent>
            <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive("/import")}
              tooltip="Importar"
            >
              <Link href="/import">
                <FileUp />
                <span>Importar</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive("/dashboard")}
              tooltip="Dashboard"
            >
              <Link href="/dashboard">
                <LayoutDashboard />
                <span>Dashboard</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive("/dashboard/consolidated")}
              tooltip="Consolidado"
            >
              <Link href="/dashboard/consolidated">
                <Library />
                <span>Consolidado</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive("/dashboard/drugstores")}
              tooltip="Pedidos por Droguería"
            >
              <Link href="/dashboard/drugstores">
                <Building2 />
                <span>Droguerías</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive("/dashboard/move-product")}
              tooltip="Mover producto"
            >
              <Link href="/dashboard/move-product">
                <Shuffle />
                <span>Mover producto</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive("/dashboard/admin-drugstores")}
              tooltip="Admin Droguerías"
            >
              <Link href="/dashboard/admin-drugstores">
                <Building2 />
                <span>Admin Droguerías</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton
              asChild
              isActive={isActive("/dashboard/redistribution")}
              tooltip="Redistribución"
            >
              <Link href="/dashboard/redistribution">
                <MoveRight />
                <span>Redistribución</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <Collapsible open={isPharmaciesOpen} onOpenChange={setIsPharmaciesOpen}>
            <SidebarMenuItem>
              <CollapsibleTrigger asChild>
                 <SidebarMenuButton tooltip="Sucursales" className="justify-between">
                    <div className="flex items-center gap-2">
                        <Boxes />
                        <span>Sucursales</span>
                    </div>
                    <ChevronRight className={`h-4 w-4 transition-transform duration-200 ${isPharmaciesOpen ? 'rotate-90' : ''}`} />
                 </SidebarMenuButton>
              </CollapsibleTrigger>
            </SidebarMenuItem>
            <CollapsibleContent>
                 <div className="ml-7 pl-2 border-l">
                    {pharmacies.map((store) => (
                    <SidebarMenuItem key={store.id}>
                        <SidebarMenuButton
                        asChild
                        size="sm"
                        isActive={isProductsActive(store.id)}
                        className="h-8"
                        >
                        <Link href={`/dashboard/products/${store.id}`}>
                            <span>{store.name}</span>
                        </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                    ))}
                </div>
            </CollapsibleContent>
          </Collapsible>


          <SidebarMenuItem>
            <SidebarMenuButton
              isActive={canAccessConversion && isActive("/dashboard/conversion")}
              tooltip={isClient ? (canAccessConversion ? "Conversión de Unidades" : "Bloqueado") : "Conversión de Unidades"}
              onClick={handleConversionClick}
            >
              <Replace />
              {/* Para evitar mismatch, renderizamos siempre el label base en SSR y añadimos el sufijo solo en cliente */}
              <span>
                {"Conversión de Unidades"}
                {isClient && !canAccessConversion ? " (bloqueado)" : ""}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => router.push("/dashboard/reports")}
              isActive={isActive("/dashboard/reports")}
              tooltip="Reportes"
            >
              <FileText />
              <span>Reportes</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        <SidebarSeparator />
        <div className="px-3 py-2 text-xs text-sidebar-foreground/80">
          {isClient && user?.username && `Conectado como ${user.username}`}
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={() => { dispatch({ type: "LOGOUT" }); router.replace("/login"); }}
              tooltip="Cerrar sesión"
            >
              <LogOut />
              <span>Cerrar sesión</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="p-2 text-center text-xs text-sidebar-foreground/60">
          Farmacia Jerusalen v1.0
        </div>
      </SidebarFooter>
    </>
  );
}
