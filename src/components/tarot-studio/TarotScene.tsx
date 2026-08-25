"use client";

import { Line, RoundedBox, useTexture } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import {
  type MutableRefObject,
  type RefCallback,
  memo,
  Suspense,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import {
  Group,
  MathUtils,
  OrthographicCamera,
  Shape,
  SRGBColorSpace,
} from "three";
import type {
  CardArtworkCrop,
  CardSetDefinition,
  TablePoint,
  TarotSession,
} from "@/types";
import {
  getRemainingDeckCount,
  getTopDeckCard,
} from "@/lib/tarot-session";
import type { CardSoundPlayer } from "@/lib/card-sounds";
import { CardArtwork, CARD_THICKNESS, CardMesh } from "./CardMesh";
import { CardPaperMaterial, getPaperSeed } from "./CardPaperMaterial";
import { getTableCardRestingHeights } from "./card-stacking";
import {
  createSceneTableLayout,
  DECK_MAT_HEIGHT_PADDING,
  DECK_MAT_WIDTH_PADDING,
  MIN_VIEW_ZOOM,
  type SceneBounds,
  type SceneTableLayout,
} from "./table-layout";
import { TAROT_SCENE_PALETTE } from "./theme";

const BASE_CAMERA_ZOOM = 75;
const TABLE_SURFACE_Z = -0.16;
const CARD_SURFACE_CLEARANCE = 0.002;
const DECK_MAT_SURFACE_Z = TABLE_SURFACE_Z + 0.003;
const TABLE_CARD_CONTACT_GAP = 0.002;
const DECK_STACK_RENDER_ORDER = 10;
const DECK_CARD_RENDER_ORDER = 20;
const TABLE_CARD_RENDER_ORDER = 100;
const CARD_RENDER_ORDER_STEP = 10;
const DRAG_RENDER_ORDER = 10_000;
const DECK_LAYER_REGISTRATION = [
  [-0.009, 0.005],
  [0.006, 0.003],
  [-0.005, -0.006],
  [0.009, -0.002],
  [-0.007, 0.002],
  [0.004, -0.006],
  [-0.002, 0.006],
  [0.007, -0.004],
  [-0.006, -0.001],
  [0.003, 0.005],
  [-0.004, -0.004],
  [0.005, 0.001],
] as const;
const CELESTIAL_MARKS = [
  [-0.38, 0.31, 0.018],
  [-0.29, 0.18, 0.011],
  [-0.17, 0.37, 0.014],
  [-0.06, 0.22, 0.01],
  [0.12, 0.34, 0.016],
  [0.25, 0.2, 0.01],
  [0.39, 0.29, 0.018],
  [-0.41, -0.22, 0.012],
  [-0.23, -0.34, 0.017],
  [-0.02, -0.27, 0.011],
  [0.16, -0.36, 0.015],
  [0.34, -0.19, 0.01],
] as const;
const ASTROLOGICAL_KINDS = [
  "moon",
  "venus",
  "sun",
  "mars",
  "mercury",
] as const;

function createRoundedRectangleShape(
  width: number,
  height: number,
  radius: number
) {
  const halfWidth = width / 2;
  const halfHeight = height / 2;
  const cornerRadius = Math.min(radius, halfWidth, halfHeight);
  const shape = new Shape();

  shape.moveTo(-halfWidth + cornerRadius, -halfHeight);
  shape.lineTo(halfWidth - cornerRadius, -halfHeight);
  shape.quadraticCurveTo(
    halfWidth,
    -halfHeight,
    halfWidth,
    -halfHeight + cornerRadius
  );
  shape.lineTo(halfWidth, halfHeight - cornerRadius);
  shape.quadraticCurveTo(
    halfWidth,
    halfHeight,
    halfWidth - cornerRadius,
    halfHeight
  );
  shape.lineTo(-halfWidth + cornerRadius, halfHeight);
  shape.quadraticCurveTo(
    -halfWidth,
    halfHeight,
    -halfWidth,
    halfHeight - cornerRadius
  );
  shape.lineTo(-halfWidth, -halfHeight + cornerRadius);
  shape.quadraticCurveTo(
    -halfWidth,
    -halfHeight,
    -halfWidth + cornerRadius,
    -halfHeight
  );

  return shape;
}

function createRoundedRectanglePoints(
  bounds: SceneBounds,
  radius: number,
  segments = 8
): Array<[number, number, number]> {
  const cornerRadius = Math.min(
    radius,
    (bounds.right - bounds.left) / 2,
    (bounds.top - bounds.bottom) / 2
  );
  const corners = [
    [bounds.right - cornerRadius, bounds.top - cornerRadius, 0],
    [bounds.left + cornerRadius, bounds.top - cornerRadius, Math.PI / 2],
    [bounds.left + cornerRadius, bounds.bottom + cornerRadius, Math.PI],
    [bounds.right - cornerRadius, bounds.bottom + cornerRadius, Math.PI * 1.5],
  ] as const;
  const points: Array<[number, number, number]> = [];

  corners.forEach(([centerX, centerY, startAngle]) => {
    for (let index = 0; index <= segments; index += 1) {
      const angle = startAngle + (index / segments) * (Math.PI / 2);
      points.push([
        centerX + Math.cos(angle) * cornerRadius,
        centerY + Math.sin(angle) * cornerRadius,
        0,
      ]);
    }
  });
  points.push(points[0]);
  return points;
}

function createArcPoints(
  radius: number,
  start: number,
  end: number,
  centerX = 0,
  segments = 28
): Array<[number, number, number]> {
  return Array.from({ length: segments + 1 }, (_, index) => {
    const angle = start + (index / segments) * (end - start);

    return [
      centerX + Math.cos(angle) * radius,
      Math.sin(angle) * radius,
      0,
    ];
  });
}

type AstrologicalMarkKind = (typeof ASTROLOGICAL_KINDS)[number];

type DriftingAstrologicalMark = {
  kind: AstrologicalMarkKind;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  phase: number;
  speed: number;
  driftX: number;
  driftY: number;
};

function createDriftingAstrologicalMarks(): DriftingAstrologicalMark[] {
  const markCount = 4 + Math.floor(Math.random() * 3);

  return Array.from({ length: markCount }, (_, index) => {
    const kind =
      ASTROLOGICAL_KINDS[
        Math.floor(Math.random() * ASTROLOGICAL_KINDS.length)
      ];
    const angle =
      (index / markCount) * Math.PI * 2 +
      (Math.random() - 0.5) * 0.68;
    const radiusX = 0.32 + Math.random() * 0.1;
    const radiusY = 0.27 + Math.random() * 0.1;

    return {
      kind,
      x: Math.cos(angle) * radiusX,
      y: Math.sin(angle) * radiusY,
      scale: 0.18 + Math.random() * 0.09,
      rotation: (Math.random() - 0.5) * 0.5,
      phase: Math.random() * Math.PI * 2,
      speed: 0.045 + Math.random() * 0.035,
      driftX: 0.025 + Math.random() * 0.035,
      driftY: 0.02 + Math.random() * 0.03,
    };
  });
}

function AstrologicalMark({
  kind,
  position,
  rotation,
  scale,
  markRef,
}: {
  kind: AstrologicalMarkKind;
  position: [number, number, number];
  rotation: number;
  scale: number;
  markRef?: RefCallback<Group>;
}) {
  const paths = useMemo(() => {
    const circle = createArcPoints(0.7, 0, Math.PI * 2);

    switch (kind) {
      case "moon":
        return [
          createArcPoints(0.9, -Math.PI * 0.68, Math.PI * 0.68),
          createArcPoints(0.72, Math.PI * 0.58, -Math.PI * 0.58, 0.28),
        ];
      case "venus":
        return [
          circle,
          [[0, -0.7, 0], [0, -1.55, 0]] as Array<[number, number, number]>,
          [[-0.42, -1.22, 0], [0.42, -1.22, 0]] as Array<
            [number, number, number]
          >,
        ];
      case "mars":
        return [
          circle,
          [[0.5, 0.5, 0], [1.3, 1.3, 0]] as Array<[number, number, number]>,
          [[0.83, 1.3, 0], [1.3, 1.3, 0], [1.3, 0.83, 0]] as Array<
            [number, number, number]
          >,
        ];
      case "mercury":
        return [
          circle,
          createArcPoints(0.64, Math.PI * 0.12, Math.PI * 0.88, 0),
          [[0, -0.7, 0], [0, -1.5, 0]] as Array<[number, number, number]>,
          [[-0.4, -1.18, 0], [0.4, -1.18, 0]] as Array<
            [number, number, number]
          >,
        ];
      case "sun":
      default:
        return [circle, createArcPoints(0.09, 0, Math.PI * 2)];
    }
  }, [kind]);

  return (
    <group
      ref={markRef}
      position={position}
      rotation={[0, 0, rotation]}
      scale={scale}
    >
      {paths.map((points, index) => (
        <Line
          key={index}
          points={points}
          color={TAROT_SCENE_PALETTE.celestialGold}
          lineWidth={0.7}
          transparent
          opacity={0.16}
          depthWrite={false}
        />
      ))}
    </group>
  );
}

function DriftingAstrologicalField({
  width,
  height,
  reducedMotion,
}: {
  width: number;
  height: number;
  reducedMotion: boolean;
}) {
  const invalidate = useThree((state) => state.invalidate);
  const marks = useMemo(createDriftingAstrologicalMarks, []);
  const markRefs = useRef<Array<Group | null>>([]);

  useEffect(() => {
    invalidate();

    if (reducedMotion) {
      return;
    }

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        invalidate();
      }
    }, 66);

    return () => window.clearInterval(interval);
  }, [invalidate, reducedMotion]);

  useFrame(({ clock }) => {
    if (reducedMotion) {
      return;
    }

    const elapsed = clock.getElapsedTime();

    marks.forEach((mark, index) => {
      const group = markRefs.current[index];

      if (!group) {
        return;
      }

      group.position.x =
        (mark.x + Math.sin(elapsed * mark.speed + mark.phase) * mark.driftX) *
        width;
      group.position.y =
        (mark.y +
          Math.cos(elapsed * mark.speed * 0.82 + mark.phase) * mark.driftY) *
        height;
      group.rotation.z =
        mark.rotation +
        Math.sin(elapsed * mark.speed * 0.65 + mark.phase) * 0.16;
    });
  });

  return marks.map((mark, index) => (
    <AstrologicalMark
      key={`${mark.kind}:${index}`}
      kind={mark.kind}
      position={[mark.x * width, mark.y * height, 0.001]}
      rotation={mark.rotation}
      scale={mark.scale}
      markRef={(group) => {
        markRefs.current[index] = group;
      }}
    />
  ));
}

