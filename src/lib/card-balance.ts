import type { TableCard, TablePoint } from "@/types";

export type BalancePoint = readonly [number, number];

export type BalanceBounds = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

/** The small layout contract needed by pure table-physics helpers. */
export type CardBalanceLayout = {
  cardWidth: number;
  cardHeight: number;
  dragBounds?: BalanceBounds;
  toPoint?: (x: number, y: number) => TablePoint;
  toWorld: (point: TablePoint) => [number, number];
};

export type CardFootprint = {
  cardId: string;
  center: [number, number];
  corners: Array<[number, number]>;
  rotation: number;
};

export type CardStackLevel = {
  card: TableCard;
  footprint: CardFootprint;
  height: number;
  /** Cards immediately touching this card's underside at its highest plane. */
  supportCardIds: string[];
};

export type CardSupportContact = {
  cardId: string;
  area: number;
  polygon: Array<[number, number]>;
};

export type CardSupportEvaluation = {
  cardId: string;
  contacts: CardSupportContact[];
  kind: "cards" | "table";
  margin: number;
  nearestPoint: [number, number] | null;
  overhang: number;
  stable: boolean;
  supportPolygon: Array<[number, number]>;
};

export type CardFallResolution = {
  assessment: CardSupportEvaluation;
  direction: [number, number] | null;
  outcome: "fell" | "stable" | "unresolved";
  patch?: Pick<TableCard, "faceUp" | "position" | "rotation">;
  willFlipFace: boolean;
};

export type ResolvePrimaryCardDropOptions = {
  baseHeight?: number;
  /** World-space velocity at release, in units per second. */
  releaseVelocity?: BalancePoint;
  layerStep: number;
  /** A card must keep this much support polygon beneath its centre. */
  supportMargin?: number;
};

const EPSILON = 0.000001;
const OVERLAP_EPSILON = 0.001;
const DEFAULT_SUPPORT_MARGIN_RATIO = 0.025;
const FALL_DISTANCES = [0.32, 0.52, 0.78, 1.04] as const;
const FALL_ANGLE_OFFSETS = [0, -24, 24, -48, 48] as const;
const MAX_FALL_ROTATION = 24;
const MIN_FALL_ROTATION = 8;
const FLIP_SCORE_THRESHOLD = 0.28;

const clamp = (value: number, minimum: number, maximum: number) =>
  Math.min(Math.max(value, minimum), maximum);

const dot = (first: BalancePoint, second: BalancePoint) =>
  first[0] * second[0] + first[1] * second[1];

const cross = (origin: BalancePoint, first: BalancePoint, second: BalancePoint) =>
  (first[0] - origin[0]) * (second[1] - origin[1]) -
  (first[1] - origin[1]) * (second[0] - origin[0]);

const distance = (first: BalancePoint, second: BalancePoint) =>
  Math.hypot(first[0] - second[0], first[1] - second[1]);

function normalise(vector: BalancePoint): [number, number] | null {
  const length = Math.hypot(vector[0], vector[1]);

  return length > EPSILON ? [vector[0] / length, vector[1] / length] : null;
}

function rotate(vector: BalancePoint, degrees: number): [number, number] {
  const radians = (degrees * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);

  return [
    vector[0] * cosine - vector[1] * sine,
    vector[0] * sine + vector[1] * cosine,
  ];
}

function stableHash(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) / 4294967296;
}

function getFallbackDirection(cardId: string): [number, number] {
  const angle = stableHash(cardId) * Math.PI * 2;

  return [Math.cos(angle), Math.sin(angle)];
}

function getCorners(
  center: BalancePoint,
  rotation: number,
  cardWidth: number,
  cardHeight: number
): Array<[number, number]> {
  const halfWidth = cardWidth / 2;
  const halfHeight = cardHeight / 2;
  const radians = (rotation * Math.PI) / 180;
  const cosine = Math.cos(radians);
  const sine = Math.sin(radians);
  const points: Array<[number, number]> = [
    [-halfWidth, -halfHeight],
    [halfWidth, -halfHeight],
    [halfWidth, halfHeight],
    [-halfWidth, halfHeight],
  ];

  return points.map(([x, y]) => [
    center[0] + x * cosine - y * sine,
    center[1] + x * sine + y * cosine,
  ]);
}

