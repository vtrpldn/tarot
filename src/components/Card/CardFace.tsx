"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import { spring } from "./useCardEffects";
import { cardFaceStyle } from "./style";
import { memo } from "react";

interface CardFaceProps {
  isBackFace: boolean;
  isFlipped: boolean;
  imageSrc: string;
  shouldLoadImage: boolean;
}

export const CardFace = memo(function CardFace({
  isBackFace,
  isFlipped,
  imageSrc,
  shouldLoadImage,
}: CardFaceProps) {
  const rotateY = isBackFace ? (isFlipped ? -180 : 0) : isFlipped ? 0 : 180;
  const zIndex = isBackFace ? (isFlipped ? 0 : 1) : isFlipped ? 1 : 0;

  return (
    <motion.div
      initial={{ rotateY: isBackFace ? 0 : 180 }}
      animate={{ rotateY }}
      transition={spring}
      style={{
        ...cardFaceStyle,
        zIndex,
      }}
      className={`bg-[#f5f5f5] rounded-lg p-2 flex items-center justify-center ${
        isFlipped ? "shadow-md" : ""
      }`}
    >
      {(shouldLoadImage || isBackFace) && (
        <div className="relative w-full h-full">
          <Image
            src={`/img/${imageSrc}`}
            alt={imageSrc}
            fill
            sizes="(max-width: 768px) 100vw, 260px"
            style={{ objectFit: "contain" }}
            className="rounded-lg"
            priority={isBackFace}
            loading={isBackFace ? undefined : "lazy"}
          />
        </div>
      )}
    </motion.div>
  );
});
