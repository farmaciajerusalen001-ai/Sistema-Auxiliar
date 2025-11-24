"use client";

import React, { createContext, useContext, useEffect, useReducer, ReactNode, Dispatch } from "react";
import { fetchProductOverrides } from "./overrides";
import type { Product, Pharmacy, Laboratory } from "./types";
import { pharmacies as initialPharmacies, laboratories as initialLaboratories } from "./data";
import { idbGet, idbSet, idbDel } from "@/lib/idb";
import { fetchDrugstores, fetchFamilyMap, saveDrugstoresAndFamilies } from "@/lib/drugstores";
import defaultMap from "@/lib/drugstores-default.json" assert { type: "json" };

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

type Action =
  | { type: 'REHYDRATE'; payload: Partial<AppState> }
  | { type: 'LOGIN_SUCCESS'; payload: { username: string } }
  | { type: 'LOGOUT' }
  | { type: 'SET_DRUGSTORES'; payload: { id: string; name: string }[] }
  | { type: 'SET_ACTIVE_PROCESS'; payload: { id?: string; name?: string } }
  | { type: 'START_NEW_PROCESS' }
  | { type: 'APPLY_REDISTRIBUTION'; payload: { moves: any[]; updates: any[] } }
  | { type: 'MERGE_PRODUCT_OVERRIDES'; payload: Record<string, { drugstoreId?: string; laboratory?: string }> }
  | { type: 'SET_DRUGSTORES_DATA'; payload: { drugstores: { id: string; name: string }[]; familyMap: { family: string; drugstoreId: string }[] } }
  | { type: 'SET_EXPORT_AFTER_SAVE'; payload: { page: 'consolidated' | 'drugstores'; type: 'excel' | 'pdf'; params?: any; filteredProducts?: string[] } }
  | { type: 'UNLOCK_CONVERSION' }
  | { type: 'LOCK_CONVERSION' }
  | { type: 'SET_PRODUCTS'; payload: Product[] }
  | { type: 'SET_PHARMACIES'; payload: Pharmacy[] }
  | { type: 'SET_LABS'; payload: Laboratory[] }
  | { type: 'ADD_PRODUCTS'; payload: Product[] }
  | { type: 'CLEAR_EXPORT_AFTER_SAVE' }
  | { type: 'SET_CONVERSION'; payload: { key: string; def: { sourceUnit: string; targetUnit: string; factor: number; comment?: string; roundUp?: boolean } } }
  | { type: 'REMOVE_CONVERSION'; payload: { key: string } }
  | { type: 'CLEAR_CONVERSIONS' }
  | { type: 'CLEAR_ALL_DATA' }
  | { type: 'SET_PRODUCT_OVERRIDE'; payload: { key: string; override: { drugstoreId?: string; laboratory?: string } } }
  | { type: 'CLEAR_PRODUCT_OVERRIDE'; payload: { key: string } }
  | { type: 'SET_FAMILY_MAP'; payload: { family: string; drugstoreId: string }[] };

const AppStateContext = createContext<AppState | undefined>(undefined);
const AppDispatchContext = createContext<Dispatch<Action> | undefined>(undefined);

function getInitialState(): AppState {
  return {
    products: [],
    pharmacies: [],
    laboratories: [],
    isDataLoaded: false,
    isAuthenticated: false,
    user: null,
    canAccessConversion: false,
    conversions: {},
    drugstores: [],
    familyMap: [],
    productOverrides: {},
    exportAfterSave: undefined,
    activeProcessId: undefined,
    activeProcessName: undefined,
  };
}

function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'REHYDRATE':
      return { ...state, ...action.payload } as AppState;
    case 'LOGIN_SUCCESS':
      return { ...state, isAuthenticated: true, user: { username: action.payload.username } };
    case 'LOGOUT':
      return { ...state, isAuthenticated: false, user: null };
    case 'SET_DRUGSTORES':
      return { ...state, drugstores: action.payload };
    case 'SET_ACTIVE_PROCESS':
      return { ...state, activeProcessId: action.payload.id, activeProcessName: action.payload.name };
    case 'START_NEW_PROCESS':
      return { ...state, activeProcessId: undefined, activeProcessName: undefined };
    case 'APPLY_REDISTRIBUTION':
      return { ...state };
    case 'MERGE_PRODUCT_OVERRIDES':
      return { ...state, productOverrides: { ...state.productOverrides, ...action.payload } };
    case 'SET_DRUGSTORES_DATA':
      return { ...state, drugstores: action.payload.drugstores, familyMap: action.payload.familyMap };
    case 'SET_EXPORT_AFTER_SAVE':
      return { ...state, exportAfterSave: action.payload };
    case 'CLEAR_EXPORT_AFTER_SAVE':
      return { ...state, exportAfterSave: undefined };
    case 'UNLOCK_CONVERSION':
      return { ...state, canAccessConversion: true };
    case 'LOCK_CONVERSION':
      return { ...state, canAccessConversion: false };
    case 'SET_PRODUCTS':
      return { ...state, products: action.payload };
    case 'ADD_PRODUCTS':
      return { ...state, products: action.payload, isDataLoaded: true };
    case 'SET_PHARMACIES':
      return { ...state, pharmacies: action.payload };
    case 'SET_LABS':
      return { ...state, laboratories: action.payload };
    case 'SET_CONVERSION': {
      const { key, def } = action.payload;
      return { ...state, conversions: { ...state.conversions, [key]: def } };
    }
    case 'REMOVE_CONVERSION': {
      const { [action.payload.key]: _, ...rest } = state.conversions;
      return { ...state, conversions: rest };
    }
    case 'CLEAR_CONVERSIONS':
      return { ...state, conversions: {} };
    case 'CLEAR_ALL_DATA':
      return {
        ...state,
        products: [],
        conversions: {},
        productOverrides: {},
        exportAfterSave: undefined,
        isDataLoaded: false,
        canAccessConversion: false,
      };
    case 'SET_PRODUCT_OVERRIDE': {
      const { key, override } = action.payload;
      return {
        ...state,
        productOverrides: {
          ...state.productOverrides,
          [key]: { ...(state.productOverrides[key] || {}), ...override },
        },
      };
    }
    case 'CLEAR_PRODUCT_OVERRIDE': {
      const { [action.payload.key]: _removed, ...rest } = state.productOverrides;
      return { ...state, productOverrides: rest };
    }
    case 'SET_FAMILY_MAP':
      return { ...state, familyMap: action.payload };
    default:
      return state;
  }
}

