"use client";

import { motion, MotionValue } from "framer-motion";
import { forwardRef } from "react";
import { spring } from "./useCardEffects";

interface CardWrapperProps {
  children: React.ReactNode;
  hoverDeltaX: MotionValue<number>;
  hoverDeltaY: MotionValue<number>;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseLeave: () => void;
}

/**
 * CardWrapper manages the card's hover interactions and animations.
 * It provides:
 * - Mouse move tracking for 3D rotation effect
 * - Hover scale animation
 * - Smooth transitions between hover states
 * - 3D rotation based on mouse position
 */
export const CardWrapper = forwardRef<HTMLDivElement, CardWrapperProps>(
  function CardWrapper(
    { children, hoverDeltaX, hoverDeltaY, onMouseMove, onMouseLeave },
    ref
  ) {
    return (
      <motion.div
        ref={ref}
        whileHover={{ scale: 1.05 }}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        transition={spring}
        style={{
          width: "100%",
          height: "100%",
          rotateX: hoverDeltaX,
          rotateY: hoverDeltaY,
        }}
      >
        {children}
      </motion.div>
    );
  }
);