type TarotSceneProps = {
  cardSet: CardSetDefinition;
  session: TarotSession;
  reducedMotion: boolean;
  viewZoom: number;
  /**
   * The camera centre in scene world units. This intentionally stays
   * independent from `viewZoom`, so callers can map a space-drag delta to
   * world coordinates without rescaling the table or cards.
   */
  viewPan?: TablePoint;
  deckMoveMode: boolean;
  onLayoutChange: (layout: SceneTableLayout) => void;
  onSelect: (cardId: string | null) => void;
  onDraw: (
    cardId: string,
    position: TablePoint,
    rotation?: number
  ) => void;
  onMoveDeck: (position: TablePoint) => void;
  onMove: (
    cardId: string,
    position: TablePoint,
    rotation?: number
  ) => void;
  onFlip: (cardId: string) => void;
  onRotate: (cardId: string, degrees: number) => void;
  onHover: (cardId: string | null) => void;
  onSound: CardSoundPlayer;
};

function AnimatedCameraZoom({
  value,
  reducedMotion,
}: {
  value: number;
  reducedMotion: boolean;
}) {
  const camera = useThree((state) => state.camera) as OrthographicCamera;
  const invalidate = useThree((state) => state.invalidate);
  const targetZoom = BASE_CAMERA_ZOOM * value;

  useEffect(() => {
    invalidate();
  }, [invalidate, targetZoom]);

  useFrame((_, delta) => {
    const nextZoom = reducedMotion
      ? targetZoom
      : MathUtils.damp(camera.zoom, targetZoom, 9, delta);

    if (Math.abs(camera.zoom - nextZoom) > 0.0001) {
      camera.zoom = nextZoom;
      camera.updateProjectionMatrix();
    }

    if (Math.abs(nextZoom - targetZoom) > 0.01) {
      invalidate();
    }
  });

  return null;
}

