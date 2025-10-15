"use client";
import { useEffect } from "react";
import { useAppState } from "@/lib/store";
import { useRouter } from "next/navigation";

export default function Home() {
  const { isAuthenticated } = useAppState();
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) router.replace("/dashboard");
    else router.replace("/login");
  }, [isAuthenticated, router]);

  return null;
}
