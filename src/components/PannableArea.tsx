"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export function PannableArea({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPanning, setIsPanning] = useState(false);
  const [startPoint, setStartPoint] = useState({ x: 0, y: 0 });
  const [scrollPosition, setScrollPosition] = useState({ x: 0, y: 0 });
  const [prevPosition, setPrevPosition] = useState({ x: 0, y: 0 });

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      const isCardElement = target.closest('[role="button"]') !== null;

      // Don't initiate panning if clicking on a card
      if (isCardElement) {
        return;
      }

      setIsPanning(true);
      setStartPoint({
        x: e.pageX - prevPosition.x,
        y: e.pageY - prevPosition.y,
      });
    },
    [prevPosition]
  );

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
    setPrevPosition(scrollPosition);
  }, [scrollPosition]);

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isPanning) return;

      const newX = e.pageX - startPoint.x;
      const newY = e.pageY - startPoint.y;

      setScrollPosition({ x: newX, y: newY });
    },
    [isPanning, startPoint]
  );

  useEffect(() => {
    if (isPanning) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isPanning, handleMouseMove, handleMouseUp]);

  return (
    <div
      className="overflow-hidden w-full h-full relative cursor-grab active:cursor-grabbing"
      style={{
        touchAction: "none",
      }}
    >
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        className={`min-w-[200vw] min-h-[200vh] ${className}`}
        style={{
          transform: `translate(${scrollPosition.x}px, ${scrollPosition.y}px)`,
          transition: isPanning ? "none" : "transform 0.1s ease-out",
        }}
      >
        {children}
      </div>
    </div>
  );
}
