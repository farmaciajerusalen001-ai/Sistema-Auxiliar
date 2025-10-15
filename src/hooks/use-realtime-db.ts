"use client";

import { useState, useEffect, useCallback } from 'react';
import { ref, set, get, push, update, remove, onValue, off, DataSnapshot } from 'firebase/database';
import { realtimeDb } from '@/lib/firebase';
import { useToast } from './use-toast';

// Tipos de datos
interface ProcessData {
  id?: string;
  name: string;
  description?: string;
  products?: any[]; // puede ir a chunks
  pharmacies: any[];
  laboratories: any[];
  drugstores: Array<{ id: string; name: string }>;
  familyMap: Array<{ family: string; drugstoreId: string }>;
  createdAt: number;
  updatedAt: number;
}

// --- Helpers para chunking de productos grandes ---
const MAX_CHUNK_SIZE = 900_000; // aprox ~900KB por chunk de string JSON
function chunkString(str: string, size: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < str.length; i += size) out.push(str.slice(i, i + size));
  return out;
}

async function writeProductsChunks(processId: string, products: any[] | undefined): Promise<{ chunks?: number; jsonLength?: number } | undefined> {
  if (!products || !Array.isArray(products)) return undefined;
  const json = JSON.stringify(products);
  const chunks = chunkString(json, MAX_CHUNK_SIZE);
  const baseRef = ref(realtimeDb, `processes/${processId}/productsChunks`);
  // Limpiar previos
  await remove(baseRef).catch(() => {});
  const updates: Record<string, any> = {};
  chunks.forEach((c, i) => {
    updates[`processes/${processId}/productsChunks/${i}`] = c;
  });
  await update(ref(realtimeDb), updates);
  return { chunks: chunks.length, jsonLength: json.length };
}

async function readProductsChunks(processId: string): Promise<any[] | null> {
  const baseRef = ref(realtimeDb, `processes/${processId}/productsChunks`);
  const snap = await get(baseRef);
  if (!snap.exists()) return null;
  const obj = snap.val() as Record<string, string>;
  const ordered = Object.keys(obj)
    .sort((a, b) => Number(a) - Number(b))
    .map(k => obj[k]);
  const json = ordered.join('');
  try {
    const arr = JSON.parse(json);
    return Array.isArray(arr) ? arr : null;
  } catch {
    return null;
  }
}

export const useRealtimeDB = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Guardar un nuevo proceso
  const saveProcess = async (processData: Omit<ProcessData, 'id' | 'createdAt' | 'updatedAt'>) => {
    setLoading(true);
    setError(null);
    
    try {
      const processesRef = ref(realtimeDb, 'processes');
      const newProcessRef = push(processesRef);
      
      const newId = newProcessRef.key as string;
      const meta: any = {
        ...processData,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      // No permitir undefined en Firebase: remover 'products' del objeto principal
      if (typeof meta.products !== 'undefined') {
        delete meta.products;
      }
      await set(newProcessRef, meta);
      // escribir productos por chunks
      await writeProductsChunks(newId, processData.products);
      
      toast({
        title: "¡Éxito!",
        description: "El proceso se ha guardado correctamente.",
      });
      
      return { id: newId, ...meta };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al guardar el proceso';
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Actualizar un proceso existente
  const updateProcess = async (processId: string, updates: Partial<ProcessData>) => {
    setLoading(true);
    setError(null);
    
    try {
      const processRef = ref(realtimeDb, `processes/${processId}`);
      // separar productos del resto
      const { products, ...rest } = updates;
      await update(processRef, {
        ...rest,
        updatedAt: Date.now(),
      });
      if (products !== undefined) {
        await writeProductsChunks(processId, products);
      }
      
      toast({
        title: "¡Actualizado!",
        description: "El proceso se ha actualizado correctamente.",
      });
      
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al actualizar el proceso';
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Obtener un proceso por ID
  const getProcess = async (processId: string): Promise<ProcessData | null> => {
    setLoading(true);
    setError(null);
    
    try {
      const processRef = ref(realtimeDb, `processes/${processId}`);
      const snapshot = await get(processRef);
      
      if (snapshot.exists()) {
        const meta = snapshot.val();
        // reconstruir productos desde chunks
        const products = await readProductsChunks(processId);
        return { id: processId, ...meta, products: products ?? [] };
      }
      
      return null;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al obtener el proceso';
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Listar todos los procesos
  const listProcesses = (callback: (processes: ProcessData[]) => void) => {
    const processesRef = ref(realtimeDb, 'processes');
    
    const onDataChange = (snapshot: DataSnapshot) => {
      const processes: ProcessData[] = [];
      
      snapshot.forEach((childSnapshot) => {
        processes.push({
          id: childSnapshot.key,
          ...childSnapshot.val(),
        });
      });
      
      // Ordenar por fecha de creación (más reciente primero)
      processes.sort((a, b) => b.createdAt - a.createdAt);
      
      callback(processes);
    };
    
    onValue(processesRef, onDataChange);
    
    // Retornar función de limpieza
    return () => {
      off(processesRef, 'value', onDataChange);
    };
  };

  // Eliminar un proceso
  const deleteProcess = async (processId: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const processRef = ref(realtimeDb, `processes/${processId}`);
      await remove(processRef);
      
      toast({
        title: "Eliminado",
        description: "El proceso se ha eliminado correctamente.",
      });
      
      return true;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al eliminar el proceso';
      setError(errorMessage);
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return {
    saveProcess,
    updateProcess,
    getProcess,
    listProcesses,
    deleteProcess,
    loading,
    error,
  };
};
