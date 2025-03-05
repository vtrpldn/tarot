"use client";

import { useEffect, useState } from "react";
import { useCardEffects } from "./useCardEffects";
import { CardContainer } from "./CardContainer";
import { CardFace } from "./CardFace";
import { CardWrapper } from "./CardWrapper";
import { cardInnerStyle } from "./style";

interface CardProps {
  card: string;
  isTopCard?: boolean;
}

export function Card({ card, isTopCard = false }: CardProps) {
  const [shouldLoadImage, setShouldLoadImage] = useState(isTopCard);
  const {
    ref,
    isFlipped,
    handleDoubleClick,
    hoverDeltaX,
    hoverDeltaY,
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
    <CardContainer onDoubleClick={handleDoubleClick}>
      <CardWrapper
        ref={ref}
        hoverDeltaX={hoverDeltaX}
        hoverDeltaY={hoverDeltaY}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseEnd}
      >
        <div style={cardInnerStyle}>
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
      </CardWrapper>
    </CardContainer>
  );
}
