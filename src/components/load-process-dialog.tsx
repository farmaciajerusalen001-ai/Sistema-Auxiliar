"use client";

import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useProcessPersistence } from '@/hooks/use-process-persistence';
import { useToast } from '@/hooks/use-toast';
import { SavedProcess } from '@/hooks/use-process-persistence';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Download, Trash2, Calendar, FileText } from 'lucide-react';

interface LoadProcessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function LoadProcessDialog({ open, onOpenChange }: LoadProcessDialogProps) {
  const [processes, setProcesses] = useState<SavedProcess[]>([]);
  const { loadSavedProcesses, loadProcess, deleteProcess, loading } = useProcessPersistence();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const isMounted = useRef(false);

  // Cargar procesos cuando se abre el diálogo
  useEffect(() => {
    if (!open) {
      setProcesses([]);
      return;
    }

    // Evitar múltiples cargas
    if (isMounted.current) return;
    isMounted.current = true;

    const loadProcesses = async () => {
      setIsLoading(true);
      try {
        const unsubscribe = await loadSavedProcesses((savedProcesses) => {
          setProcesses(savedProcesses);
          setIsLoading(false);
        });
        return unsubscribe;
      } catch (error) {
        console.error('Error loading processes:', error);
        setIsLoading(false);
        return null;
      }
    };

    let unsubscribe: (() => void) | null | undefined = null;
    loadProcesses().then((unsub) => {
      unsubscribe = unsub;
    });

    return () => {
      isMounted.current = false;
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [open]); // Solo dependemos de 'open'

  const handleLoad = async (process: SavedProcess) => {
    try {
      await loadProcess(process.id);
      toast({
        title: 'Proceso cargado',
        description: `Se cargó "${process.name}" correctamente`,
      });
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo cargar el proceso',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (processId: string, processName: string) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar "${processName}"?`)) return;
    
    try {
      await deleteProcess(processId, processName);
      toast({
        title: 'Eliminado',
        description: `"${processName}" ha sido eliminado correctamente`,
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el proceso',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Cargar proceso guardado</DialogTitle>
          <DialogDescription>
            Selecciona un proceso guardado para continuar trabajando en él.
          </DialogDescription>
        </DialogHeader>
        
        <div className="mt-4 space-y-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-8 space-y-4">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-300 border-t-blue-500"></div>
              <p className="text-gray-500">Cargando procesos guardados...</p>
            </div>
          ) : processes.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No hay procesos guardados</h3>
              <p className="mt-1 text-sm text-gray-500">Guarda un proceso para verlo aquí.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2">
              {processes.map((process) => (
                <div
                  key={process.id}
                  className="flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="min-w-0">
                    <h4 className="font-medium truncate">{process.name}</h4>
                    {process.description && (
                      <p className="text-sm text-gray-500 truncate">{process.description}</p>
                    )}
                    <div className="flex items-center mt-1 text-xs text-gray-500">
                      <Calendar className="h-3.5 w-3.5 mr-1 flex-shrink-0" />
                      <span className="truncate">
                        {formatDistanceToNow(new Date(process.createdAt), {
                          addSuffix: true,
                          locale: es
                        })}
                      </span>
                    </div>
                  </div>
                  <div className="flex space-x-2 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleLoad(process)}
                      disabled={loading}
                      className="whitespace-nowrap"
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Cargar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                      onClick={() => handleDelete(process.id, process.name)}
                      disabled={loading}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}