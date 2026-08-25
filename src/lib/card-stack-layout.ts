import type { TablePoint } from "@/types";

export function getCardStackOffset(
  index: number,
  count: number
): TablePoint {
  const finalIndex = Math.max(0, count - 1);
  const safeIndex = Math.min(finalIndex, Math.max(0, index));
  const intervals = Math.max(1, finalIndex);
  const horizontalStep = Math.min(0.008, 0.08 / intervals);
  const verticalStep = Math.min(0.01, 0.1 / intervals);

  return [safeIndex * horizontalStep, safeIndex * verticalStep];
}
