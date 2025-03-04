"use client";

import { useDraggable } from "@dnd-kit/core";
import { motion } from "framer-motion";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { spring, useCardEffects } from "./useCardEffects";

const CARD_SIZE = {
  width: 260,
  height: 450,
};

// Custom hook to handle card dragging and rotation
function useCardDrag(
  cardId: string,
  dragDelta: Record<string, number>,
  activeCardId: string
) {
  const [coordinates, setCoordinates] = useState(dragDelta);

  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: cardId,
  });
  const [randomRotation] = useState(() => (Math.random() - 0.5) * 4);

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0) rotate(${randomRotation}deg)`,
      }
    : {
        transform: `rotate(${randomRotation}deg)`,
      };

  useEffect(() => {
    if (activeCardId === cardId) {
      setCoordinates(({ x, y }) => ({
        x: x + dragDelta.x,
        y: y + dragDelta.y,
      }));
    }
  }, [setCoordinates, cardId, dragDelta, activeCardId]);

  return {
    coordinates,
    style,
    attributes,
    listeners,
    setNodeRef,
  };
}

// CardFace component for front/back of card
function CardFace({
  isBackFace,
  isFlipped,
  imageSrc,
  shouldLoadImage,
}: {
  isBackFace: boolean;
  isFlipped: boolean;
  imageSrc: string;
  shouldLoadImage: boolean;
}) {
  const rotateY = isBackFace ? (isFlipped ? -180 : 0) : isFlipped ? 0 : 180;
  const zIndex = isBackFace ? (isFlipped ? 0 : 1) : isFlipped ? 1 : 0;

  return (
    <motion.div
      initial={{ rotateY: isBackFace ? 0 : 180 }}
      animate={{ rotateY }}
      transition={spring}
      style={{
        width: "100%",
        height: "100%",
        zIndex,
        backfaceVisibility: "hidden",
        position: "absolute",
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
}

export function Card({
  card,
  activeCardId,
  cardId,
  dragDelta,
  isTopCard = false,
}: {
  card: string;
  activeCardId: string;
  cardId: string;
  dragDelta: Record<string, number>;
  isTopCard?: boolean;
}) {
  const [shouldLoadImage, setShouldLoadImage] = useState(isTopCard);

  const { coordinates, style, attributes, listeners, setNodeRef } = useCardDrag(
    cardId,
    dragDelta,
    activeCardId
  );

  const {
    ref,
    isFlipped,
    hoverDeltaX,
    hoverDeltaY,
    handleDoubleClick,
    handleMouseMove,
    handleMouseEnd,
  } = useCardEffects();

  // Load image when card is flipped
  useEffect(() => {
    if (isFlipped) {
      setShouldLoadImage(true);
    }
  }, [isFlipped]);

  return (
    <motion.div
      ref={setNodeRef}
      style={{
        ...style,
        top: coordinates.y,
        left: coordinates.x,
        width: CARD_SIZE.width,
        height: CARD_SIZE.height,
        perspective: "1600px",
        transformStyle: "preserve-3d",
      }}
      {...listeners}
      {...attributes}
      className="absolute card inline-flex flex-col items-center justify-center rounded-2xl"
      onDoubleClick={handleDoubleClick}
      transition={{
        transform: spring,
      }}
    >
      <motion.div
        ref={ref as any}
        whileHover={{ scale: 1.05 }}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseEnd}
        transition={spring}
        style={{
          width: "100%",
          height: "100%",
          rotateX: hoverDeltaX,
          rotateY: hoverDeltaY,
        }}
      >
        <div
          style={{
            perspective: "1200px",
            transformStyle: "preserve-3d",
            width: "100%",
            height: "100%",
          }}
        >
          {/* Back face of card */}
          <CardFace
            isBackFace={true}
            isFlipped={isFlipped}
            imageSrc="back.png"
            shouldLoadImage={true}
          />

          {/* Front face of card */}
          <CardFace
            isBackFace={false}
            isFlipped={isFlipped}
            imageSrc={card}
            shouldLoadImage={shouldLoadImage}
          />
        </div>
      </motion.div>
    </motion.div>
  );
}
