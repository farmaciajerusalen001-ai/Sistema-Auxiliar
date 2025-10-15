"use client";

import { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Save, FolderOpen } from 'lucide-react';
import { SaveProcessDialog } from '@/components/save-process-dialog';
import { LoadProcessDialog } from '@/components/load-process-dialog';
import { useAppState } from '@/lib/store';
import { useProcessPersistence } from '@/hooks/use-process-persistence';

export function ProcessHeader() {
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const { activeProcessId, activeProcessName } = useAppState();
  const { updateProcess, loading } = useProcessPersistence();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const canUpdate = useMemo(() => mounted && !!activeProcessId, [mounted, activeProcessId]);
  const currentName = useMemo(() => activeProcessName || 'Proceso actual', [activeProcessName]);

  const handleUpdate = async () => {
    if (!activeProcessId) {
      setSaveDialogOpen(true);
      return;
    }
    await updateProcess(activeProcessId, currentName);
  };

  return (
    <>
      <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-semibold">Studio 2.0</h1>
            {canUpdate && (
              <span className="text-sm text-muted-foreground">{currentName}</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLoadDialogOpen(true)}
            >
              <FolderOpen className="h-4 w-4 mr-2" />
              Cargar Proceso
            </Button>
            {canUpdate && (
              <Button size="sm" onClick={handleUpdate} disabled={loading}>
                <Save className="h-4 w-4 mr-2" />
                Guardar
              </Button>
            )}
            <Button size="sm" variant={canUpdate ? "outline" : "default"} onClick={() => setSaveDialogOpen(true)} disabled={loading}>
              <Save className="h-4 w-4 mr-2" />
              {canUpdate ? 'Guardar como…' : 'Guardar Proceso'}
            </Button>
          </div>
        </div>
      </div>

      <SaveProcessDialog
        open={saveDialogOpen}
        onOpenChange={setSaveDialogOpen}
      />

      <LoadProcessDialog
        open={loadDialogOpen}
        onOpenChange={setLoadDialogOpen}
      />
    </>
  );
}
