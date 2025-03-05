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
  const wrapperRef = useRef<HTMLDivElement>(null);

  const [isPanning, setIsPanning] = useState(false);

  const [startPoint, setStartPoint] = useState({ x: 0, y: 0 });
  const [scrollPosition, setScrollPosition] = useState({ x: 0, y: 0 });
  const [prevPosition, setPrevPosition] = useState({ x: 0, y: 0 });
  const [bounds, setBounds] = useState({ minX: 0, maxX: 0, minY: 0, maxY: 0 });

  // Calculate bounds based on container and wrapper dimensions
  const calculateBounds = useCallback(() => {
    if (!containerRef.current || !wrapperRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const wrapperRect = wrapperRef.current.getBoundingClientRect();

    // Calculate maximum bounds
    // minX/minY: Rightmost/bottommost position (negative value)
    // maxX/maxY: Leftmost/topmost position (should be 0 or positive)
    const minX = wrapperRect.width - containerRect.width;
    const minY = wrapperRect.height - containerRect.height;

    setBounds({
      minX: minX < 0 ? minX : 0,
      maxX: 0,
      minY: minY < 0 ? minY : 0,
      maxY: 0,
    });
  }, []);

  // Calculate bounds on initial render and on window resize
  useEffect(() => {
    calculateBounds();

    window.addEventListener("resize", calculateBounds);
    return () => window.removeEventListener("resize", calculateBounds);
  }, [calculateBounds]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      const isDraggingCard = target.closest('[data-dragging="true"]') !== null;

      // Don't initiate panning if clicking on a dragging card
      if (isDraggingCard) {
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
    (e: React.MouseEvent) => {
      if (!isPanning) return;

      // Calculate the new position
      let newX = e.pageX - startPoint.x;
      let newY = e.pageY - startPoint.y;

      // Apply bounds constraints
      newX = Math.max(bounds.minX, Math.min(bounds.maxX, newX));
      newY = Math.max(bounds.minY, Math.min(bounds.maxY, newY));

      setScrollPosition({ x: newX, y: newY });
    },
    [isPanning, startPoint, bounds]
  );

  return (
    <div
      ref={wrapperRef}
      className="overflow-hidden w-full h-full relative cursor-grab active:cursor-grabbing"
      style={{
        touchAction: "none",
      }}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
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
