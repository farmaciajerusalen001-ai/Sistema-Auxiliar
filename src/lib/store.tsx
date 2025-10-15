
"use client";

import React, { createContext, useContext, useReducer, ReactNode, Dispatch, useEffect } from "react";
import type { Product, Pharmacy, Laboratory } from "./types";
import { pharmacies as initialPharmacies, laboratories as initialLaboratories } from "./data";
import { idbGet, idbSet, idbDel } from "@/lib/idb";

interface AppState {
  products: Product[];
  pharmacies: Pharmacy[];
  laboratories: Laboratory[];
  isDataLoaded: boolean;
  isAuthenticated: boolean;
  user?: { username: string } | null;
  canAccessConversion: boolean;
  conversions: Record<string, { sourceUnit: string; targetUnit: string; factor: number; comment?: string }>;
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
  | { type: "ADD_PRODUCTS"; payload: Product[] }
  | { type: "REHYDRATE"; payload: Partial<AppState> }
  | { type: "ADD_PRODUCT"; payload: Product }
  | { type: "UPDATE_PRODUCT"; payload: Product }
  | { type: "DELETE_PRODUCT"; payload: string }
  | { type: "SET_DATA_LOADED"; payload: boolean }
  | { type: "CLEAR_PRODUCTS" }
  | { type: "SET_CONVERSION"; payload: { key: string; def: { sourceUnit: string; targetUnit: string; factor: number; comment?: string } } }
  | { type: "REMOVE_CONVERSION"; payload: { key: string } }
  | { type: "CLEAR_CONVERSIONS" }
  | { type: "SET_PRODUCT_OVERRIDE"; payload: { key: string; override: { drugstoreId?: string; laboratory?: string } } }
  | { type: "CLEAR_PRODUCT_OVERRIDE"; payload: { key: string } }
  | { type: "CLEAR_ALL_DATA" }
  | { type: "SET_DRUGSTORES_DATA"; payload: { drugstores: { id: string; name: string }[]; familyMap: { family: string; drugstoreId: string }[] } }
  | { type: "SET_PHARMACIES"; payload: Pharmacy[] }
  | { type: "SET_LABORATORIES"; payload: Laboratory[] }
  | { type: "SET_DRUGSTORES"; payload: { id: string; name: string }[] }
  | { type: "SET_FAMILY_MAP"; payload: { family: string; drugstoreId: string }[] }
  | { type: "APPLY_REDISTRIBUTION"; payload: { moves: Array<{ CODIGO?: string; Producto?: string; FromId: string; ToId: string; Cantidad: number }>; updates: Array<{ CODIGO?: string; Producto?: string; SucursalId: string; NuevoAPedir: number }>; } }
  | { type: "LOGIN_SUCCESS"; payload: { username: string } }
  | { type: "LOGOUT" }
  | { type: "UNLOCK_CONVERSION" }
  | { type: "LOCK_CONVERSION" }
  | { type: "SET_EXPORT_AFTER_SAVE"; payload: { page: 'consolidated' | 'drugstores', type: 'excel' | 'pdf', params?: any, filteredProducts?: string[] } }
  | { type: "CLEAR_EXPORT_AFTER_SAVE" }
  | { type: "SET_ACTIVE_PROCESS"; payload: { id: string; name: string } }
  | { type: "CLEAR_ACTIVE_PROCESS" };

const initialState: AppState = {
  products: [],
  pharmacies: initialPharmacies,
  laboratories: initialLaboratories,
  isDataLoaded: false,
  isAuthenticated: false,
  user: null,
  canAccessConversion: false,
  conversions: {},
  drugstores: [],
  familyMap: [],
  productOverrides: {},
};

const AppStateContext = createContext<AppState>(initialState);
const AppDispatchContext = createContext<Dispatch<Action>>(() => null);

// Helpers to normalize product data
export const normalizeProduct = (p: Product): Product => {
  return {
    ...p,
    id: p.id ?? String(Math.random()).slice(2, 9),
    unit: p.unit ?? "Unidad",
    quantity: (() => {
      const q = Number(p.quantity ?? 0);
      return Number.isNaN(q) ? 0 : q;
    })(),
  };
};

export const normalizeProducts = (items: Product[]) => items.map(normalizeProduct);

const appReducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case "REHYDRATE": {
      const incoming = action.payload as any;
      // Mantener catálogos frescos desde initialPharmacies/Laboratories
      return {
        ...state,
        ...incoming,
        products: Array.isArray(incoming?.products) ? normalizeProducts(incoming.products as any) : state.products,
        pharmacies: initialPharmacies,
        laboratories: initialLaboratories,
        isDataLoaded: Array.isArray(incoming?.products) ? true : state.isDataLoaded,
      };
    }
    case "ADD_PRODUCTS":
      // Replace existing products with the new import (normalized)
      return { ...state, products: normalizeProducts(action.payload), isDataLoaded: true };
    case "CLEAR_PRODUCTS":
        return { ...state, products: [], isDataLoaded: false };
    case "ADD_PRODUCT":
      return { ...state, products: [...state.products, normalizeProduct(action.payload)] };
    case "UPDATE_PRODUCT":
      return {
        ...state,
        products: state.products.map((p) =>
          p.id === action.payload.id ? normalizeProduct(action.payload) : p
        ),
      };
    case "DELETE_PRODUCT":
      return {
        ...state,
        products: state.products.filter((p) => p.id !== action.payload),
      };
    case "SET_DATA_LOADED":
      return { ...state, isDataLoaded: action.payload };
    case "SET_CONVERSION": {
      const { key, def } = action.payload;
      return { ...state, conversions: { ...state.conversions, [key]: { ...def } } };
    }
    case "REMOVE_CONVERSION": {
      const { key } = action.payload;
      const { [key]: _, ...rest } = state.conversions;
      return { ...state, conversions: rest };
    }
    case "CLEAR_CONVERSIONS": {
      return { ...state, conversions: {} };
    }
    case "CLEAR_ALL_DATA": {
      // Limpia todo lo relacionado con una importación previa
      return {
        ...state,
        products: [],
        isDataLoaded: false,
        conversions: {},
        productOverrides: {},
        exportAfterSave: undefined,
        canAccessConversion: false,
        // mantener el proceso activo, no lo limpiamos aquí
      };
    }
    case "SET_PRODUCT_OVERRIDE": {
      const { key, override } = action.payload;
      return { ...state, productOverrides: { ...state.productOverrides, [key]: { ...state.productOverrides[key], ...override } } };
    }
    case "CLEAR_PRODUCT_OVERRIDE": {
      const { key } = action.payload;
      const { [key]: _, ...rest } = state.productOverrides;
      return { ...state, productOverrides: rest };
    }
    case "SET_DRUGSTORES_DATA": {
      const { drugstores, familyMap } = action.payload;
      return { ...state, drugstores, familyMap };
    }
    case "LOGIN_SUCCESS": {
      const { username } = action.payload;
      return { ...state, isAuthenticated: true, user: { username } };
    }
    case "LOGOUT": {
      return { ...state, isAuthenticated: false, user: null, canAccessConversion: false };
    }
    case "UNLOCK_CONVERSION": {
      return { ...state, canAccessConversion: true };
    }
    case "LOCK_CONVERSION": {
      return { ...state, canAccessConversion: false };
    }
    case "SET_EXPORT_AFTER_SAVE": {
      return { ...state, exportAfterSave: action.payload };
    }
    case "CLEAR_EXPORT_AFTER_SAVE": {
      return { ...state, exportAfterSave: undefined };
    }
    case "SET_ACTIVE_PROCESS": {
      return { ...state, activeProcessId: action.payload.id, activeProcessName: action.payload.name };
    }
    case "CLEAR_ACTIVE_PROCESS": {
      return { ...state, activeProcessId: undefined, activeProcessName: undefined };
    }
    case "SET_PHARMACIES": {
      return { ...state, pharmacies: action.payload };
    }
    case "SET_LABORATORIES": {
      return { ...state, laboratories: action.payload };
    }
    case "SET_DRUGSTORES": {
      return { ...state, drugstores: action.payload };
    }
    case "SET_FAMILY_MAP": {
      return { ...state, familyMap: action.payload };
    }
    case "APPLY_REDISTRIBUTION": {
      const { moves, updates } = action.payload;
      const clone = state.products.map(p => ({ ...p } as any));
      const keyOf = (p: any) => {
        const code = String(p.CODIGO ?? p.code ?? '').trim();
        const desc = String(p.DESCRIPCION ?? p.name ?? '').trim();
        return code || desc;
      };
      const index = new Map<string, number>(); // key|branch -> idx
      for (let i = 0; i < clone.length; i++) {
        const p: any = clone[i];
        const k = keyOf(p);
        const branch = String(p.pharmacy ?? '').trim();
        if (!k || !branch) continue;
        index.set(`${k}|${branch}`, i);
      }

      // Apply existence transfers
      for (const m of moves) {
        const key = String(m.CODIGO ?? m.Producto ?? '').trim();
        if (!key) continue;
        const fromIdx = index.get(`${key}|${m.FromId}`);
        const toIdx = index.get(`${key}|${m.ToId}`);
        if (fromIdx !== undefined) {
          const row = clone[fromIdx];
          const cur = Number(row.EXISTENCIA ?? row.EXISTEN ?? row.STOCK ?? 0);
          row.EXISTENCIA = Math.max(0, cur - m.Cantidad);
        }
        if (toIdx !== undefined) {
          const row = clone[toIdx];
          const cur = Number(row.EXISTENCIA ?? row.EXISTEN ?? row.STOCK ?? 0);
          row.EXISTENCIA = cur + m.Cantidad;
        }
      }

      // Apply new A_PEDIR per branch
      for (const u of updates) {
        const key = String(u.CODIGO ?? u.Producto ?? '').trim();
        if (!key) continue;
        const idx = index.get(`${key}|${u.SucursalId}`);
        if (idx !== undefined) {
          const row = clone[idx];
          row.A_PEDIR = u.NuevoAPedir;
        }
      }

      return { ...state, products: clone };
    }
    default:
      return state;
  }
}
;