function CameraPan({ value }: { value?: TablePoint }) {
  const camera = useThree((state) => state.camera) as OrthographicCamera;
  const invalidate = useThree((state) => state.invalidate);
  const [x, y] = value ?? [0, 0];

  useEffect(() => {
    if (camera.position.x === x && camera.position.y === y) {
      return;
    }

    camera.position.set(x, y, camera.position.z);
    camera.updateMatrixWorld();
    invalidate();
  }, [camera, invalidate, x, y]);

  return null;
}

function getDeckMetrics(count: number) {
  const layerCount =
    count > 0
      ? Math.min(
          DECK_LAYER_REGISTRATION.length,
          Math.max(1, Math.ceil(count / 7))
        )
      : 0;
  const layerThickness = 0.018;
  const layerStep = 0.019;
  const firstCenter =
    DECK_MAT_SURFACE_Z + CARD_SURFACE_CLEARANCE + layerThickness / 2;
  const topSurface = layerCount
    ? firstCenter + (layerCount - 1) * layerStep + layerThickness / 2
    : DECK_MAT_SURFACE_Z;

  return {
    firstCenter,
    layerCount,
    layerStep,
    layerThickness,
    topSurface,
    topCardCenter:
      topSurface + CARD_THICKNESS / 2 + CARD_SURFACE_CLEARANCE,
  };
}