export function createCardFootprint(
  card: Pick<TableCard, "id" | "position" | "rotation">,
  layout: CardBalanceLayout
): CardFootprint {
  const center = layout.toWorld(card.position);

  return {
    cardId: card.id,
    center,
    corners: getCorners(
      center,
      card.rotation,
      layout.cardWidth,
      layout.cardHeight
    ),
    rotation: card.rotation,
  };
}

function axesFor(footprint: CardFootprint): Array<[number, number]> {
  const first = footprint.corners[0];
  const second = footprint.corners[1];
  const third = footprint.corners[2];
  const firstAxis = normalise([second[0] - first[0], second[1] - first[1]]);
  const secondAxis = normalise([third[0] - second[0], third[1] - second[1]]);

  return firstAxis && secondAxis ? [firstAxis, secondAxis] : [];
}

function boundsAlong(points: readonly BalancePoint[], axis: BalancePoint) {
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;

  points.forEach((point) => {
    const projection = dot(point, axis);
    minimum = Math.min(minimum, projection);
    maximum = Math.max(maximum, projection);
  });

  return { maximum, minimum };
}

/** Separating-axis overlap for two oriented card rectangles. */
export function footprintsOverlap(
  first: CardFootprint,
  second: CardFootprint,
  epsilon = OVERLAP_EPSILON
): boolean {
  return [...axesFor(first), ...axesFor(second)].every((axis) => {
    const firstBounds = boundsAlong(first.corners, axis);
    const secondBounds = boundsAlong(second.corners, axis);

    return (
      Math.min(firstBounds.maximum, secondBounds.maximum) -
        Math.max(firstBounds.minimum, secondBounds.minimum) >
      epsilon
    );
  });
}

function polygonArea(points: readonly BalancePoint[]): number {
  if (points.length < 3) {
    return 0;
  }

  let twiceArea = 0;

  for (let index = 0; index < points.length; index += 1) {
    const next = points[(index + 1) % points.length];
    twiceArea += points[index][0] * next[1] - points[index][1] * next[0];
  }

  return Math.abs(twiceArea) / 2;
}

function lineIntersection(
  start: BalancePoint,
  end: BalancePoint,
  clipStart: BalancePoint,
  clipEnd: BalancePoint
): [number, number] {
  const edge: [number, number] = [end[0] - start[0], end[1] - start[1]];
  const clipEdge: [number, number] = [
    clipEnd[0] - clipStart[0],
    clipEnd[1] - clipStart[1],
  ];
  const denominator = edge[0] * clipEdge[1] - edge[1] * clipEdge[0];

  if (Math.abs(denominator) <= EPSILON) {
    return [end[0], end[1]];
  }

  const between: [number, number] = [
    clipStart[0] - start[0],
    clipStart[1] - start[1],
  ];
  const t =
    (between[0] * clipEdge[1] - between[1] * clipEdge[0]) / denominator;

  return [start[0] + edge[0] * t, start[1] + edge[1] * t];
}

/** Clips one convex polygon against another, retaining the overlap patch. */
export function clipConvexPolygon(
  subject: readonly BalancePoint[],
  clip: readonly BalancePoint[]
): Array<[number, number]> {
  let output = subject.map(([x, y]) => [x, y] as [number, number]);

  for (let clipIndex = 0; clipIndex < clip.length; clipIndex += 1) {
    const clipStart = clip[clipIndex];
    const clipEnd = clip[(clipIndex + 1) % clip.length];
    const input = output;
    output = [];

    if (input.length === 0) {
      break;
    }

    let previous = input[input.length - 1];
    let previousInside = cross(clipStart, clipEnd, previous) >= -EPSILON;

    input.forEach((current) => {
      const currentInside = cross(clipStart, clipEnd, current) >= -EPSILON;

      if (currentInside !== previousInside) {
        output.push(lineIntersection(previous, current, clipStart, clipEnd));
      }

      if (currentInside) {
        output.push(current);
      }

      previous = current;
      previousInside = currentInside;
    });
  }

  return output;
}

