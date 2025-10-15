// Unit conversion utilities for logical conversions only
// - Supports metric volume (ml <-> L)
// - Supports metric mass (g <-> kg)
// - Treats piece-like containers as equivalent (Frasco/Botella/Bote -> pieza)
// - Does NOT convert between package sizes that require a factor (Caja <-> Tableta),
//   unless they are the same canonical unit

export type CanonicalUnit =
  | "ml"
  | "l"
  | "g"
  | "kg"
  | "pieza" // frasco/botella/bote/unidad/dispensador similar
  | "caja"
  | "blister"
  | "tableta"
  | "sobre"
  | "paquete"
  | "bolsa"
  | "unidad"
  | "otro";

const synonymMap: Record<string, CanonicalUnit> = {
  // volume
  "ML": "ml",
  "M L": "ml",
  "L": "l",
  "LT": "l",
  "LITRO": "l",
  "LITROS": "l",

  // mass
  "G": "g",
  "GR": "g",
  "GRAMO": "g",
  "GRAMOS": "g",
  "KG": "kg",
  "KGS": "kg",
  "KILOGRAMO": "kg",
  "KILOGRAMOS": "kg",

  // pieces and containers (treated as one unit type)
  "FRASCO": "pieza",
  "BOTELLA": "pieza",
  "BOTE": "pieza",
  "DISPENSADOR": "pieza",
  "PIEZA": "pieza",
  "PIEZAS": "pieza",
  "UNIDAD": "unidad",
  "UNIDADES": "unidad",

  // packaged
  "CAJA": "caja",
  "CAJAS": "caja",
  "BLISTER": "blister",
  "BLISTERES": "blister",
  "BLISTERS": "blister",
  "TABLETA": "tableta",
  "TABLETAS": "tableta",
  "SOBRE": "sobre",
  "SOBRES": "sobre",
  "PAQUETE": "paquete",
  "PAQUETES": "paquete",
  "BOLSA": "bolsa",
  "BOLSAS": "bolsa",
};

export function normalizeUnit(input: any): string {
  return String(input ?? "").trim().toUpperCase().replace(/\s+/g, " ");
}

export function canonicalUnit(input: any): CanonicalUnit {
  const norm = normalizeUnit(input);
  return synonymMap[norm] ?? "otro";
}

export function canConvert(from: any, to: any): boolean {
  const f = canonicalUnit(from);
  const t = canonicalUnit(to);
  if (f === t) return true;
  // metric volume
  if ((f === "ml" && t === "l") || (f === "l" && t === "ml")) return true;
  // metric mass
  if ((f === "g" && t === "kg") || (f === "kg" && t === "g")) return true;
  // pieces: treat unidad and pieza as convertible 1:1
  if ((f === "unidad" && t === "pieza") || (f === "pieza" && t === "unidad")) return true;
  return false;
}

export function convertQuantity(qty: number, from: any, to: any): number | null {
  const f = canonicalUnit(from);
  const t = canonicalUnit(to);
  if (Number.isNaN(qty) || !Number.isFinite(qty)) return null;
  if (f === "otro" || t === "otro") return f === t ? qty : null;
  if (f === t) return qty;

  // volume
  if (f === "ml" && t === "l") return qty / 1000;
  if (f === "l" && t === "ml") return qty * 1000;

  // mass
  if (f === "g" && t === "kg") return qty / 1000;
  if (f === "kg" && t === "g") return qty * 1000;

  // pieces
  if ((f === "unidad" && t === "pieza") || (f === "pieza" && t === "unidad")) return qty; // 1:1

  // Not logically convertible
  return null;
}

export function baseCanonicalFor(unit: any): CanonicalUnit {
  const u = canonicalUnit(unit);
  // prefer base small units for metric to aggregate consistently
  if (u === "l") return "ml"; // aggregate in ml
  if (u === "kg") return "g"; // aggregate in g
  if (u === "unidad") return "pieza"; // unify to pieza
  return u;
}

export function humanLabelFor(cu: CanonicalUnit): string {
  switch (cu) {
    case "ml":
    case "l":
    case "g":
    case "kg":
    case "caja":
    case "blister":
    case "tableta":
    case "sobre":
    case "paquete":
    case "bolsa":
      return cu;
    case "pieza":
      return "unidad"; // display-friendly
    case "unidad":
      return "unidad";
    default:
      return "unidad";
  }
}
