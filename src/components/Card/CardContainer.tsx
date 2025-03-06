"use client";

import { motion } from "framer-motion";
import { spring } from "./useCardEffects";
import { cardContainerStyle } from "./style";
import { useCardDrag } from "./useCardDrag";
import { useMemo } from "react";

interface CardContainerProps {
  children: React.ReactNode;
  onDoubleClick: () => void;
}

/**
 * CardContainer is responsible for the card's flip animation and overall layout.
 * It provides:
 * - Container dimensions and 3D perspective
 * - Double click handler for card flipping
 * - Base transition spring animation for the flip
 * - Drag and drop functionality with translate3d transform
 * - Subtle random rotation for visual interest
 */
export function CardContainer({ children, onDoubleClick }: CardContainerProps) {
  const { style: dragStyle, handleDragStart } = useCardDrag();
  const randomRotation = useMemo(() => (Math.random() - 0.5) * 4, []); // Random between -2 and 2 degrees

  return (
    <motion.div
      style={{
        ...cardContainerStyle,
        ...dragStyle,
        transform: `${dragStyle.transform} rotate(${randomRotation}deg)`,
      }}
      className="absolute card inline-flex flex-col items-center justify-center rounded-2xl"
      onDoubleClick={onDoubleClick}
      onMouseDown={handleDragStart}
      transition={{
        transform: spring,
      }}
    >
      {children}
    </motion.div>
  );
}
