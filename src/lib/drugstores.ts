import { db } from "./firebase";
import { collection, getDocs, doc, setDoc, deleteDoc } from "firebase/firestore";

export type Drugstore = { id: string; name: string };
export type FamilyMap = { family: string; drugstoreId: string };

export async function fetchDrugstores(): Promise<Drugstore[]> {
  if (!db) return [];
  const snap = await getDocs(collection(db, "drugstores"));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) }));
}

export async function fetchFamilyMap(): Promise<FamilyMap[]> {
  if (!db) return [];
  const snap = await getDocs(collection(db, "families_map"));
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as any;
}

const normalize = (s: string) =>
  String(s || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ");

export function resolveDrugstoreIdByFamily(family: string, maps: FamilyMap[], fallbackId = "sin-drogueria") {
  const fam = normalize(family);
  // 1) Exact match
  let hit = maps.find((m) => normalize(m.family) === fam);
  if (hit) return hit.drugstoreId;

  // 2) Partial match: choose the longest family that is contained in the other string
  const scored = maps
    .map((m) => {
      const mf = normalize(m.family);
      const contained = fam.includes(mf) || mf.includes(fam);
      const score = contained ? Math.min(mf.length, fam.length) : 0;
      return { m, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);
  if (scored.length > 0) return scored[0].m.drugstoreId;

  return fallbackId;
}

// Utilities to seed data from a JSON like [{ LABORATORIO: "...", DROGUERIA: "..." }]
const slug = (s: string) => String(s || "").trim().toLowerCase()
  .normalize("NFD").replace(/\p{Diacritic}/gu, "")
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/(^-|-$)+/g, "");

export async function saveDrugstoresAndFamilies(mappings: Array<{ LABORATORIO: string; DROGUERIA: string }>) {
  if (!db) throw new Error("Firestore no inicializado");
  const seenDrugstores = new Set<string>();
  for (const item of mappings) {
    const family = String(item.LABORATORIO || "").trim();
    const drugName = String(item.DROGUERIA || "").trim();
    if (!family || !drugName) continue;

    const drugId = slug(drugName) || "sin-drogueria";
    if (!seenDrugstores.has(drugId)) {
      await setDoc(doc(db, "drugstores", drugId), { name: drugName });
      seenDrugstores.add(drugId);
    }
    const famId = slug(family);
    await setDoc(doc(db, "families_map", famId), { family, drugstoreId: drugId });
  }
}

// CRUD helpers for Admin UI
export async function upsertDrugstore(id: string, name: string) {
  if (!db) return;
  await setDoc(doc(db, "drugstores", id), { name });
}

export async function deleteDrugstore(id: string) {
  if (!db) return;
  await deleteDoc(doc(db, "drugstores", id));
}

export async function upsertFamily(family: string, drugstoreId: string) {
  if (!db) return;
  const famId = slug(family);
  await setDoc(doc(db, "families_map", famId), { family, drugstoreId });
}

export async function deleteFamily(family: string, drugstoreId: string) {
  if (!db) return;
  const famId = slug(family);
  // We delete by family ID regardless of current mapping; UI already knows drugstoreId
  await deleteDoc(doc(db, "families_map", famId));
}
