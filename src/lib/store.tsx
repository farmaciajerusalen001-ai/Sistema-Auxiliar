"use client";

import React, { createContext, useContext, useReducer, ReactNode, Dispatch, useEffect } from "react";
import type { Product, Pharmacy, Laboratory } from "./types";
import { pharmacies as initialPharmacies, laboratories as initialLaboratories } from "./data";
import { idbGet, idbSet, idbDel } from "@/lib/idb";
import { fetchDrugstores, fetchFamilyMap } from "@/lib/drugstores";

interface AppState {
  products: Product[];
  pharmacies: Pharmacy[];
  laboratories: Laboratory[];
  isDataLoaded: boolean;
  isAuthenticated: boolean;
  user?: { username: string } | null;
  canAccessConversion: boolean;
  conversions: Record<string, { sourceUnit: string; targetUnit: string; factor: number; comment?: string; roundUp?: boolean }>;
  drugstores: { id: string; name: string }[];
  familyMap: { family: string; drugstoreId: string }[];
  // manual overrides per product (by convKey: CODIGO or DESCRIPCION)
  productOverrides: Record<string, { drugstoreId?: string; laboratory?: string }>;
  exportAfterSave?: { page: 'consolidated' | 'drugstores', type: 'excel' | 'pdf', params?: any, filteredProducts?: string[] };
  // active saved process tracking
  activeProcessId?: string;
  activeProcessName?: string;
}

// ... (rest of the code remains the same)

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(appReducer, getInitialState());

  // Hidratación defensiva: si al montar no hay productos pero en localStorage sí, recargar
  useEffect(() => {
    if (typeof window === 'undefined') return;
    (async () => {
      try {
        // 1) Intentar desde localStorage
        const raw = window.localStorage.getItem('pharmaCentralState') || window.localStorage.getItem('pharmaCentralBackup');
        let storedState: any = null;
        if (raw) {
          try { storedState = JSON.parse(raw); } catch {}
        }
        // 2) Si localStorage no trae productos, intentar desde IndexedDB
        if (!storedState || !Array.isArray(storedState.products) || storedState.products.length === 0) {
          const fromIdb = await idbGet<any>('pharmaCentralState');
          if (fromIdb) storedState = fromIdb;
        }
        const hasProducts = Array.isArray(storedState?.products) && storedState.products.length > 0;
        if ((state.products?.length ?? 0) === 0 && hasProducts) {
          // Rehidratar todo lo relevante (auth, overrides, conversions, etc.)
          const { products, conversions, productOverrides, drugstores, familyMap, exportAfterSave, canAccessConversion, isAuthenticated, user } = storedState as any;
          dispatch({
            type: 'REHYDRATE',
            payload: {
              products,
              conversions: conversions || {},
              productOverrides: productOverrides || {},
              drugstores: drugstores || [],
              familyMap: familyMap || [],
              exportAfterSave,
              canAccessConversion: !!canAccessConversion,
              isAuthenticated: !!isAuthenticated,
              user: user ?? null,
            } as Partial<AppState>,
          });
        }
        // 3) Cargar overrides permanentes y fusionarlos si hay productos cargados
        try {
          const perm = await idbGet<Record<string, { drugstoreId?: string; laboratory?: string }>>('pharmaPermanentOverrides');
          if (perm && Object.keys(perm).length > 0) {
            // Aplicar al estado actual (no bloqueante si no hay productos)
            dispatch({ type: 'MERGE_PRODUCT_OVERRIDES', payload: perm });
          }
        } catch {}
        // 4) Cargar droguerías y mapeo permanentes desde Firestore (si disponible)
        try {
          const [ds, fm] = await Promise.all([
            fetchDrugstores().catch(()=>[]),
            fetchFamilyMap().catch(()=>[]),
          ]);
          // Asegurar presencia de "sin-drogueria" y no duplicar
          const baseDs = Array.isArray(ds) ? ds : [];
          const withFallback = [{ id: 'sin-drogueria', name: 'Sin Droguería' }, ...baseDs.filter(d=>d.id!=='sin-drogueria')]
            .filter((v,i,a)=> a.findIndex(x=>x.id===v.id)===i);
          const fmList = Array.isArray(fm) ? (fm as any[]).map((x:any)=> ({ family: x.family, drugstoreId: x.drugstoreId })) : [];
          if (withFallback.length > 1 || fmList.length > 0) {
            dispatch({ type: 'SET_DRUGSTORES_DATA', payload: { drugstores: withFallback, familyMap: fmList } });
          }
        } catch {}
      } catch {}
    })();
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
        try {
            // Evitar sobreescribir datos no vacíos con estado vacío
            const existingRaw = window.localStorage.getItem('pharmaCentralState');
            const existing = existingRaw ? JSON.parse(existingRaw) : null;
            const existingHasProducts = !!(existing && Array.isArray(existing.products) && existing.products.length > 0);
            const currentHasProducts = Array.isArray((state as any).products) && (state as any).products.length > 0;
            if (!currentHasProducts && existingHasProducts) {
              // No escribir para no perder datos previamente guardados
            } else {
              // Escribir metadatos mínimos en localStorage; nunca guardar productos completos aquí
              try {
                const { products, ...rest } = state as any;
                const meta = { ...rest, products: [], productsCountMeta: (state as any).products?.length ?? 0 } as any;
                window.localStorage.setItem('pharmaCentralState', JSON.stringify(meta));
                window.localStorage.setItem('pharmaCentralBackup', JSON.stringify(meta));
              } catch {}
            }
            // Escribir el estado completo en IndexedDB (no sujeta a la misma cuota)
            idbSet('pharmaCentralState', state).catch(() => {});
        } catch (error) {
            console.warn('Error writing to localStorage:', error);
        }
    }
  }, [state]);

  return (
    <AppStateContext.Provider value={state}>
      <AppDispatchContext.Provider value={dispatch}>
        {children}
      </AppDispatchContext.Provider>
    </AppStateContext.Provider>
  );
};

export const useAppState = () => {
  const context = useContext(AppStateContext);
  if (context === undefined) {
    throw new Error("useAppState must be used within an AppProvider");
  }
  return context;
};

export const useAppDispatch = () => {
  const context = useContext(AppDispatchContext);
  if (context === undefined) {
    throw new Error("useAppDispatch must be used within an AppProvider");
  }
  return context;
};