export function getConvexHull(
  points: readonly BalancePoint[]
): Array<[number, number]> {
  const uniquePoints = Array.from(
    new Map(
      points.map((point) => [
        `${point[0].toFixed(8)}:${point[1].toFixed(8)}`,
        [point[0], point[1]] as [number, number],
      ])
    ).values()
  ).sort((first, second) => first[0] - second[0] || first[1] - second[1]);

  if (uniquePoints.length <= 2) {
    return uniquePoints;
  }

  const lower: Array<[number, number]> = [];
  uniquePoints.forEach((point) => {
    while (
      lower.length >= 2 &&
      cross(lower[lower.length - 2], lower[lower.length - 1], point) <= EPSILON
    ) {
      lower.pop();
    }
    lower.push(point);
  });

  const upper: Array<[number, number]> = [];
  [...uniquePoints].reverse().forEach((point) => {
    while (
      upper.length >= 2 &&
      cross(upper[upper.length - 2], upper[upper.length - 1], point) <= EPSILON
    ) {
      upper.pop();
    }
    upper.push(point);
  });

  upper.pop();
  lower.pop();
  return [...lower, ...upper];
}

function closestPointOnSegment(
  point: BalancePoint,
  start: BalancePoint,
  end: BalancePoint
): [number, number] {
  const segment: [number, number] = [end[0] - start[0], end[1] - start[1]];
  const lengthSquared = dot(segment, segment);

  if (lengthSquared <= EPSILON) {
    return [start[0], start[1]];
  }

  const progress = clamp(
    dot([point[0] - start[0], point[1] - start[1]], segment) /
      lengthSquared,
    0,
    1
  );

  return [start[0] + segment[0] * progress, start[1] + segment[1] * progress];
}

function getPointMargin(
  point: BalancePoint,
  polygon: readonly BalancePoint[]
): { inside: boolean; margin: number; nearestPoint: [number, number] | null } {
  if (polygon.length < 3 || polygonArea(polygon) <= EPSILON) {
    return { inside: false, margin: Number.NEGATIVE_INFINITY, nearestPoint: null };
  }

  let inside = true;
  let nearestPoint: [number, number] | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index];
    const end = polygon[(index + 1) % polygon.length];
    if (cross(start, end, point) < -EPSILON) {
      inside = false;
    }

    const candidate = closestPointOnSegment(point, start, end);
    const candidateDistance = distance(point, candidate);
    if (candidateDistance < nearestDistance) {
      nearestDistance = candidateDistance;
      nearestPoint = candidate;
    }
  }

  return {
    inside,
    margin: inside ? nearestDistance : -nearestDistance,
    nearestPoint,
  };
}

function sortCards(cards: readonly TableCard[]) {
  return [...cards].sort(
    (first, second) => first.zIndex - second.zIndex || first.id.localeCompare(second.id)
  );
}

/**
 * Computes visual contact planes from the same z-order used to render table
 * cards. A card with no lower overlap rests directly on the table.
 */
export function getCardStackLevels({
  cards,
  layout,
  baseHeight,
  layerStep,
}: {
  cards: readonly TableCard[];
  layout: CardBalanceLayout;
  baseHeight: number;
  layerStep: number;
}): Map<string, CardStackLevel> {
  const levels = new Map<string, CardStackLevel>();
  const sortedCards = sortCards(cards);

  sortedCards.forEach((card, index) => {
    const footprint = createCardFootprint(card, layout);
    const lowerLevels = sortedCards.slice(0, index).flatMap((lowerCard) => {
      const lowerLevel = levels.get(lowerCard.id);
      return lowerLevel && footprintsOverlap(footprint, lowerLevel.footprint)
        ? [lowerLevel]
        : [];
    });
    const height = lowerLevels.reduce(
      (maximum, lowerLevel) => Math.max(maximum, lowerLevel.height + layerStep),
      baseHeight
    );
    const supportCardIds = lowerLevels
      .filter((lowerLevel) => Math.abs(lowerLevel.height + layerStep - height) <= EPSILON)
      .map((lowerLevel) => lowerLevel.card.id);

    levels.set(card.id, { card, footprint, height, supportCardIds });
  });

  return levels;
}

