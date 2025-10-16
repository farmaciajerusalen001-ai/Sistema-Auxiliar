"use client";

import { useCallback } from 'react';
import { useAppState, useAppDispatch } from '@/lib/store';
import { useRealtimeDB } from './use-realtime-db';
import { useToast } from './use-toast';
import type { Product, Pharmacy, Laboratory } from '@/lib/types';

export interface SavedProcess {
  id: string;
  name: string;
  description?: string;
  products: Product[];
  pharmacies: Pharmacy[];
  laboratories: Laboratory[];
  drugstores: { id: string; name: string }[];
  familyMap: { family: string; drugstoreId: string }[];
  conversions?: Record<string, { sourceUnit: string; targetUnit: string; factor: number; comment?: string }>;
  // Compat: antes se guardaba como Record con claves potencialmente inválidas para Firebase
  productOverrides?: Record<string, { drugstoreId?: string; laboratory?: string }>;
  // Nuevo formato seguro para Firebase: array de entries
  productOverridesArr?: Array<{ key: string; drugstoreId?: string; laboratory?: string }>;
  canAccessConversion?: boolean;
  createdAt: number;
  updatedAt: number;
}

// Type guard para validar la estructura de un proceso guardado
function isValidSavedProcess(obj: any): obj is SavedProcess {
  return (
    obj &&
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.name === 'string' &&
    typeof obj.createdAt === 'number' &&
    typeof obj.updatedAt === 'number'
  );
}