function getDeckLayerOffset(
  index: number,
  layerCount: number,
  width: number,
  height: number
): TablePoint {
  const registration =
    DECK_LAYER_REGISTRATION[index % DECK_LAYER_REGISTRATION.length];
  const depth =
    layerCount <= 1 ? 0 : (layerCount - 1 - index) / (layerCount - 1);

  return [
    (-depth * 0.014 + registration[0] * depth * 0.32) * width,
    (-depth * 0.01 + registration[1] * depth * 0.32) * height,
  ];
}

function DeckMat({ width, height }: { width: number; height: number }) {
  const matWidth = width + DECK_MAT_WIDTH_PADDING;
  const matHeight = height + DECK_MAT_HEIGHT_PADDING;
  const shape = useMemo(
    () => createRoundedRectangleShape(matWidth, matHeight, 0.24),
    [matHeight, matWidth]
  );
  const outline = useMemo(
    () =>
      createRoundedRectanglePoints(
        {
          left: -matWidth / 2 + 0.12,
          right: matWidth / 2 - 0.12,
          top: matHeight / 2 - 0.12,
          bottom: -matHeight / 2 + 0.12,
        },
        0.16
      ),
    [matHeight, matWidth]
  );
  const surfaceZ = DECK_MAT_SURFACE_Z;

  return (
    <group renderOrder={0}>
      <mesh position={[0, 0, surfaceZ]} receiveShadow>
        <shapeGeometry args={[shape, 12]} />
        <meshStandardMaterial
          color={TAROT_SCENE_PALETTE.deckMat}
          roughness={1}
          metalness={0}
        />
      </mesh>
      <Line
        points={outline}
        position={[0, 0, surfaceZ + 0.001]}
        color={TAROT_SCENE_PALETTE.deckMatEdge}
        lineWidth={0.7}
        transparent
        opacity={0.5}
        depthWrite={false}
      />
      <group position={[0, -matHeight * 0.43, surfaceZ + 0.0015]}>
        <Line
          points={createArcPoints(0.085, 0, Math.PI * 2)}
          color={TAROT_SCENE_PALETTE.celestialGold}
          lineWidth={0.65}
          transparent
          opacity={0.42}
          depthWrite={false}
        />
        <mesh>
          <circleGeometry args={[0.018, 12]} />
          <meshBasicMaterial
            color={TAROT_SCENE_PALETTE.celestialGold}
            transparent
            opacity={0.42}
            depthWrite={false}
          />
        </mesh>
      </group>
    </group>
  );
}

