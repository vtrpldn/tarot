"use client";

import { useDraggable } from "@dnd-kit/core";
import { motion, useSpring } from "framer-motion";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { spring, useCardEffects } from "./useCardEffects";

const CARD_SIZE = {
  width: 260,
  height: 450,
};

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
  const [coordinates, setCoordinates] = useState(dragDelta);
  const [shouldLoadImage, setShouldLoadImage] = useState(isTopCard);
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: cardId,
  });
  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  useEffect(
    function updateCardPosition() {
      if (activeCardId === cardId) {
        setCoordinates(({ x, y }) => {
          return {
            x: x + dragDelta.x,
            y: y + dragDelta.y,
          };
        });
      }
    },
    [setCoordinates, cardId, dragDelta, activeCardId]
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
          <motion.div
            animate={{ rotateY: isFlipped ? -180 : 0 }}
            transition={spring}
            style={{
              width: "100%",
              height: "100%",
              zIndex: isFlipped ? 0 : 1,
              backfaceVisibility: "hidden",
              position: "absolute",
            }}
            className="bg-[#f5f5f5] rounded-lg p-2 flex items-center justify-center"
          >
            <div className="relative w-full h-full">
              <Image
                src={`/img/back.png`}
                alt="Card Back"
                fill
                style={{ objectFit: "contain" }}
                className="rounded-lg"
                priority={true}
              />
            </div>
          </motion.div>
          <motion.div
            initial={{ rotateY: 180 }}
            animate={{ rotateY: isFlipped ? 0 : 180 }}
            transition={spring}
            style={{
              width: "100%",
              height: "100%",
              zIndex: isFlipped ? 1 : 0,
              backfaceVisibility: "hidden",
              position: "absolute",
            }}
            className="bg-[#f5f5f5] rounded-lg p-2 flex items-center justify-center shadow-md"
          >
            {shouldLoadImage && (
              <div className="relative w-full h-full">
                <Image
                  src={`/img/${card}`}
                  alt={card}
                  fill
                  style={{ objectFit: "contain" }}
                  loading={isTopCard ? "eager" : "lazy"}
                  className="rounded-lg"
                />
              </div>
            )}
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
}
