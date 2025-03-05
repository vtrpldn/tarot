import { useState, useCallback } from "react";

interface Position {
  x: number;
  y: number;
}

interface DragState {
  isDragging: boolean;
  startPosition: Position;
  currentOffset: Position;
  finalPosition: Position;
}

export function useCardDrag() {
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    startPosition: { x: 0, y: 0 },
    currentOffset: { x: 0, y: 0 },
    finalPosition: { x: 0, y: 0 },
  });

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const { pageX, pageY } = e;

    setDragState((prev) => ({
      ...prev,
      isDragging: true,
      startPosition: {
        x: pageX - prev.currentOffset.x,
        y: pageY - prev.currentOffset.y,
      },
    }));
  }, []);

  const handleDragMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragState.isDragging) return;
      e.stopPropagation();

      const { pageX, pageY } = e;
      setDragState((prev) => ({
        ...prev,
        currentOffset: {
          x: pageX - prev.startPosition.x,
          y: pageY - prev.startPosition.y,
        },
      }));
    },
    [dragState.isDragging]
  );

  const handleDragEnd = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setDragState((prev) => ({
      ...prev,
      isDragging: false,
      finalPosition: prev.currentOffset,
    }));
  }, []);

  const style = {
    position: "absolute" as const,
    top: 0,
    left: 0,
    transform: `translate3d(${dragState.currentOffset.x}px, ${dragState.currentOffset.y}px, 0)`,
    cursor: dragState.isDragging ? "grabbing" : "grab",
    userSelect: "none" as const,
  };

  return {
    style,
    isDragging: dragState.isDragging,
    handleDragStart,
    handleDragMove,
    handleDragEnd,
  };
}