function DeckStack({
  count,
  showMat,
  position,
  width,
  height,
  backUrl,
  artworkCrop,
  reducedMotion,
  previewPositionRef,
}: {
  count: number;
  showMat: boolean;
  position: TablePoint;
  width: number;
  height: number;
  backUrl: string;
  artworkCrop?: CardArtworkCrop;
  reducedMotion: boolean;
  previewPositionRef: MutableRefObject<TablePoint | null>;
}) {
  const groupRef = useRef<Group>(null);
  const hasPositionedRef = useRef(false);
  const invalidate = useThree((state) => state.invalidate);
  const metrics = getDeckMetrics(count);

  useLayoutEffect(() => {
    const group = groupRef.current;

    if (!group || hasPositionedRef.current) {
      return;
    }

    group.position.set(position[0], position[1], 0);
    hasPositionedRef.current = true;
  }, [metrics.layerCount, position]);

  useEffect(() => {
    if (metrics.layerCount === 0) {
      hasPositionedRef.current = false;
    }

    invalidate();
  }, [invalidate, metrics.layerCount, position]);

  useFrame((_, delta) => {
    const group = groupRef.current;

    if (!group) {
      return;
    }

    const previewPosition = previewPositionRef.current;
    const target = previewPosition ?? position;

    if (previewPosition) {
      group.position.x = target[0];
      group.position.y = target[1];
      return;
    }

    const nextX = reducedMotion
      ? target[0]
      : MathUtils.damp(group.position.x, target[0], 24, delta);
    const nextY = reducedMotion
      ? target[1]
      : MathUtils.damp(group.position.y, target[1], 24, delta);

    group.position.x = nextX;
    group.position.y = nextY;

    if (
      Math.abs(nextX - target[0]) > 0.0008 ||
      Math.abs(nextY - target[1]) > 0.0008
    ) {
      invalidate();
    }
  });

  if (!showMat && metrics.layerCount === 0) {
    return null;
  }

  const frameInset = Math.min(0.34, width * 0.105);
  const [topOffsetX, topOffsetY] = metrics.layerCount
    ? getDeckLayerOffset(
        metrics.layerCount - 1,
        metrics.layerCount,
        width,
        height
      )
    : [0, 0];

  return (
    <group ref={groupRef} renderOrder={DECK_STACK_RENDER_ORDER}>
      {showMat && <DeckMat width={width} height={height} />}
      {Array.from({ length: metrics.layerCount }, (_, index) => {
        const [offsetX, offsetY] = getDeckLayerOffset(
          index,
          metrics.layerCount,
          width,
          height
        );

        return (
          <RoundedBox
            key={index}
            args={[width, height, metrics.layerThickness]}
            radius={0.045}
            smoothness={3}
            position={[
              offsetX,
              offsetY,
              metrics.firstCenter + index * metrics.layerStep,
            ]}
            renderOrder={index}
            castShadow
            receiveShadow
          >
            <CardPaperMaterial
              color={
                index % 2
                  ? TAROT_SCENE_PALETTE.cardPaper
                  : TAROT_SCENE_PALETTE.cardPaperShadow
              }
              roughness={index % 2 ? 0.88 : 0.84}
              paperSeed={getPaperSeed(`${backUrl}:${index}`)}
              depthWrite={false}
            />
          </RoundedBox>
        );
      })}
      {metrics.layerCount > 0 && (
        <Suspense fallback={null}>
          {/* This passive face becomes the next card back while the live top
              card is lifted, without adding another pointer target. */}
          <CardArtwork
            url={backUrl}
            crop={artworkCrop}
            position={[topOffsetX, topOffsetY, metrics.topSurface + 0.002]}
            width={width - frameInset}
            height={height - frameInset}
            renderOrder={metrics.layerCount + 1}
            paperSeed={getPaperSeed(`${backUrl}:passive`)}
            depthWrite={false}
          />
        </Suspense>
      )}
    </group>
  );
}

