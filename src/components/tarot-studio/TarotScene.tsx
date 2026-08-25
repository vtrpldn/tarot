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
import { getCardStackOffset } from "@/lib/card-stack-layout";
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
  clampViewPan,
  DECK_MAT_HEIGHT_PADDING,
  DECK_MAT_WIDTH_PADDING,
  MIN_VIEW_ZOOM,
  TABLE_SURFACE_OVERSCAN,
  type SceneBounds,
  type SceneTableLayout,
} from "./table-layout";
import {
  getSceneTheme,
  MAX_SCENE_LIGHT_INTENSITY,
  MIN_SCENE_LIGHT_INTENSITY,
  type ScenePalette,
  type SceneSettings,
} from "./theme";

const BASE_CAMERA_ZOOM = 75;
const TABLE_SURFACE_Z = -0.16;
const CARD_SURFACE_CLEARANCE = 0.002;
const DECK_MAT_SURFACE_Z = TABLE_SURFACE_Z + 0.003;
const TABLE_CARD_CONTACT_GAP = 0.002;
const DECK_STACK_RENDER_ORDER = 1_000;
const DECK_CARD_RENDER_ORDER = 2_000;
const TABLE_CARD_RENDER_ORDER = 100;
const CARD_RENDER_ORDER_STEP = 10;
const DRAG_RENDER_ORDER = 10_000;
const MAX_DECK_VISUAL_LAYERS = 12;
const MAX_DECK_STACK_HEIGHT = 0.21;
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
  "jupiter",
  "saturn",
  "uranus",
  "neptune",
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
  opacity: number;
};

function createDriftingAstrologicalMarks(): DriftingAstrologicalMark[] {
  const createGrid = ({
    columns,
    rows,
    extentX,
    extentY,
    minimumScale,
    scaleVariation,
  }: {
    columns: number;
    rows: number;
    extentX: number;
    extentY: number;
    minimumScale: number;
    scaleVariation: number;
  }) => Array.from({ length: columns * rows }, (_, index) => {
    const kind =
      ASTROLOGICAL_KINDS[
        Math.floor(Math.random() * ASTROLOGICAL_KINDS.length)
      ];
    const column = index % columns;
    const row = Math.floor(index / columns);
    const normalizedX =
      (column + 0.5 + (Math.random() - 0.5) * 0.62) / columns;
    const normalizedY =
      (row + 0.5 + (Math.random() - 0.5) * 0.62) / rows;

    return {
      kind,
      x: (normalizedX - 0.5) * 2 * extentX,
      y: (normalizedY - 0.5) * 2 * extentY,
      scale: minimumScale + Math.random() * scaleVariation,
      rotation: (Math.random() - 0.5) * 0.72,
      phase: Math.random() * Math.PI * 2,
      speed: 0.035 + Math.random() * 0.04,
      driftX: 0.004 + Math.random() * 0.007,
      driftY: 0.004 + Math.random() * 0.007,
      opacity: 0.1 + Math.random() * 0.08,
    };
  });

  return [
    ...createGrid({
      columns: 5,
      rows: 4,
      extentX: 0.14,
      extentY: 0.14,
      minimumScale: 0.16,
      scaleVariation: 0.08,
    }),
    ...createGrid({
      columns: 7,
      rows: 4,
      extentX: 0.47,
      extentY: 0.46,
      minimumScale: 0.18,
      scaleVariation: 0.12,
    }),
  ];
}

