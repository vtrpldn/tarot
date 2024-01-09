"use client";

import { useDraggable } from "@dnd-kit/core";
import { motion, useSpring } from "framer-motion";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const spring = {
  type: "spring",
  stiffness: 100,
  damping: 40,
};

export function Card({
  card,
  activeCardId,
  cardId,
  delta: deltaProp,
}: {
  card: string;
  activeCardId: string;
  cardId: string;
  delta: Record<string, number>;
}) {
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [rotateXaxis, setRotateXaxis] = useState(0);
  const [rotateYaxis, setRotateYaxis] = useState(0);
  const ref = useRef<HTMLDivElement | undefined>();

  const [coordinates, setCoordinates] = useState(deltaProp);
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
            x: x + deltaProp.x,
            y: y + deltaProp.y,
          };
        });
      }
    },
    [setCoordinates, cardId, deltaProp, activeCardId]
  );

  function handleDoubleClick() {
    setIsFlipped((visible) => !visible);
  }

  const handleMouseMove = (event: any) => {
    const element = ref?.current;
    const elementRect = element!.getBoundingClientRect();
    const elementWidth = elementRect.width;
    const elementHeight = elementRect.height;
    const elementCenterX = elementWidth / 2;
    const elementCenterY = elementHeight / 2;
    const mouseX = event.clientY - elementRect.y - elementCenterY;
    const mouseY = event.clientX - elementRect.x - elementCenterX;
    const degreeX = (mouseX / elementWidth) * 20; //The number is the rotation factor
    const degreeY = (mouseY / elementHeight) * 20; //The number is the rotation factor
    setRotateXaxis(degreeX);
    setRotateYaxis(degreeY);
  };

  const handleMouseEnd = () => {
    setRotateXaxis(0);
    setRotateYaxis(0);
  };

  const dx = useSpring(0, spring);
  const dy = useSpring(0, spring);

  useEffect(() => {
    dx.set(-rotateXaxis);
    dy.set(rotateYaxis);
  }, [dx, dy, rotateXaxis, rotateYaxis]);

  return (
    <motion.div
      ref={setNodeRef}
      style={{
        ...style,
        top: coordinates.y,
        left: coordinates.x,
        width: 400,
        height: 700,
        perspective: "1600px",
        transformStyle: "preserve-3d",
      }}
      {...listeners}
      {...attributes}
      className="absolute card inline-flex flex-col items-center justify-center rounded-2xl"
      onDoubleClick={handleDoubleClick}
    >
      <motion.div
        // fix me
        ref={ref as any}
        whileHover={{ scale: 1.1 }} //Change the scale of zooming in when hovering
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseEnd}
        transition={spring}
        style={{
          width: "100%",
          height: "100%",
          rotateX: dx,
          rotateY: dy,
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
          >
            <Image
              src={`/img/back.jpg`}
              alt={card}
              width={400}
              height={700}
              className="rounded-lg"
            />
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
          >
            <Image
              src={`/img/${card}`}
              alt={card}
              width={400}
              height={700}
              className="rounded-lg"
            />
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
}
