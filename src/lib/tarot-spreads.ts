import type { TablePoint } from "@/types";

export type TarotSpreadSlot = {
  position: TablePoint;
  rotation: number;
};

export type TarotSpread = {
  id: "one-card" | "three-card" | "horseshoe" | "celtic-cross";
  label: string;
  shortLabel: string;
  slots: TarotSpreadSlot[];
};

export const popularTarotSpreads: TarotSpread[] = [
  {
    id: "one-card",
    label: "One card",
    shortLabel: "1 card",
    slots: [{ position: [0, 0], rotation: 0 }],
  },
  {
    id: "three-card",
    label: "Past · Present · Future",
    shortLabel: "3 cards",
    slots: [
      { position: [-0.8, -0.05], rotation: -6 },
      { position: [0, 0.03], rotation: 0 },
      { position: [0.8, -0.05], rotation: 6 },
    ],
  },
  {
    id: "horseshoe",
    label: "Horseshoe",
    shortLabel: "7 cards",
    slots: [
      { position: [-1.55, -1.05], rotation: -16 },
      { position: [-1.35, 0.25], rotation: -11 },
      { position: [-0.75, 1.35], rotation: -6 },
      { position: [0, 1.8], rotation: 0 },
      { position: [0.75, 1.35], rotation: 6 },
      { position: [1.35, 0.25], rotation: 11 },
      { position: [1.55, -1.05], rotation: 16 },
    ],
  },
  {
    id: "celtic-cross",
    label: "Celtic Cross",
    shortLabel: "10 cards",
    slots: [
      { position: [-1.55, 0], rotation: 0 },
      { position: [-1.55, 0], rotation: 90 },
      { position: [-1.55, 1.55], rotation: 0 },
      { position: [-1.55, -1.55], rotation: 0 },
      { position: [-2.4, 0], rotation: 0 },
      { position: [-0.7, 0], rotation: 0 },
      { position: [1.75, -2.25], rotation: 0 },
      { position: [1.75, -0.75], rotation: 0 },
      { position: [1.75, 0.75], rotation: 0 },
      { position: [1.75, 2.25], rotation: 0 },
    ],
  },
];