function AstrologicalMark({
  color,
  kind,
  position,
  rotation,
  scale,
  opacity,
  markRef,
}: {
  color: string;
  kind: AstrologicalMarkKind;
  position: [number, number, number];
  rotation: number;
  scale: number;
  opacity: number;
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
      case "jupiter":
        return [
          [
            [-0.82, 0.55, 0],
            [-0.12, 0.55, 0],
            [0.42, 1.08, 0],
          ] as Array<[number, number, number]>,
          [
            [0.12, 1.02, 0],
            [-0.5, 0.12, 0],
            [0.38, -0.18, 0],
            [0.38, -1.08, 0],
          ] as Array<[number, number, number]>,
          [[-0.14, -0.58, 0], [0.82, -0.58, 0]] as Array<
            [number, number, number]
          >,
        ];
      case "saturn":
        return [
          [
            [-0.38, 1.1, 0],
            [-0.38, -0.18, 0],
            [0.18, -0.72, 0],
            [0.62, -0.38, 0],
          ] as Array<[number, number, number]>,
          [[-0.86, 0.55, 0], [0.28, 0.55, 0]] as Array<
            [number, number, number]
          >,
          createArcPoints(0.58, -Math.PI * 0.58, Math.PI * 0.38, 0.08),
        ];
      case "uranus":
        return [
          circle,
          [[0, 1.2, 0], [0, -1.2, 0]] as Array<[number, number, number]>,
          [
            [-0.95, 0.72, 0],
            [-0.48, 0.72, 0],
            [-0.48, -0.72, 0],
            [-0.95, -0.72, 0],
          ] as Array<[number, number, number]>,
          [
            [0.95, 0.72, 0],
            [0.48, 0.72, 0],
            [0.48, -0.72, 0],
            [0.95, -0.72, 0],
          ] as Array<[number, number, number]>,
        ];
      case "neptune":
        return [
          [[0, 1.15, 0], [0, -1.18, 0]] as Array<[number, number, number]>,
          [
            [-0.88, 0.84, 0],
            [-0.88, 0.28, 0],
            [0, -0.12, 0],
            [0.88, 0.28, 0],
            [0.88, 0.84, 0],
          ] as Array<[number, number, number]>,
          [[-1.12, 0.64, 0], [-0.88, 0.9, 0], [-0.64, 0.64, 0]] as Array<
            [number, number, number]
          >,
          [[0.64, 0.64, 0], [0.88, 0.9, 0], [1.12, 0.64, 0]] as Array<
            [number, number, number]
          >,
          [[-0.48, -0.78, 0], [0.48, -0.78, 0]] as Array<
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
          color={color}
          lineWidth={0.7}
          transparent
          opacity={opacity}
          depthWrite={false}
        />
      ))}
    </group>
  );
}