function TableSurface({
  width,
  height,
  dragBounds,
  reducedMotion,
  onSelect,
}: {
  width: number;
  height: number;
  dragBounds: SceneBounds;
  reducedMotion: boolean;
  onSelect: (cardId: string | null) => void;
}) {
  const visibleWidth = (width / MIN_VIEW_ZOOM) * 1.04;
  const visibleHeight = (height / MIN_VIEW_ZOOM) * 1.04;
  const celestialRadius = Math.min(visibleWidth, visibleHeight) * 0.19;
  const dragOutline = useMemo(
    () => createRoundedRectanglePoints(dragBounds, 0.5, 10),
    [dragBounds]
  );

  return (
    <>
      <mesh
        position={[0, 0, TABLE_SURFACE_Z]}
        receiveShadow
        onPointerDown={() => onSelect(null)}
      >
        <planeGeometry args={[visibleWidth, visibleHeight]} />
        <meshStandardMaterial
          color={TAROT_SCENE_PALETTE.table}
          roughness={0.94}
          metalness={0.012}
          emissive={TAROT_SCENE_PALETTE.tableEmissive}
          emissiveIntensity={0.24}
        />
      </mesh>
      <group position={[0, 0, TABLE_SURFACE_Z + 0.002]} renderOrder={1}>
        <Line
          points={dragOutline}
          color={TAROT_SCENE_PALETTE.dragBoundary}
          lineWidth={0.7}
          transparent
          opacity={0.2}
          depthWrite={false}
        />
        <mesh rotation={[0, 0, -0.18]} renderOrder={1}>
          <ringGeometry
            args={[
              celestialRadius,
              celestialRadius + 0.012,
              96,
              1,
              0.3,
              Math.PI * 1.25,
            ]}
          />
          <meshBasicMaterial
            color={TAROT_SCENE_PALETTE.celestialGold}
            transparent
            opacity={0.11}
            depthWrite={false}
          />
        </mesh>
        <mesh rotation={[0, 0, Math.PI + 0.22]} renderOrder={1}>
          <ringGeometry
            args={[
              celestialRadius * 1.34,
              celestialRadius * 1.34 + 0.008,
              96,
              1,
              0.2,
              Math.PI * 0.92,
            ]}
          />
          <meshBasicMaterial
            color={TAROT_SCENE_PALETTE.fillLight}
            transparent
            opacity={0.085}
            depthWrite={false}
          />
        </mesh>
        {CELESTIAL_MARKS.map(([x, y, radius], index) => (
          <mesh
            key={`${x}:${y}`}
            position={[x * visibleWidth, y * visibleHeight, 0]}
            rotation={[0, 0, index * 0.31]}
            renderOrder={1}
          >
            <circleGeometry args={[radius, index % 3 === 0 ? 5 : 4]} />
            <meshBasicMaterial
              color={
                index % 2
                  ? TAROT_SCENE_PALETTE.fillLight
                  : TAROT_SCENE_PALETTE.celestialGold
              }
              transparent
              opacity={index % 3 === 0 ? 0.2 : 0.13}
              depthWrite={false}
            />
          </mesh>
        ))}
        <DriftingAstrologicalField
          width={width}
          height={height}
          reducedMotion={reducedMotion}
        />
      </group>
    </>
  );
}

