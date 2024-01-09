"use client";

import { TarotDecks } from "@/types";
import { useDraggable } from "@dnd-kit/core";
import Image from "next/image";
import { useEffect, useState } from "react";

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
  const [visible, setVisible] = useState<boolean>(false);
  const [coordinates, setCoordinates] = useState(deltaProp);
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: cardId,
  });
  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  // update card position
  useEffect(() => {
    if (activeCardId === cardId) {
      setCoordinates(({ x, y }) => {
        return {
          x: x + deltaProp.x,
          y: y + deltaProp.y,
        };
      });
    }
  }, [setCoordinates, cardId, deltaProp, activeCardId]);

  function handleDoubleClick() {
    setVisible((visible) => !visible);
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style,
        top: coordinates.y,
        left: coordinates.x,
        width: 400,
        height: 700,
      }}
      {...listeners}
      {...attributes}
      className="absolute card shadow inline-flex flex-col items-center justify-center overflow-hidden rounded-2xl"
      onDoubleClick={handleDoubleClick}
    >
      {visible || (
        <div className="absolute left-0 top-0 w-full h-full bg-black" />
      )}
      <Image src={`/img/${card}`} alt={card} width={400} height={700} />
    </div>
  );
}