function DriftingAstrologicalField({
  color,
  width,
  height,
  reducedMotion,
}: {
  color: string;
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
      color={color}
      kind={mark.kind}
      position={[mark.x * width, mark.y * height, 0.001]}
      rotation={mark.rotation}
      scale={mark.scale}
      opacity={mark.opacity}
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
  sceneSettings: SceneSettings;
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

function CameraPan({
  value,
  viewportBounds,
  targetZoom,
}: {
  value?: TablePoint;
  viewportBounds: SceneBounds;
  targetZoom: number;
}) {
  const camera = useThree((state) => state.camera) as OrthographicCamera;
  const invalidate = useThree((state) => state.invalidate);

  useEffect(() => {
    invalidate();
  }, [invalidate, targetZoom, value, viewportBounds]);

  useFrame(() => {
    const currentZoom = camera.zoom / BASE_CAMERA_ZOOM;
    const safeZoom = Math.min(targetZoom, currentZoom);
    const [x, y] = clampViewPan(
      value ?? [0, 0],
      viewportBounds,
      safeZoom
    );

    if (camera.position.x === x && camera.position.y === y) {
      return;
    }

    camera.position.set(x, y, camera.position.z);
    camera.updateMatrixWorld();
  });

  return null;
}

function getDeckMetrics(lowerCardCount: number, deckCapacity: number) {
  const layerCount = Math.min(
    MAX_DECK_VISUAL_LAYERS,
    Math.max(0, lowerCardCount)
  );
  const drawableCardCount = Math.max(1, deckCapacity - 1);
  const stackHeight =
    layerCount > 0
      ? (Math.min(lowerCardCount, drawableCardCount) / drawableCardCount) *
        MAX_DECK_STACK_HEIGHT
      : 0;
  const layerThickness = layerCount ? stackHeight / layerCount : 0;
  const layerStep = layerThickness;
  const firstCenter =
    DECK_MAT_SURFACE_Z + CARD_SURFACE_CLEARANCE + layerThickness / 2;
  const topSurface = layerCount
    ? DECK_MAT_SURFACE_Z + CARD_SURFACE_CLEARANCE + stackHeight
    : DECK_MAT_SURFACE_Z;

  return {
    firstCenter,
    layerCount,
    layerStep,
    layerThickness,
    stackHeight,
    stackHeightRatio: stackHeight / MAX_DECK_STACK_HEIGHT,
    topSurface,
    topCardCenter:
      topSurface + CARD_THICKNESS / 2 + CARD_SURFACE_CLEARANCE,
  };
}

function getDeckLayerOffset(
  index: number,
  layerCount: number,
  stackHeightRatio: number,
  layout: SceneTableLayout
): TablePoint {
  if (layerCount <= 1 || stackHeightRatio <= 0) {
    return [0, 0];
  }

  const depth = index / (layerCount - 1);
  const [topX, topY] = getCardStackOffset(
    MAX_DECK_VISUAL_LAYERS,
    MAX_DECK_VISUAL_LAYERS + 1
  );
  const origin = layout.toWorld([0, 0]);
  const layer = layout.toWorld([
    (depth - 1) * topX * stackHeightRatio,
    (depth - 1) * topY * stackHeightRatio,
  ]);

  return [layer[0] - origin[0], layer[1] - origin[1]];
}

function DeckMat({
  palette,
  width,
  height,
  position,
}: {
  palette: ScenePalette;
  width: number;
  height: number;
  position: TablePoint;
}) {
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
    <group position={[position[0], position[1], 0]} renderOrder={0}>
      <mesh position={[0, 0, surfaceZ]} receiveShadow>
        <shapeGeometry args={[shape, 12]} />
        <meshStandardMaterial
          color={palette.deckMat}
          roughness={1}
          metalness={0}
        />
      </mesh>
      <Line
        points={outline}
        position={[0, 0, surfaceZ + 0.001]}
        color={palette.deckMatEdge}
        lineWidth={0.7}
        transparent
        opacity={0.5}
        depthWrite={false}
      />
      <group position={[0, -matHeight * 0.43, surfaceZ + 0.0015]}>
        <Line
          points={createArcPoints(0.085, 0, Math.PI * 2)}
          color={palette.celestialGold}
          lineWidth={0.65}
          transparent
          opacity={0.42}
          depthWrite={false}
        />
        <mesh>
          <circleGeometry args={[0.018, 12]} />
          <meshBasicMaterial
            color={palette.celestialGold}
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
  deckCapacity,
  palette,
  showMat,
  position,
  layout,
  width,
  height,
  backUrl,
  artworkCrop,
  reducedMotion,
  previewPositionRef,
}: {
  count: number;
  deckCapacity: number;
  palette: ScenePalette;
  showMat: boolean;
  position: TablePoint;
  layout: SceneTableLayout;
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
  const metrics = getDeckMetrics(count, deckCapacity);

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
  }, [invalidate, metrics.layerCount, metrics.stackHeight, position]);

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
  const layerOffsets = Array.from({ length: metrics.layerCount }, (_, index) =>
    getDeckLayerOffset(
      index,
      metrics.layerCount,
      metrics.stackHeightRatio,
      layout
    )
  );
  const footprintOffsets = [[0, 0] as TablePoint, ...layerOffsets];
  const minimumOffsetX = Math.min(
    ...footprintOffsets.map(([offsetX]) => offsetX)
  );
  const maximumOffsetX = Math.max(
    ...footprintOffsets.map(([offsetX]) => offsetX)
  );
  const minimumOffsetY = Math.min(
    ...footprintOffsets.map(([, offsetY]) => offsetY)
  );
  const maximumOffsetY = Math.max(
    ...footprintOffsets.map(([, offsetY]) => offsetY)
  );
  const matPosition: TablePoint = [
    (minimumOffsetX + maximumOffsetX) / 2,
    (minimumOffsetY + maximumOffsetY) / 2,
  ];
  const matWidth = width + maximumOffsetX - minimumOffsetX;
  const matHeight = height + maximumOffsetY - minimumOffsetY;
  const [topOffsetX, topOffsetY] =
    layerOffsets[metrics.layerCount - 1] ?? [0, 0];
  const shadowCasterBottom =
    DECK_MAT_SURFACE_Z + CARD_SURFACE_CLEARANCE;
  const shadowCasterTop =
    metrics.topCardCenter + CARD_THICKNESS / 2;
  const shadowCasterHeight = shadowCasterTop - shadowCasterBottom;

  return (
    <group ref={groupRef} renderOrder={DECK_STACK_RENDER_ORDER}>
      {showMat && (
        <DeckMat
          palette={palette}
          width={matWidth}
          height={matHeight}
          position={matPosition}
        />
      )}
      {showMat && (
        <RoundedBox
          args={[matWidth, matHeight, shadowCasterHeight]}
          radius={0.045}
          smoothness={3}
          position={[
            matPosition[0],
            matPosition[1],
            shadowCasterBottom + shadowCasterHeight / 2,
          ]}
          castShadow
          receiveShadow={false}
        >
          <meshBasicMaterial
            colorWrite={false}
            depthTest={false}
            depthWrite={false}
          />
        </RoundedBox>
      )}
      {Array.from({ length: metrics.layerCount }, (_, index) => {
        const [offsetX, offsetY] = layerOffsets[index];

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
            castShadow={false}
            receiveShadow={false}
          >
            <CardPaperMaterial
              color={
                index % 2
                  ? palette.cardPaper
                  : palette.cardPaperShadow
              }
              roughness={index % 2 ? 0.88 : 0.84}
              paperSeed={getPaperSeed(`${backUrl}:${index}`)}
              depthTest={false}
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
            depthTest={false}
          />
        </Suspense>
      )}
    </group>
  );
}

function TableSurface({
  palette,
  width,
  height,
  dragBounds,
  reducedMotion,
  onSelect,
}: {
  palette: ScenePalette;
  width: number;
  height: number;
  dragBounds: SceneBounds;
  reducedMotion: boolean;
  onSelect: (cardId: string | null) => void;
}) {
  const visibleWidth =
    (width / MIN_VIEW_ZOOM) * TABLE_SURFACE_OVERSCAN;
  const visibleHeight =
    (height / MIN_VIEW_ZOOM) * TABLE_SURFACE_OVERSCAN;
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
          color={palette.table}
          roughness={0.94}
          metalness={0.012}
          emissive={palette.tableEmissive}
          emissiveIntensity={0.24}
        />
      </mesh>
      <group position={[0, 0, TABLE_SURFACE_Z + 0.002]} renderOrder={1}>
        <Line
          points={dragOutline}
          color={palette.dragBoundary}
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
            color={palette.celestialGold}
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
            color={palette.fillLight}
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
                  ? palette.fillLight
                  : palette.celestialGold
              }
              transparent
              opacity={index % 3 === 0 ? 0.2 : 0.13}
              depthWrite={false}
            />
          </mesh>
        ))}
        <DriftingAstrologicalField
          color={palette.celestialGold}
          width={visibleWidth}
          height={visibleHeight}
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
  sceneSettings,
  viewZoom,
  viewPan,
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
  const palette = getSceneTheme(sceneSettings.themeId).palette;
  const shadowFillMultiplier = MathUtils.mapLinear(
    sceneSettings.shadowDepth,
    MIN_SCENE_LIGHT_INTENSITY,
    MAX_SCENE_LIGHT_INTENSITY,
    1.18,
    0.82
  );
  const shadowRadius = MathUtils.mapLinear(
    sceneSettings.shadowDepth,
    MIN_SCENE_LIGHT_INTENSITY,
    MAX_SCENE_LIGHT_INTENSITY,
    11,
    5
  );
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
  const deckMetrics = getDeckMetrics(
    Math.max(0, deckCount - 1),
    cardSet.cards.length
  );
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
      <CameraPan
        value={viewPan}
        viewportBounds={layout.viewportBounds}
        targetZoom={viewZoom}
      />
      <ambientLight
        intensity={
          0.44 * sceneSettings.lightIntensity * shadowFillMultiplier
        }
      />
      <pointLight
        castShadow
        position={[0, 0, 7.5]}
        intensity={86 * sceneSettings.lightIntensity}
        distance={24}
        decay={2}
        color={palette.keyLight}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.00035}
        shadow-radius={shadowRadius}
        shadow-normalBias={0.001}
        shadow-camera-near={0.2}
        shadow-camera-far={18}
      />
      <pointLight
        position={[0, 0, 4.5]}
        intensity={
          8 * sceneSettings.lightIntensity * shadowFillMultiplier
        }
        distance={16}
        decay={2}
        color={palette.fillLight}
      />
      <TableSurface
        palette={palette}
        width={baseViewportWidth}
        height={baseViewportHeight}
        dragBounds={layout.dragBounds}
        reducedMotion={reducedMotion}
        onSelect={onSelect}
      />
      <DeckStack
        count={Math.max(0, deckCount - 1)}
        deckCapacity={cardSet.cards.length}
        palette={palette}
        showMat={deckCount > 0}
        position={deckPosition}
        layout={layout}
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
      dpr={[0.5, 1.5]}
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
      <TarotTable {...props} />
    </Canvas>
  );
});
