import type { Pharmacy, Laboratory } from "./types";

export const pharmacies: Pharmacy[] = [
  { id: "jerusalen-1", name: "Jerusalen 1" },
  { id: "jerusalen-2", name: "Jerusalen 2" },
  { id: "jerusalen-3", name: "Jerusalen 3" },
  { id: "jerusalen-4", name: "Jerusalen 4" },
];

export const laboratories: Laboratory[] = [
  { id: "lab-a", name: "Laboratorio A", pharmacies: ["jerusalen-1"] },
  { id: "lab-b", name: "Laboratorio B", pharmacies: ["jerusalen-2"] },
  { id: "lab-c", name: "Laboratorio C", pharmacies: ["jerusalen-1", "jerusalen-2"] },
  { id: "lab-d", name: "Laboratorio D", pharmacies: ["jerusalen-3"] },
];