/**
 * Evaluates whether the card's centre of mass is safely inside the convex
 * support polygon made by the contact patches beneath it.
 */
export function evaluateCardSupport({
  cardId,
  levels,
  layout,
  supportMargin = Math.min(layout.cardWidth, layout.cardHeight) * DEFAULT_SUPPORT_MARGIN_RATIO,
}: {
  cardId: string;
  levels: ReadonlyMap<string, CardStackLevel>;
  layout: CardBalanceLayout;
  supportMargin?: number;
}): CardSupportEvaluation | null {
  const level = levels.get(cardId);

  if (!level) {
    return null;
  }

  if (level.supportCardIds.length === 0) {
    return {
      cardId,
      contacts: [],
      kind: "table",
      margin: Number.POSITIVE_INFINITY,
      nearestPoint: null,
      overhang: 0,
      stable: true,
      supportPolygon: [],
    };
  }

  const contacts = level.supportCardIds.flatMap((supportCardId) => {
    const supportLevel = levels.get(supportCardId);
    if (!supportLevel) {
      return [];
    }

    const polygon = clipConvexPolygon(
      level.footprint.corners,
      supportLevel.footprint.corners
    );
    const area = polygonArea(polygon);
    return area > EPSILON ? [{ area, cardId: supportCardId, polygon }] : [];
  });
  const supportPolygon = getConvexHull(contacts.flatMap((contact) => contact.polygon));
  const pointMargin = getPointMargin(level.footprint.center, supportPolygon);
  const stable = pointMargin.inside && pointMargin.margin >= supportMargin;

  return {
    cardId,
    contacts,
    kind: "cards",
    margin: pointMargin.margin,
    nearestPoint: pointMargin.nearestPoint,
    overhang: Math.max(0, -pointMargin.margin),
    stable,
    supportPolygon,
  };
}

export function shouldFlipAfterFall({
  cardHeight,
  cardWidth,
  overhang,
  releaseVelocity = [0, 0],
}: {
  cardHeight: number;
  cardWidth: number;
  overhang: number;
  releaseVelocity?: BalancePoint;
}): boolean {
  const shortEdge = Math.max(EPSILON, Math.min(cardWidth, cardHeight));
  const speed = Math.hypot(releaseVelocity[0], releaseVelocity[1]);
  const score = overhang / shortEdge + Math.min(0.32, (speed / shortEdge) * 0.12);

  return score >= FLIP_SCORE_THRESHOLD;
}

function clampCardCenter(
  center: BalancePoint,
  rotation: number,
  layout: CardBalanceLayout
): [number, number] {
  if (!layout.dragBounds) {
    return [center[0], center[1]];
  }

  const radians = (rotation * Math.PI) / 180;
  const halfWidth =
    (Math.abs(Math.cos(radians)) * layout.cardWidth +
      Math.abs(Math.sin(radians)) * layout.cardHeight) /
    2;
  const halfHeight =
    (Math.abs(Math.sin(radians)) * layout.cardWidth +
      Math.abs(Math.cos(radians)) * layout.cardHeight) /
    2;
  const { bottom, left, right, top } = layout.dragBounds;

  return [
    clamp(center[0], left + halfWidth, right - halfWidth),
    clamp(center[1], bottom + halfHeight, top - halfHeight),
  ];
}

function toTablePoint(
  point: BalancePoint,
  layout: CardBalanceLayout
): TablePoint {
  return layout.toPoint ? layout.toPoint(point[0], point[1]) : [point[0], point[1]];
}

function createCandidateCard(
  card: TableCard,
  center: BalancePoint,
  rotation: number,
  layout: CardBalanceLayout
): TableCard {
  return {
    ...card,
    position: toTablePoint(center, layout),
    rotation,
  };
}

function overlapsHigherLayer(
  candidate: TableCard,
  cards: readonly TableCard[],
  layout: CardBalanceLayout
): boolean {
  const footprint = createCardFootprint(candidate, layout);

  return cards.some(
    (card) =>
      card.id !== candidate.id &&
      card.zIndex > candidate.zIndex &&
      footprintsOverlap(footprint, createCardFootprint(card, layout))
  );
}

