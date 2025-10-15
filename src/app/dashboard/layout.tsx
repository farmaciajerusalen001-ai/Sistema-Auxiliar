"use client";
import Header from "@/components/header";
import { SidebarNav } from "@/components/sidebar-nav";
import { SidebarProvider, Sidebar, SidebarInset } from "@/components/ui/sidebar";
import { useAppState } from "@/lib/store";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ProcessHeader } from "@/components/process-header";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, products } = useAppState();
  const router = useRouter();
  const hasData = useMemo(() => Array.isArray(products) && products.length > 0, [products]);
  const [readyToRedirect, setReadyToRedirect] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setReadyToRedirect(true), 400); // dar tiempo a hidratación
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (readyToRedirect && !isAuthenticated && !hasData) {
      router.replace("/login");
    }
  }, [isAuthenticated, hasData, readyToRedirect, router]);
  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarNav />
      </Sidebar>
      <SidebarInset>
        <div className="flex flex-col min-h-screen">
          <ProcessHeader />
          <Header />
          <main className="flex-1 p-4 md:p-8 pt-6">{children}</main>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