const getInitialState = (): AppState => {
  if (typeof window === 'undefined') {
    return initialState;
  }
  try {
    const item = window.localStorage.getItem('pharmaCentralState');
    const backup = window.localStorage.getItem('pharmaCentralBackup');
    const parsedItem = item ? JSON.parse(item) : (backup ? JSON.parse(backup) : initialState);
    // Ensure static data is always fresh, but keep products from storage
    let storedProducts = Array.isArray(parsedItem.products) ? normalizeProducts(parsedItem.products) : [];
    // Si en localStorage solo guardamos metadatos, no usar esos productos
    if (storedProducts.length > 0 && (parsedItem.productsCountMeta || (parsedItem.products?.[0] && parsedItem.products[0]._meta))) {
      storedProducts = [];
    }
    // Fallback to backup products if primary has none
    if ((!storedProducts || storedProducts.length === 0) && backup) {
      try {
        const parsedBackup = JSON.parse(backup);
        if (Array.isArray(parsedBackup.products) && parsedBackup.products.length > 0) {
          storedProducts = normalizeProducts(parsedBackup.products);
        }
      } catch {}
    }
    return {
      ...initialState, // Start with default pharmacies and labs
      ...parsedItem,   // Override with stored data (which includes products)
      products: storedProducts,
      pharmacies: initialPharmacies, // Explicitly set fresh pharmacies
      laboratories: initialLaboratories, // Explicitly set fresh labs
    };
  } catch (error) {
    console.warn('Error reading localStorage:', error);
    return initialState;
  }
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