/**
 * Resolves one released card. This intentionally does not mutate cards or
 * cascade; the reducer layer can call it repeatedly for a bounded settle pass.
 */
export function resolvePrimaryCardDrop({
  cards,
  primaryCardId,
  layout,
  baseHeight = 0,
  layerStep,
  releaseVelocity = [0, 0],
  supportMargin,
}: {
  cards: readonly TableCard[];
  primaryCardId: string;
  layout: CardBalanceLayout;
} & ResolvePrimaryCardDropOptions): CardFallResolution | null {
  const primaryCard = cards.find((card) => card.id === primaryCardId);

  if (!primaryCard) {
    return null;
  }

  const levels = getCardStackLevels({ cards, layout, baseHeight, layerStep });
  const assessment = evaluateCardSupport({
    cardId: primaryCardId,
    layout,
    levels,
    supportMargin,
  });

  if (!assessment || assessment.stable) {
    return assessment
      ? {
          assessment,
          direction: null,
          outcome: "stable",
          willFlipFace: false,
        }
      : null;
  }

  const primaryLevel = levels.get(primaryCardId);
  const centre = primaryLevel?.footprint.center ?? layout.toWorld(primaryCard.position);
  const nearestDirection = assessment.nearestPoint
    ? assessment.margin >= 0
      ? [
          assessment.nearestPoint[0] - centre[0],
          assessment.nearestPoint[1] - centre[1],
        ] satisfies BalancePoint
      : [
          centre[0] - assessment.nearestPoint[0],
          centre[1] - assessment.nearestPoint[1],
        ] satisfies BalancePoint
    : releaseVelocity;
  const escapeDirection = normalise(
    nearestDirection
  ) ?? getFallbackDirection(primaryCard.id);
  const driftSign = stableHash(`${primaryCard.id}:${primaryCard.rotation}`) < 0.5 ? -1 : 1;
  const shortEdge = Math.min(layout.cardWidth, layout.cardHeight);
  const velocityMagnitude = Math.hypot(releaseVelocity[0], releaseVelocity[1]);
  const rotationDrift =
    driftSign *
    clamp(
      MIN_FALL_ROTATION + (velocityMagnitude / Math.max(shortEdge, EPSILON)) * 4,
      MIN_FALL_ROTATION,
      MAX_FALL_ROTATION
    );
  const nextRotation = primaryCard.rotation + rotationDrift;

  for (const distanceScale of FALL_DISTANCES) {
    for (const angleOffset of FALL_ANGLE_OFFSETS) {
      const direction = rotate(escapeDirection, angleOffset);
      const rawCandidate: [number, number] = [
        centre[0] + direction[0] * shortEdge * distanceScale,
        centre[1] + direction[1] * shortEdge * distanceScale,
      ];
      const candidateCenter = clampCardCenter(rawCandidate, nextRotation, layout);
      const candidateCard = createCandidateCard(
        primaryCard,
        candidateCenter,
        nextRotation,
        layout
      );

      if (overlapsHigherLayer(candidateCard, cards, layout)) {
        continue;
      }

      const candidateCards = cards.map((card) =>
        card.id === primaryCardId ? candidateCard : card
      );
      const candidateLevels = getCardStackLevels({
        cards: candidateCards,
        layout,
        baseHeight,
        layerStep,
      });
      const candidateAssessment = evaluateCardSupport({
        cardId: primaryCardId,
        layout,
        levels: candidateLevels,
        supportMargin,
      });

      if (!candidateAssessment?.stable) {
        continue;
      }

      const willFlipFace = shouldFlipAfterFall({
        cardHeight: layout.cardHeight,
        cardWidth: layout.cardWidth,
        overhang: assessment.overhang,
        releaseVelocity,
      });

      return {
        assessment,
        direction,
        outcome: "fell",
        patch: {
          faceUp: willFlipFace ? !primaryCard.faceUp : primaryCard.faceUp,
          position: candidateCard.position,
          rotation: candidateCard.rotation,
        },
        willFlipFace,
      };
    }
  }

  return {
    assessment,
    direction: escapeDirection,
    outcome: "unresolved",
    willFlipFace: false,
  };
}
