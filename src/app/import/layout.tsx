"use client";
import Header from "@/components/header";
import { SidebarNav } from "@/components/sidebar-nav";
import {
  SidebarProvider,
  Sidebar,
  SidebarInset,
} from "@/components/ui/sidebar";
import { useAppState } from "@/lib/store";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ProcessHeader } from "@/components/process-header";

export default function ImportLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated } = useAppState();
  const router = useRouter();
  useEffect(() => {
    if (!isAuthenticated) {
      router.replace("/login");
    }
  }, [isAuthenticated, router]);
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