function TarotTable({
  cardSet,
  session,
  reducedMotion,
  deckMoveMode,
  onSelect,
  onDraw,
  onMoveDeck,
  onMove,
  onFlip,
  onRotate,
  onHover,
  onSound,
  onLayoutChange,
}: TarotSceneProps) {
  const size = useThree((state) => state.size);
  const invalidate = useThree((state) => state.invalidate);
  const deckPreviewPositionRef = useRef<TablePoint | null>(null);
  const baseViewportWidth = size.width / BASE_CAMERA_ZOOM;
  const baseViewportHeight = size.height / BASE_CAMERA_ZOOM;
  const shadowHalfWidth = (baseViewportWidth / MIN_VIEW_ZOOM) * 0.55;
  const shadowHalfHeight = (baseViewportHeight / MIN_VIEW_ZOOM) * 0.55;
  const layout = useMemo(
    () =>
      createSceneTableLayout({
        viewportWidth: baseViewportWidth,
        viewportHeight: baseViewportHeight,
        pixelWidth: size.width,
        cardAspectRatio: cardSet.cardAspectRatio,
      }),
    [
      baseViewportHeight,
      baseViewportWidth,
      cardSet.cardAspectRatio,
      size.width,
    ]
  );
  const definitions = useMemo(
    () => new Map(cardSet.cards.map((card) => [card.id, card])),
    [cardSet.cards]
  );
  const deckPreloadUrls = useMemo(
    () =>
      session.cards
        .filter((card) => card.zone === "deck")
        .sort((first, second) => second.zIndex - first.zIndex)
        .slice(0, 3)
        .flatMap((card) => {
          const definition = definitions.get(card.cardId);

          return definition ? [definition.image.preview] : [];
        }),
    [definitions, session.cards]
  );
  const tableCards = useMemo(
    () =>
      session.cards
        .filter((card) => card.zone === "table")
        .sort((first, second) => first.zIndex - second.zIndex),
    [session.cards]
  );
  const topDeckCard = getTopDeckCard(session);
  const deckCount = getRemainingDeckCount(session);
  const resolvedDeckPosition =
    session.deckPosition ?? layout.defaultDeckPosition;
  const deckPosition = useMemo(
    () => layout.toWorld(resolvedDeckPosition),
    [layout, resolvedDeckPosition]
  );
  const previewDeckPosition = useCallback(
    (position: TablePoint | null) => {
      deckPreviewPositionRef.current = position;
      invalidate();
    },
    [invalidate]
  );
  const deckMetrics = getDeckMetrics(Math.max(0, deckCount - 1));
  const visibleCards = topDeckCard
    ? [topDeckCard, ...tableCards]
    : tableCards;
  const tableOrder = new Map(
    tableCards.map((card, index) => [card.id, index])
  );
  const baseTableCardZ =
    TABLE_SURFACE_Z + CARD_THICKNESS / 2 + CARD_SURFACE_CLEARANCE;
  const tableCardRestingHeights = useMemo(
    () =>
      getTableCardRestingHeights({
        cards: tableCards,
        layout,
        baseHeight: baseTableCardZ,
        layerStep: CARD_THICKNESS + TABLE_CARD_CONTACT_GAP,
      }),
    [baseTableCardZ, layout, tableCards]
  );
  const highestTableCardZ = Math.max(
    baseTableCardZ,
    ...Array.from(tableCardRestingHeights.values())
  );
  const draggingZ =
    Math.max(deckMetrics.topCardCenter, highestTableCardZ) +
    CARD_THICKNESS +
    0.035;

  useEffect(() => {
    useTexture.preload(cardSet.back.preview);
    deckPreloadUrls.forEach((url) => useTexture.preload(url));
  }, [cardSet.back.preview, deckPreloadUrls]);

  useLayoutEffect(() => {
    onLayoutChange(layout);
  }, [layout, onLayoutChange]);

  return (
    <>
      <ambientLight intensity={0.48} />
      <directionalLight
        castShadow
        position={[-3, 4.5, 12]}
        intensity={2.45}
        color={TAROT_SCENE_PALETTE.keyLight}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.00035}
        shadow-radius={8}
        shadow-normalBias={0.001}
        shadow-camera-left={-shadowHalfWidth}
        shadow-camera-right={shadowHalfWidth}
        shadow-camera-top={shadowHalfHeight}
        shadow-camera-bottom={-shadowHalfHeight}
        shadow-camera-near={0.1}
        shadow-camera-far={24}
      />
      <pointLight
        position={[4, -2, 5]}
        intensity={4.2}
        distance={14}
        color={TAROT_SCENE_PALETTE.fillLight}
      />
      <TableSurface
        width={baseViewportWidth}
        height={baseViewportHeight}
        dragBounds={layout.dragBounds}
        reducedMotion={reducedMotion}
        onSelect={onSelect}
      />
      <DeckStack
        count={Math.max(0, deckCount - 1)}
        showMat={deckCount > 0}
        position={deckPosition}
        width={layout.cardWidth}
        height={layout.cardHeight}
        backUrl={cardSet.back.preview}
        artworkCrop={cardSet.artworkCrop}
        reducedMotion={reducedMotion}
        previewPositionRef={deckPreviewPositionRef}
      />
      {visibleCards.map((card) => {
        const definition = definitions.get(card.cardId);

        if (!definition) {
          return null;
        }

        const tableIndex = tableOrder.get(card.id) ?? 0;
        const restingZ =
          card.zone === "deck"
            ? deckMetrics.topCardCenter
            : tableCardRestingHeights.get(card.id) ?? baseTableCardZ;
        const renderOrder =
          card.zone === "deck"
            ? DECK_CARD_RENDER_ORDER
            : TABLE_CARD_RENDER_ORDER +
              tableIndex * CARD_RENDER_ORDER_STEP;
        const interactionZ =
          card.zone === "deck"
            ? restingZ + CARD_THICKNESS / 2 + 0.04
            : draggingZ + 0.02 + tableIndex * 0.002;

        return (
          <CardMesh
            key={card.id}
            card={card}
            definition={definition}
            cardSet={cardSet}
            layout={layout}
            deckPosition={deckPosition}
            restingZ={restingZ}
            interactionZ={interactionZ}
            draggingZ={draggingZ}
            renderOrder={renderOrder}
            dragRenderOrder={DRAG_RENDER_ORDER}
            selected={session.selectedCardId === card.id}
            reducedMotion={reducedMotion}
            deckMoveMode={deckMoveMode}
            onSelect={onSelect}
            onDraw={onDraw}
            onMoveDeck={onMoveDeck}
            onPreviewDeckPosition={previewDeckPosition}
            onMove={onMove}
            onFlip={onFlip}
            onRotate={onRotate}
            onHover={onHover}
            onSound={onSound}
          />
        );
      })}
    </>
  );
}

export const TarotScene = memo(function TarotScene(props: TarotSceneProps) {
  return (
    <Canvas
      className="tarot-canvas"
      orthographic
      shadows="soft"
      dpr={[1, 1.5]}
      frameloop="demand"
      camera={{
        position: [0, 0, 10],
        zoom: BASE_CAMERA_ZOOM,
        near: 0.1,
        far: 100,
      }}
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.outputColorSpace = SRGBColorSpace;
        gl.setClearAlpha(0);
      }}
    >
      <AnimatedCameraZoom
        value={props.viewZoom}
        reducedMotion={props.reducedMotion}
      />
      <CameraPan value={props.viewPan} />
      <TarotTable {...props} />
    </Canvas>
  );
});
