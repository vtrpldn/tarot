import type { TablePoint } from "@/types";

export type TarotSpreadSlot = {
  position: TablePoint;
  rotation: number;
  scale: number;
};

export type TarotSpread = {
  id: "one-card" | "three-card" | "horseshoe" | "celtic-cross";
  label: string;
  shortLabel: string;
  viewZoom: number;
  slots: TarotSpreadSlot[];
};

export const popularTarotSpreads: TarotSpread[] = [
  {
    id: "one-card",
    label: "One card",
    shortLabel: "1 card",
    viewZoom: 1,
    slots: [{ position: [0.3, 0], rotation: 0, scale: 1 }],
  },
  {
    id: "three-card",
    label: "Past · Present · Future",
    shortLabel: "3 cards",
    viewZoom: 0.82,
    slots: [
      { position: [0.15, -0.05], rotation: -6, scale: 0.5 },
      { position: [0.52, 0.03], rotation: 0, scale: 0.5 },
      { position: [0.89, -0.05], rotation: 6, scale: 0.5 },
    ],
  },
  {
    id: "horseshoe",
    label: "Horseshoe",
    shortLabel: "7 cards",
    viewZoom: 0.7,
    slots: [
      { position: [0.18, -0.28], rotation: -16, scale: 0.38 },
      { position: [0.26, 0.26], rotation: -11, scale: 0.38 },
      { position: [0.39, 0.66], rotation: -6, scale: 0.38 },
      { position: [0.55, 0.82], rotation: 0, scale: 0.38 },
      { position: [0.7, 0.66], rotation: 6, scale: 0.38 },
      { position: [0.84, 0.26], rotation: 11, scale: 0.38 },
      { position: [0.96, -0.28], rotation: 16, scale: 0.38 },
    ],
  },
  {
    id: "celtic-cross",
    label: "Celtic Cross",
    shortLabel: "10 cards",
    viewZoom: 0.67,
    slots: [
      { position: [0.42, 0], rotation: 0, scale: 0.34 },
      { position: [0.42, 0], rotation: 90, scale: 0.34 },
      { position: [0.42, 0.68], rotation: 0, scale: 0.34 },
      { position: [0.42, -0.68], rotation: 0, scale: 0.34 },
      { position: [0.18, 0], rotation: 0, scale: 0.34 },
      { position: [0.66, 0], rotation: 0, scale: 0.34 },
      { position: [0.94, -0.78], rotation: 0, scale: 0.31 },
      { position: [0.94, -0.26], rotation: 0, scale: 0.31 },
      { position: [0.94, 0.26], rotation: 0, scale: 0.31 },
      { position: [0.94, 0.78], rotation: 0, scale: 0.31 },
    ],
  },
];
