import { db } from "./firebase";
import { collection, getDocs, doc, setDoc, deleteDoc } from "firebase/firestore";

export type ProductOverride = { drugstoreId?: string; laboratory?: string };

export async function fetchProductOverrides(): Promise<Record<string, ProductOverride>> {
  if (!db) return {};
  const snap = await getDocs(collection(db, "product_overrides"));
  const out: Record<string, ProductOverride> = {};
  for (const d of snap.docs) out[d.id] = d.data() as ProductOverride;
  return out;
}

export async function setProductOverride(key: string, override: ProductOverride) {
  if (!db) return;
  await setDoc(doc(db, "product_overrides", key), override);
}

export async function deleteProductOverride(key: string) {
  if (!db) return;
  await deleteDoc(doc(db, "product_overrides", key));
}