// Normaliza productos importados para cumplir con el shape esperado por la app
export function normalizeProducts(input: any[]): Product[] {
  return (input || []).map((p, idx) => ({
    ...(p as any),
    id: String((p as any).id ?? idx),
    code: String((p as any).code ?? (p as any).CODIGO ?? ''),
    name: String((p as any).name ?? (p as any).DESCRIPCION ?? ''),
    unit: String((p as any).unit ?? (p as any).UNI_MED ?? ''),
  })) as unknown as Product[];
}

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
          const { products, conversions, productOverrides, drugstores, familyMap, exportAfterSave, canAccessConversion, isAuthenticated, user, activeProcessId, activeProcessName } = storedState as any;
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
              activeProcessId: activeProcessId ?? undefined,
              activeProcessName: activeProcessName ?? undefined,
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
          let [ds, fm] = await Promise.all([
            fetchDrugstores().catch(()=>[]),
            fetchFamilyMap().catch(()=>[]),
          ]);
          // Si Firestore está vacío, sembrar desde el JSON local una sola vez
          if ((Array.isArray(ds) && ds.length === 0) && (Array.isArray(fm) && fm.length === 0)) {
            try {
              await saveDrugstoresAndFamilies(defaultMap as Array<{ LABORATORIO: string; DROGUERIA: string }>);
              // recargar desde Firestore
              [ds, fm] = await Promise.all([
                fetchDrugstores().catch(()=>[]),
                fetchFamilyMap().catch(()=>[]),
              ]);
            } catch {}
          }
          // Si Firestore ya tiene datos pero faltan familias/droguerías del JSON, completar faltantes
          try {
            const existingFamSet = new Set<string>((Array.isArray(fm) ? fm : []).map((x:any)=> String(x.family||'').trim().toUpperCase()));
            const missing: Array<{ LABORATORIO: string; DROGUERIA: string }> = [];
            for (const row of (defaultMap as Array<{ LABORATORIO: string; DROGUERIA: string }>)) {
              const fam = String(row.LABORATORIO||'').trim();
              if (!fam) continue;
              if (!existingFamSet.has(fam.toUpperCase())) missing.push(row);
            }
            if (missing.length > 0) {
              await saveDrugstoresAndFamilies(missing);
              // recargar para incluir los nuevos
              [ds, fm] = await Promise.all([
                fetchDrugstores().catch(()=>[]),
                fetchFamilyMap().catch(()=>[]),
              ]);
            }
          } catch {}

          // Asegurar presencia de "sin-drogueria" y no duplicar
          const baseDs = Array.isArray(ds) ? ds : [];
          const withFallback = [{ id: 'sin-drogueria', name: 'Sin Droguería' }, ...baseDs.filter(d=>d.id!=='sin-drogueria')]
            .filter((v,i,a)=> a.findIndex(x=>x.id===v.id)===i);
          const fmList = Array.isArray(fm) ? (fm as any[]).map((x:any)=> ({ family: x.family, drugstoreId: x.drugstoreId })) : [];
          if (withFallback.length > 1 || fmList.length > 0) {
            dispatch({ type: 'SET_DRUGSTORES_DATA', payload: { drugstores: withFallback, familyMap: fmList } });
          }
        } catch {}
        // 5) Cargar overrides de producto desde Firestore
        try {
          const remoteOverrides = await fetchProductOverrides().catch(()=>({} as any));
          if (remoteOverrides && Object.keys(remoteOverrides).length > 0) {
            dispatch({ type: 'MERGE_PRODUCT_OVERRIDES', payload: remoteOverrides });
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
            // Escribir el estado completo en IndexedDB solo si hay productos
            if (currentHasProducts) {
              idbSet('pharmaCentralState', state).catch(() => {});
            }
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

export const useAppState = (): AppState => {
  const context = useContext(AppStateContext);
  if (context === undefined) {
    throw new Error("useAppState must be used within an AppProvider");
  }
  return context;
};

export const useAppDispatch = (): Dispatch<Action> => {
  const context = useContext(AppDispatchContext);
  if (context === undefined) {
    throw new Error("useAppDispatch must be used within an AppProvider");
  }
  return context;
};
