"use client";

import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useProcessPersistence } from '@/hooks/use-process-persistence';
import { Loader2 } from 'lucide-react';

interface SaveProcessDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveSuccess?: () => void;
}

export function SaveProcessDialog({ open, onOpenChange, onSaveSuccess }: SaveProcessDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const { saveProcess, loading } = useProcessPersistence();

  const handleSave = async () => {
    try {
      await saveProcess(name, description);
      setName('');
      setDescription('');
      onOpenChange(false);
      onSaveSuccess?.();
    } catch (error) {
      // Los errores ya son manejados por el hook
    }
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen && !loading) {
        setName('');
        setDescription('');
      }
      onOpenChange(isOpen);
    }}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Guardar Proceso</DialogTitle>
          <DialogDescription>
            Guarda el estado actual del Trabajo para continuar más tarde.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre del proceso *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Pedido Semana 15-21 Octubre"
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descripción (opcional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Agrega una descripción para identificar este proceso..."
              rows={3}
              disabled={loading}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={loading || !name.trim()}
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              'Guardar Proceso'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

