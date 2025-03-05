export const CARD_SIZE = {
  width: 260,
  height: 450,
} as const;

export const cardContainerStyle = {
  width: CARD_SIZE.width,
  height: CARD_SIZE.height,
  perspective: "1600px",
  transformStyle: "preserve-3d",
} as const;

export const cardInnerStyle = {
  width: "100%",
  height: "100%",
  perspective: "1200px",
  transformStyle: "preserve-3d",
} as const;

export const cardFaceStyle = {
  width: "100%",
  height: "100%",
  backfaceVisibility: "hidden",
  position: "absolute",
} as const;
