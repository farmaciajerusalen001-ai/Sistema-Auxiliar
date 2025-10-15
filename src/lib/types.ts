export interface Product {
  id: string;
  code?: string;
  name?: string;
  unit?: string;
  quantity?: number | string;
  laboratory?: string;
  pharmacy?: string;
  // Allow any other properties from the Excel file
  [key: string]: any;
}

export interface Pharmacy {
  id: string;
  name: string;
}

export interface Laboratory {
  id: string;
  name: string;
  pharmacies: string[];
}

export const unitGroups = {
  solid: ["Caja", "Blíster", "Tableta", "Unidad"],
  packaged: ["Caja", "Sobre", "Paquete", "Bolsa"],
  liquid: ["Caja", "Frasco", "Bote", "Botella"],
};

export type Unit = (typeof unitGroups)[keyof typeof unitGroups][number];

export const ALL_UNITS = [...new Set([
    ...unitGroups.solid,
    ...unitGroups.packaged,
    ...unitGroups.liquid
])];
