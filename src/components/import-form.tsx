"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { idbSet } from "@/lib/idb";
import { useRouter } from "next/navigation";
import { useAppDispatch, useAppState } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { FileUp, Loader2, UploadCloud, X } from "lucide-react";
import * as XLSX from "xlsx";

// Parse numbers written with either comma or dot decimals and optional thousands separators
const parseExcelNumber = (raw: string): number => {
  const s = String(raw ?? "").trim();
  if (s === "") return NaN;
  // patterns:
  // 1) 1.234,56  -> thousands with dot, decimal with comma
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) {
    const t = s.replace(/\./g, "").replace(",", ".");
    return parseFloat(t);
  }
  // 2) 1,234.56  -> thousands with comma, decimal with dot
  if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) {
    const t = s.replace(/,/g, "");
    return parseFloat(t);
  }
  // 3) only comma (decimal) e.g. 12,5
  if (/^[-+]?\d+(,\d+)?$/.test(s)) {
    return parseFloat(s.replace(",", "."));
  }
  // 4) only dot or plain number
  return parseFloat(s);
};

function mapHeaderToCanonical(h: string) {
  if (!h) return h;
  const s = String(h).trim().toUpperCase().replace(/\s+/g, "_").replace(/\./g, "_");
  
  // Mapeo específico de columnas del Excel
  if (s.includes("COD") || s === "CODE" || s === "ID") return "CODIGO";
  if (s.includes("DESCRIPCION") || s.includes("DESCRIP")) return "DESCRIPCION";
  if (s.includes("FAMILIA") || s.includes("FAMILY")) return "FAMILIA";
  if (s.includes("VALOR") && s.includes("UNIT")) return "VALOR_UNIT";
  if (s.includes("EXISTEN") || s.includes("STOCK") || s.includes("EXISTENCIA")) return "EXISTENCIA";
  if (s.includes("PROM") && s.includes("MENS")) return "VTA_PROMMENSUAL";
  if (s.includes("COBERTURA")) return "COBERTURA";
  if (s.includes("PEDIR") || s === "A_PEDIR") return "A_PEDIR";
  if (s.includes("UNIMED") || s.includes("UNI_MED") || (s.includes("UNI") && s.includes("MED")) || s === "UNI_MED" || s.includes("UNIDAD") || s.includes("UNIT")) return "UNI_MED";
  
  // fallback: return normalized header
  return s;
}

