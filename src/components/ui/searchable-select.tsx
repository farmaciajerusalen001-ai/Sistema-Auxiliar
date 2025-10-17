"use client";

import * as React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface OptionItem {
  value: string;
  label: string;
  disabled?: boolean;
}

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: OptionItem[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  buttonClassName?: string;
  contentClassName?: string;
  closeOnSelect?: boolean; // default true -> cerrar al seleccionar
  disabled?: boolean;
  maxHeightClass?: string; // tailwind class para altura de lista
  alwaysOpen?: boolean; // si true, comportamiento anterior (siempre abierta)
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Selecciona...",
  searchPlaceholder = "Buscar...",
  emptyText = "Sin resultados",
  buttonClassName,
  contentClassName,
  closeOnSelect = true,
  disabled = false,
  maxHeightClass = "max-h-40",
  alwaysOpen = false,
}: SearchableSelectProps) {
  const [query, setQuery] = React.useState("");
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => { setMounted(true); }, []);
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = React.useState(alwaysOpen);
  React.useEffect(() => { setOpen(alwaysOpen); }, [alwaysOpen]);
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(o => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const current = options.find((o) => o.value === value) || null;

  return (
    <div className={cn("w-full", contentClassName)} ref={containerRef}>
      <div className="rounded-md border bg-background">
        <div className="p-1">
          <input
            type="text"
            className={cn("w-full h-8 rounded-md border bg-background px-3 py-1 text-sm focus:outline-none")}
            placeholder={searchPlaceholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            disabled={disabled || !mounted}
            onFocus={() => { if (!alwaysOpen) setOpen(true); }}
            onClick={() => { if (!alwaysOpen) setOpen(true); }}
            onBlur={(e) => {
              if (alwaysOpen) return;
              // cerrar tras pequeño delay para permitir onClick de opciones
              setTimeout(() => {
                if (!containerRef.current?.contains(document.activeElement)) {
                  setOpen(false);
                }
              }, 100);
            }}
          />
        </div>
        {mounted && (alwaysOpen || open) ? (
          <div className={cn("border-t overflow-auto bg-card", maxHeightClass)}>
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">{emptyText}</div>
            ) : (
              filtered.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={cn(
                    "w-full flex items-center text-left px-3 py-1.5 text-sm hover:bg-accent",
                    opt.disabled && "opacity-50 cursor-not-allowed"
                  )}
                  onClick={() => {
                    if (!opt.disabled && !disabled) {
                      onChange(opt.value);
                      if (closeOnSelect && !alwaysOpen) setOpen(false);
                    }
                  }}
                  disabled={disabled || !!opt.disabled}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === opt.value ? "opacity-100" : "opacity-0")} />
                  <span className="truncate">{opt.label}</span>
                </button>
              ))
            )}
          </div>
        ) : mounted ? (
          <div className={cn("border-t", maxHeightClass)} />
        ) : null}
      </div>
    </div>
  );
}