export const useProcessPersistence = () => {
  const { products, pharmacies, laboratories, drugstores, familyMap, conversions, productOverrides, canAccessConversion } = useAppState();
  const dispatch = useAppDispatch();
  const { toast } = useToast();
  
  const {
    saveProcess: saveToRealtimeDB,
    updateProcess: updateInRealtimeDB,
    getProcess: getFromRealtimeDB,
    listProcesses: listFromRealtimeDB,
    deleteProcess: deleteFromRealtimeDB,
    loading,
    error,
  } = useRealtimeDB();

  // Cargar lista de procesos guardados
  const loadSavedProcesses = useCallback((callback: (processes: SavedProcess[]) => void) => {
    return listFromRealtimeDB((processes: unknown) => {
      if (!Array.isArray(processes)) {
        console.error('Formato de datos inválido al cargar procesos');
        return callback([]);
      }
      
      const normalized = (processes as any[]).map((p) => ({
        ...p,
        products: Array.isArray(p.products) ? p.products : [],
        pharmacies: Array.isArray(p.pharmacies) ? p.pharmacies : [],
        laboratories: Array.isArray(p.laboratories) ? p.laboratories : [],
        drugstores: Array.isArray(p.drugstores) ? p.drugstores : [],
        familyMap: Array.isArray(p.familyMap) ? p.familyMap : [],
      }));
      const validProcesses = normalized.filter(isValidSavedProcess);
      const sortedProcesses = [...validProcesses].sort(
        (a, b) => b.createdAt - a.createdAt
      );
      
      callback(sortedProcesses);
    });
  }, [listFromRealtimeDB, loading]);

  // Cargar un proceso específico
  const loadProcess = useCallback(async (processId: string): Promise<boolean> => {
    if (!processId || typeof processId !== 'string') {
      toast({
        title: "Error",
        description: "ID de proceso no válido",
        variant: "destructive",
      });
      return false;
    }

    try {
      const process = await getFromRealtimeDB(processId);
      
      if (!process) {
        throw new Error('Proceso no encontrado');
      }

      if (!isValidSavedProcess(process)) {
        throw new Error('Formato de proceso inválido');
      }

      // Reconstruir productOverrides desde el formato array si existe (compatibilidad hacia atrás)
      let overrides: Record<string, { drugstoreId?: string; laboratory?: string }> = {};
      if (Array.isArray((process as any).productOverridesArr)) {
        overrides = (process as any).productOverridesArr.reduce((acc: any, it: any) => {
          if (!it || typeof it.key !== 'string') return acc;
          const { key, drugstoreId, laboratory } = it as any;
          acc[key] = {};
          if (typeof drugstoreId === 'string' && drugstoreId) acc[key].drugstoreId = drugstoreId;
          if (typeof laboratory === 'string' && laboratory) acc[key].laboratory = laboratory;
          return acc;
        }, {} as Record<string, { drugstoreId?: string; laboratory?: string }>);
      } else if (process.productOverrides && typeof process.productOverrides === 'object') {
        overrides = process.productOverrides as any;
      }

      // Rehidratar todo el estado relevante de una vez
      dispatch({
        type: 'REHYDRATE',
        payload: {
          products: Array.isArray(process.products) ? process.products : [],
          pharmacies: Array.isArray(process.pharmacies) ? process.pharmacies : [],
          laboratories: Array.isArray(process.laboratories) ? process.laboratories : [],
          drugstores: Array.isArray(process.drugstores) ? process.drugstores : [],
          familyMap: Array.isArray(process.familyMap) ? process.familyMap : [],
          conversions: process.conversions || {},
          productOverrides: overrides || {},
          canAccessConversion: !!process.canAccessConversion,
        }
      });
      // establecer proceso activo
      dispatch({ type: 'SET_ACTIVE_PROCESS', payload: { id: processId, name: process.name } });
      
      toast({
        title: "Proceso cargado",
        description: `"${process.name}" ha sido cargado correctamente.`,
      });
      
      return true;
    } catch (err) {
      console.error("Error al cargar el proceso:", err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "No se pudo cargar el proceso. Por favor, inténtalo de nuevo.",
        variant: "destructive",
      });
      return false;
    }
  }, [dispatch, getFromRealtimeDB, toast]);

  // Validar datos del proceso antes de guardar/actualizar
  const validateProcessData = (data: any) => {
    if (!data) throw new Error('Datos del proceso no proporcionados');
    if (!data.name || typeof data.name !== 'string' || !data.name.trim()) {
      throw new Error('El nombre del proceso es obligatorio');
    }
    return true;
  };

  // Guardar un nuevo proceso
  const saveProcess = useCallback(async (name: string, description: string = ''): Promise<string | false> => {
    if (loading) return false;
    
    try {
      validateProcessData({ name });
      
      // Guardar productOverrides como array de entries (sin propiedades undefined)
      const productOverridesArr = Object.entries(productOverrides || {}).map(([key, ov]) => {
        const item: any = { key };
        const ds = typeof ov?.drugstoreId === 'string' ? ov!.drugstoreId!.trim() : '';
        const lab = typeof ov?.laboratory === 'string' ? ov!.laboratory!.trim() : '';
        if (ds) item.drugstoreId = ds;
        if (lab) item.laboratory = lab;
        return item;
      });
      const processData = {
        name: name.trim(),
        description: description.trim(),
        products: Array.isArray(products) ? products : [],
        pharmacies: Array.isArray(pharmacies) ? pharmacies : [],
        laboratories: Array.isArray(laboratories) ? laboratories : [],
        drugstores: Array.isArray(drugstores) ? drugstores : [],
        familyMap: Array.isArray(familyMap) ? familyMap : [],
        conversions: conversions || {},
        // Compat: no enviar el objeto con claves arbitrarias al backend
        // productOverrides: productOverrides || {},
        productOverridesArr,
        canAccessConversion: !!canAccessConversion,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      
      const saved = await saveToRealtimeDB(processData);
      
      // activar el proceso recién guardado
      if (saved && (saved as any).id) {
        dispatch({ type: 'SET_ACTIVE_PROCESS', payload: { id: (saved as any).id as string, name } });
      }
      toast({
        title: "Proceso guardado",
        description: `"${name}" ha sido guardado correctamente.`,
      });
      
      return (saved as any)?.id || false;
    } catch (err) {
      console.error("Error al guardar el proceso:", err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "No se pudo guardar el proceso. Por favor, inténtalo de nuevo.",
        variant: "destructive",
      });
      return false;
    }
  }, [products, pharmacies, laboratories, drugstores, familyMap, saveToRealtimeDB, toast, loading]);

  // Actualizar un proceso existente
  const updateProcess = useCallback(async (processId: string, name: string, description: string = '') => {
    if (loading) return false;
    
    try {
      if (!processId) throw new Error('ID de proceso no válido');
      validateProcessData({ name });
      
      const productOverridesArr = Object.entries(productOverrides || {}).map(([key, ov]) => {
        const item: any = { key };
        const ds = typeof ov?.drugstoreId === 'string' ? ov!.drugstoreId!.trim() : '';
        const lab = typeof ov?.laboratory === 'string' ? ov!.laboratory!.trim() : '';
        if (ds) item.drugstoreId = ds;
        if (lab) item.laboratory = lab;
        return item;
      });
      const updates = {
        name: name.trim(),
        description: description.trim(),
        products: Array.isArray(products) ? products : [],
        pharmacies: Array.isArray(pharmacies) ? pharmacies : [],
        laboratories: Array.isArray(laboratories) ? laboratories : [],
        drugstores: Array.isArray(drugstores) ? drugstores : [],
        familyMap: Array.isArray(familyMap) ? familyMap : [],
        conversions: conversions || {},
        // productOverrides: productOverrides || {},
        productOverridesArr,
        canAccessConversion: !!canAccessConversion,
        updatedAt: Date.now(),
      };
      
      await updateInRealtimeDB(processId, updates);
      
      toast({
        title: "Proceso actualizado",
        description: `"${name}" ha sido actualizado correctamente.`,
      });
      
      return true;
    } catch (err) {
      console.error("Error al actualizar el proceso:", err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "No se pudo actualizar el proceso. Por favor, inténtalo de nuevo.",
        variant: "destructive",
      });
      return false;
    }
  }, [products, pharmacies, laboratories, drugstores, familyMap, updateInRealtimeDB, toast, loading]);

  // Eliminar un proceso
  const deleteProcess = useCallback(async (processId: string, processName: string = '') => {
    if (loading) return false;
    
    try {
      if (!processId) throw new Error('ID de proceso no válido');
      
      await deleteFromRealtimeDB(processId);
      
      toast({
        title: "Proceso eliminado",
        description: `"${processName || 'El proceso'}" ha sido eliminado correctamente.`,
      });
      
      return true;
    } catch (err) {
      console.error("Error al eliminar el proceso:", err);
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "No se pudo eliminar el proceso. Por favor, inténtalo de nuevo.",
        variant: "destructive",
      });
      return false;
    }
  }, [deleteFromRealtimeDB, toast, loading]);

  return {
    saveProcess,
    updateProcess,
    loadProcess,
    loadSavedProcesses,
    deleteProcess,
    loading,
    error,
  };
};