"use client";

import { motion } from "framer-motion";
import { spring } from "./useCardEffects";
import { cardContainerStyle } from "./style";

/**
 * CardContainer is responsible for the card's flip animation and overall layout.
 * It provides:
 * - Container dimensions and 3D perspective
 * - Double click handler for card flipping
 * - Base transition spring animation for the flip
 */
export function CardContainer({
  children,
  onDoubleClick,
}: {
  children: React.ReactNode;
  onDoubleClick: () => void;
}) {
  return (
    <motion.div
      style={cardContainerStyle}
      className="absolute card inline-flex flex-col items-center justify-center rounded-2xl"
      onDoubleClick={onDoubleClick}
      transition={{
        transform: spring,
      }}
    >
      {children}
    </motion.div>
  );
}