export function ImportForm() {
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const dispatch = useAppDispatch();
  const appState = useAppState();
  const router = useRouter();
  const { toast } = useToast();


  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
        setFile(selectedFile);
        setFileName(selectedFile.name);
    }
  };

  const handleClearFile = () => {
    setFile(null);
    setFileName("");
    if(fileInputRef.current) {
        fileInputRef.current.value = "";
    }
  };

  const handleClearData = () => {
    // Limpia productos, conversiones, overrides y flags de exportación
    dispatch({ type: "CLEAR_ALL_DATA" });
    try { window.sessionStorage.removeItem('phc_prevProducts'); } catch {}
    handleClearFile();
    toast({
        title: "Datos eliminados",
        description: "Se reinició todo lo importado (productos, conversiones y overrides).",
    });
  }

  const handleImport = async () => {
    if (!file) {
      toast({
        variant: "destructive",
        title: "No se seleccionó ningún archivo",
        description: "Por favor, selecciona un archivo de Excel para importar.",
      });
      return;
    }

    setIsLoading(true);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const allProducts: any[] = [];

          for (const sheetNameRaw of workbook.SheetNames) {
            const sheetName = String(sheetNameRaw || "").trim();
            console.log("Processing sheet:", sheetName);
            const worksheet = workbook.Sheets[sheetNameRaw];
            
            // Leer como array de arrays sin procesar
            const sheetArrays: any[] = XLSX.utils.sheet_to_json(worksheet, {
              header: 1,
              raw: false,
              defval: '' // Valor por defecto para celdas vacías
            });

            console.log("Total de filas en la hoja:", sheetArrays.length);
            console.log("Fila[0] muestra:", sheetArrays[0]);

            if (!sheetArrays || sheetArrays.length === 0) {
              console.log("Hoja vacía, saltando...");
              continue;
            }

            // Buscar dinámicamente la fila de encabezados (primer fila que contenga nombres de columnas conocidos)
            const looksLikeHeader = (row: any[]): boolean => {
              if (!Array.isArray(row)) return false;
              const tokens = row.map((v) => String(v || '').toUpperCase());
              const hits = tokens.filter((t) => (
                t.includes('COD') ||
                t.includes('DESCRIP') ||
                t.includes('FAMILIA') ||
                (t.includes('VALOR') && t.includes('UNIT')) ||
                t.includes('EXIST') ||
                (t.includes('PROM') && t.includes('MENS')) ||
                t.includes('COBERT') ||
                t.includes('PEDIR') ||
                t.includes('UNI')
              ));
              return hits.length >= 2; // al menos dos coincidencias típicas
            };

            let headerIndex = -1;
            for (let i = 0; i < Math.min(25, sheetArrays.length); i++) {
              if (looksLikeHeader(sheetArrays[i])) {
                headerIndex = i;
                break;
              }
            }

            if (headerIndex === -1) {
              console.warn(`No se detectaron encabezados en la hoja ${sheetName}. Saltando...`);
              continue;
            }

            const header = sheetArrays[headerIndex].map((h: any) => String(h || '').trim());
            console.log("Headers originales detectados:", header);
            const canonicalHeader = header.map((h: any) => mapHeaderToCanonical(String(h || '')).toUpperCase());
            console.log("Headers canónicos:", canonicalHeader);

            // Filas de datos a partir de la siguiente fila al header
            const dataRows = sheetArrays.slice(headerIndex + 1).filter((r) => {
              return Array.isArray(r) && r.some((c) => String(c ?? '').trim() !== '');
            });
            
            // Función para normalizar nombres eliminando espacios y caracteres especiales
            const normalizeName = (name: string) => name.toLowerCase().replace(/\s+/g, "").replace(/[^a-z0-9]/gi, "");

            const pharmacy = appState.pharmacies.find(p => normalizeName(p.name) === normalizeName(sheetName));
            console.log("Matched pharmacy:", pharmacy);

            const productsInSheet = dataRows.map((row: any, index) => {
              const productData: any = {};

              // Mapear cada columna a su nombre canónico
              header.forEach((colName: string, i: number) => {
                const canonical = canonicalHeader[i] || mapHeaderToCanonical(String(colName || "")).toUpperCase();
                let value = row[i]; // row es un array, acceder directamente por índice
                
                // Convertir valores numéricos escritos con coma o punto como decimal y guardar su forma original
                if (typeof value === 'string' && value.trim() !== '') {
                  const rawStr = String(value).trim();
                  const numValue = parseExcelNumber(rawStr);
                  if (!isNaN(numValue)) {
                    value = numValue;
                    // Guardar representación original para formato posterior
                    const srcKey = `${canonical}__SRC`;
                    productData[srcKey] = rawStr;
                  }
                }
                
                // Solo asignar si hay un valor
                if (value !== undefined && value !== null && value !== '') {
                  productData[canonical] = value;
                }
              });

              return productData;
            }).filter(p => p !== null && Object.keys(p).length > 0);

            console.log(`Products parsed in sheet ${sheetName}:`, productsInSheet.length);
            if (productsInSheet.length > 0) {
              console.log("Ejemplo de producto parseado:", productsInSheet[0]);
            }

            const productsWithIds = productsInSheet.map((normalizedProductData, index) => ({
              ...normalizedProductData,
              id: `${pharmacy?.id || sheetName}-${normalizedProductData['CODIGO'] || index}`,
              pharmacy: pharmacy ? pharmacy.id : sheetName,
            }));

            allProducts.push(...productsWithIds);
          }

          console.log("Total products to import:", allProducts.length);
          if (allProducts.length > 0) {
            console.log("Ejemplo de producto importado:", allProducts[0]);
          }

          // Normalizar campos adicionales si es necesario
          allProducts.forEach((raw) => {
            // Asegurar que UNI_MED esté disponible como 'unit' para el sistema
            if (raw['UNI_MED'] && !raw['unit']) {
              raw['unit'] = raw['UNI_MED'];
            }
            // Asegurar que CODIGO esté disponible como 'code' para el sistema
            if (raw['CODIGO'] && !raw['code']) {
              raw['code'] = raw['CODIGO'];
            }
            // Asegurar que DESCRIPCION esté disponible como 'name' para el sistema
            if (raw['DESCRIPCION'] && !raw['name']) {
              raw['name'] = raw['DESCRIPCION'];
            }
          });

          const { normalizeProducts } = await import("@/lib/store");
          const normalized = normalizeProducts(allProducts as any);
          
          console.log("Productos normalizados (primero):", normalized[0]);
          console.log("Todas las claves del primer producto:", Object.keys(normalized[0] || {}));
          
          dispatch({ type: "ADD_PRODUCTS", payload: normalized });

          toast({
            title: "Importación Exitosa",
            description: `${allProducts.length} productos han sido importados correctamente.`,
          });

          // Persistencia inmediata: guardar en localStorage el nuevo estado
          try {
            const existingRaw = window.localStorage.getItem('pharmaCentralState');
            const existing = existingRaw ? JSON.parse(existingRaw) : {};
            const nextState = {
              ...existing,
              ...appState,
              products: normalized,
              isDataLoaded: true,
            } as any;
            const serialized = JSON.stringify(nextState);
            window.localStorage.setItem('pharmaCentralState', serialized);
            window.localStorage.setItem('pharmaCentralBackup', serialized);
            // Guardar el estado completo también en IndexedDB para evitar cuotas
            try { await idbSet('pharmaCentralState', nextState); } catch {}
          } catch (err) {
            console.warn('Persistencia inmediata falló:', err);
          }

          router.push("/dashboard/consolidated");

        } catch (error) {
            let message = "Ocurrió un error desconocido al procesar el archivo.";
            if (error instanceof Error) {
                message = error.message;
            }
            toast({
                variant: "destructive",
                title: "Error de importación",
                description: message,
            });
        } finally {
            setIsLoading(false);
        }
      };
      reader.onerror = () => {
        toast({
            variant: "destructive",
            title: "Error de lectura",
            description: "No se pudo leer el archivo seleccionado.",
        });
        setIsLoading(false);
      }
      reader.readAsArrayBuffer(file);

    } catch (error) {
      let message = "Ocurrió un error desconocido.";
      if (error instanceof Error) {
          message = error.message;
      }
      toast({
        variant: "destructive",
        title: "Error de importación",
        description: message,
      });
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full mt-6 bg-card/80 backdrop-blur-sm border-dashed">
      <CardHeader>
        <CardTitle>Importa tus datos</CardTitle>
        <CardDescription>
          Selecciona tu archivo de Excel. Los datos se cargarán directamente.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            className="hidden"
            accept=".xlsx, .xls, .csv"
            disabled={isLoading}
        />
        {!file ? (
             <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoading}
                className="w-full flex flex-col items-center justify-center p-8 border-2 border-dashed border-muted-foreground/30 rounded-lg hover:bg-muted/50 transition-colors"
             >
                <UploadCloud className="h-12 w-12 text-muted-foreground/50" />
                <span className="mt-4 font-semibold text-muted-foreground">Haz clic para seleccionar un archivo</span>
                <span className="text-xs text-muted-foreground/70">XLSX, XLS, o CSV</span>
            </button>
        ) : (
            <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <span className="text-sm font-medium text-muted-foreground truncate">{fileName}</span>
                <Button variant="ghost" size="icon" onClick={handleClearFile} disabled={isLoading}>
                    <X className="h-4 w-4"/>
                </Button>
            </div>
        )}
       
        <div className="flex flex-col sm:flex-row gap-2">
          <Button onClick={handleImport} disabled={isLoading || !file} className="w-full">
            {isLoading ? (
              <Loader2 className="animate-spin" />
            ) : (
              <FileUp />
            )}
            <span>{isLoading ? "Procesando..." : "Importar Archivo"}</span>
          </Button>
        </div>
        <div className="flex gap-2 mt-4">
          <Button variant="secondary" onClick={handleClearData} disabled={isLoading || appState.products.length === 0}>
            Limpiar datos
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
