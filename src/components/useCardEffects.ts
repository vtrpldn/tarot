import { useSpring } from "framer-motion";
import { useRef, useState, useEffect } from "react";

export const spring = {
  type: "spring",
  stiffness: 100,
  damping: 40,
};

/**
 * Handles hover effect and card flip.
 */
export const useCardEffects = () => {
  const ref = useRef<HTMLDivElement | undefined>();

  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [rotateXaxis, setRotateXaxis] = useState(0);
  const [rotateYaxis, setRotateYaxis] = useState(0);

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

  const hoverDeltaX = useSpring(0, spring);
  const hoverDeltaY = useSpring(0, spring);

  useEffect(
    function updateRotationAxis() {
      hoverDeltaX.set(-rotateXaxis);
      hoverDeltaY.set(rotateYaxis);
    },
    [hoverDeltaX, hoverDeltaY, rotateXaxis, rotateYaxis]
  );

  return {
    ref,
    isFlipped,
    handleDoubleClick,
    handleMouseMove,
    handleMouseEnd,
    hoverDeltaX,
    hoverDeltaY,
  };
};
