"use client";
import { useState, useEffect } from "react";
import { useAppDispatch, useAppState } from "@/lib/store";
import { useRouter } from "next/navigation";
import Image from "next/image";
import logo from "./logo.jpg";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, EyeOff, Loader2 } from "lucide-react";

export default function LoginPage() {
  const { isAuthenticated } = useAppState();
  const dispatch = useAppDispatch();
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/dashboard");
    }
  }, [isAuthenticated, router]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    const ok =
      (username === "kevin" && password === "admin123") ||
      (username === "Ethel" && password === "cooper");
    setTimeout(() => {
      if (!ok) {
        setErr("Usuario o contraseña incorrectos");
        setLoading(false);
        return;
      }
      dispatch({ type: "LOGIN_SUCCESS", payload: { username } });
      router.replace("/dashboard");
    }, 600);
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center overflow-hidden bg-[radial-gradient(1200px_600px_at_50%_-20%,rgba(59,130,246,0.25),transparent),radial-gradient(800px_400px_at_100%_10%,rgba(236,72,153,0.2),transparent)]">
      <video
        className="absolute inset-0 w-full h-full object-cover motion-safe:block motion-reduce:hidden"
        src="/login-bg.mp4"
        autoPlay
        loop
        muted
        playsInline
        preload="none"
        aria-hidden
      />
      <div className="absolute inset-0 bg-black/60" />
      {/* decor blobs */}
      <div className="pointer-events-none absolute -bottom-32 -left-40 h-[28rem] w-[28rem] rounded-full bg-blue-500/20 blur-3xl" />

      <Card className="relative w-full max-w-md border border-white/50 bg-white/70 backdrop-blur-xl shadow-2xl">
        <CardHeader className="space-y-3 items-center text-center">
          <div className="h-16 w-16 rounded-xl overflow-hidden ring-1 ring-white/30 shadow-md">
            <Image src={logo} alt="Logo" width={64} height={64} className="h-full w-full object-cover" />
          </div>
          <CardTitle className="text-2xl font-bold tracking-tight">Bienvenido</CardTitle>
          <p className="text-sm text-muted-foreground">Inicia sesión para continuar</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Usuario</label>
              <Input
                value={username}
                onChange={(e)=>setUsername(e.target.value)}
                autoFocus
                placeholder="Tu usuario"
                disabled={loading}
                className="bg-white/90"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Contraseña</label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e)=>setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={loading}
                  className="pr-10 bg-white/90"
                />
                <button
                  type="button"
                  onClick={()=>setShowPassword(v=>!v)}
                  className="absolute inset-y-0 right-2 flex items-center text-muted-foreground hover:text-foreground"
                  aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {err && (
              <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50/60 dark:bg-red-950/20 border border-red-200/50 rounded px-3 py-2">
                {err}
              </div>
            )}

            <Button type="submit" className="w-full h-10 font-medium" disabled={loading}>
              {loading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Ingresando...
                </span>
              ) : (
                "Entrar"
              )}
            </Button>

            <div className="text-xs text-center text-muted-foreground">
              © {new Date().getFullYear()} Farmacia Jerusalen
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
