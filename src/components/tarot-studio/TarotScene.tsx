"use client";

import { Line, useTexture } from "@react-three/drei";
import {
  Canvas,
  type ThreeEvent,
  useFrame,
  useThree,
} from "@react-three/fiber";
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
  useState,
} from "react";
import {
  DynamicDrawUsage,
  Group,
  InstancedMesh,
  LinearFilter,
  MathUtils,
  Object3D,
  OrthographicCamera,
  Plane,
  PlaneGeometry,
  Raycaster,
  Shape,
  SpotLight as ThreeSpotLight,
  SRGBColorSpace,
  Vector2,
  Vector3,
} from "three";
import type {
  CardArtworkCrop,
  CardSetDefinition,
  TableCard,
  TablePoint,
  TarotSession,
} from "@/types";
import { getCardStackOffset } from "@/lib/card-stack-layout";
import { getDeckCards } from "@/lib/tarot-session";
import type { CardSoundPlayer } from "@/lib/card-sounds";
import {
  CARD_THICKNESS,
  CardMesh,
  createCardSlabGeometry,
  type ExternalCardDrag,
} from "./CardMesh";
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
const MAX_DECK_STACK_HEIGHT = 0.07;
const DECK_CASCADE_SCALE = 0.24;
const CUT_RAIL_PIXEL_SIZE = 44;
const CUT_DRAG_THRESHOLD = 0.045;
const CARD_FACE_PLANE_OFFSET = 0.002;
const AMBIENT_FILL_INTENSITY = 2.1;
const SPOTLIGHT_ANGLE = 1.54;
const SPOTLIGHT_INTENSITY = 172;
const SPOTLIGHT_SHADOW_RADIUS = 3;
const CUT_DRAG_PLANE = new Plane(new Vector3(0, 0, 1), 0);
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

function getDeckMetrics(cardCount: number, deckCapacity: number) {
  const safeCount = Math.max(0, cardCount);
  const safeCapacity = Math.max(1, deckCapacity);
  const fullness =
    safeCapacity <= 1 ? 1 : Math.max(0, (safeCount - 1) / (safeCapacity - 1));
  const stackHeight =
    safeCount === 0
      ? 0
      : MathUtils.lerp(
          CARD_THICKNESS,
          MAX_DECK_STACK_HEIGHT,
          fullness
        );
  const cardThickness = safeCount > 0 ? stackHeight / safeCount : 0;
  const bottomCardCenter =
    DECK_MAT_SURFACE_Z + CARD_SURFACE_CLEARANCE + cardThickness / 2;
  const topSurface =
    DECK_MAT_SURFACE_Z + CARD_SURFACE_CLEARANCE + stackHeight;

  return {
    bottomCardCenter,
    cardThickness,
    depthScale:
      safeCount > 0 ? Math.min(1, cardThickness / CARD_THICKNESS) : 1,
    stackHeight,
    topCardCenter:
      safeCount > 0 ? topSurface - cardThickness / 2 : topSurface,
    topSurface,
  };
}

function getDeckLayerOffset(
  index: number,
  cardCount: number,
  layout: SceneTableLayout,
  cascadeScale = DECK_CASCADE_SCALE
): TablePoint {
  if (cardCount <= 1) {
    return [0, 0];
  }

  const [offsetX, offsetY] = getCardStackOffset(index, cardCount);
  const origin = layout.toWorld([0, 0]);
  const layer = layout.toWorld([
    offsetX * cascadeScale,
    -offsetY * cascadeScale,
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

type DeckCardLayer = {
  card: TableCard;
  offset: TablePoint;
  restingZ: number;
};

type CutDragState = {
  cardId: string;
  lastPoint: Vector3;
  moved: boolean;
  offset: Vector3;
  origin: Vector3;
  pointerId: number;
};

type DeckPointerCaptureTarget = EventTarget & {
  releasePointerCapture?: (pointerId: number) => void;
  setPointerCapture?: (pointerId: number) => void;
};

type DeckLostPointerCaptureBinding = {
  handler: (event: PointerEvent) => void;
  target: HTMLCanvasElement;
};

type DeckPointerFallbackBinding = {
  pointerCancelHandler: (event: PointerEvent) => void;
  pointerMoveHandler: (event: PointerEvent) => void;
  pointerUpHandler: (event: PointerEvent) => void;
  target: Document;
};

function createDeckBackGeometry(
  width: number,
  height: number,
  crop?: CardArtworkCrop
) {
  const geometry = new PlaneGeometry(width, height);

  if (!crop) {
    return geometry;
  }

  const uvs = geometry.attributes.uv;
  const visibleWidth = 1 - crop.left - crop.right;
  const visibleHeight = 1 - crop.top - crop.bottom;

  for (let index = 0; index < uvs.count; index += 1) {
    uvs.setXY(
      index,
      crop.left + uvs.getX(index) * visibleWidth,
      crop.bottom + uvs.getY(index) * visibleHeight
    );
  }
  uvs.needsUpdate = true;
  return geometry;
}

function PhysicalDeck({
  allLayers,
  artworkCrop,
  backUrl,
  capacity,
  depthScale,
  externalDragRef,
  height,
  layout,
  onCutSelect,
  onDraw,
  onSound,
  palette,
  passiveLayers,
  position,
  previewPositionRef,
  reducedMotion,
  slabGeometry,
  topSurface,
  viewZoom,
  width,
}: {
  allLayers: DeckCardLayer[];
  artworkCrop?: CardArtworkCrop;
  backUrl: string;
  capacity: number;
  depthScale: number;
  externalDragRef: MutableRefObject<ExternalCardDrag | null>;
  height: number;
  layout: SceneTableLayout;
  onCutSelect: (cardId: string | null) => void;
  onDraw: (cardId: string, position: TablePoint) => void;
  onSound: CardSoundPlayer;
  palette: ScenePalette;
  passiveLayers: DeckCardLayer[];
  position: TablePoint;
  previewPositionRef: MutableRefObject<TablePoint | null>;
  reducedMotion: boolean;
  slabGeometry: ReturnType<typeof createCardSlabGeometry>;
  topSurface: number;
  viewZoom: number;
  width: number;
}) {
  const groupRef = useRef<Group>(null);
  const slabInstancesRef = useRef<InstancedMesh>(null);
  const backInstancesRef = useRef<InstancedMesh>(null);
  const cutDragRef = useRef<CutDragState | null>(null);
  const cutLostPointerCaptureRef =
    useRef<DeckLostPointerCaptureBinding | null>(null);
  const cutPointerFallbackRef =
    useRef<DeckPointerFallbackBinding | null>(null);
  const pointerRaycasterRef = useRef(new Raycaster());
  const pointerNdcRef = useRef(new Vector2());
  const hasPositionedRef = useRef(false);
  const currentPositionsRef = useRef(new Map<string, Vector3>());
  const currentDepthScaleRef = useRef(depthScale);
  const dummy = useMemo(() => new Object3D(), []);
  const invalidate = useThree((state) => state.invalidate);
  const canvas = useThree((state) => state.gl.domElement);
  const camera = useThree((state) => state.camera);
  const gl = useThree((state) => state.gl);
  const backTexture = useTexture(backUrl);
  const frameInset = Math.min(0.34, width * 0.105);
  const backGeometry = useMemo(
    () =>
      createDeckBackGeometry(
        Math.max(0.16, width - frameInset),
        Math.max(0.26, height - frameInset),
        artworkCrop
      ),
    [artworkCrop, frameInset, height, width]
  );
  const railWidth = Math.max(
    0.34,
    CUT_RAIL_PIXEL_SIZE / (BASE_CAMERA_ZOOM * viewZoom)
  );
  const railHeight = height * 0.72;
  const railX = -width / 2 - railWidth * 0.28;

  useLayoutEffect(() => {
    const group = groupRef.current;

    if (!group || hasPositionedRef.current) {
      return;
    }

    group.position.set(position[0], position[1], 0);
    hasPositionedRef.current = true;
  }, [position]);

  useLayoutEffect(() => {
    slabInstancesRef.current?.instanceMatrix.setUsage(DynamicDrawUsage);
    backInstancesRef.current?.instanceMatrix.setUsage(DynamicDrawUsage);
  }, []);

  useLayoutEffect(() => {
    backTexture.colorSpace = SRGBColorSpace;
    backTexture.minFilter = LinearFilter;
    backTexture.magFilter = LinearFilter;
    backTexture.generateMipmaps = false;
    backTexture.anisotropy = Math.min(4, gl.capabilities.getMaxAnisotropy());
    backTexture.needsUpdate = true;
  }, [backTexture, gl]);

  useEffect(() => () => backGeometry.dispose(), [backGeometry]);

  useEffect(() => {
    if (allLayers.length === 0) {
      hasPositionedRef.current = false;
    }

    invalidate();
  }, [allLayers, depthScale, invalidate, passiveLayers, position]);

  useFrame((_, delta) => {
    const group = groupRef.current;
    const slabInstances = slabInstancesRef.current;
    const backInstances = backInstancesRef.current;

    if (!group || !slabInstances || !backInstances) {
      return;
    }

    const previewPosition = previewPositionRef.current;
    const target = previewPosition ?? position;
    const nextRootX =
      previewPosition || reducedMotion
        ? target[0]
        : MathUtils.damp(group.position.x, target[0], 24, delta);
    const nextRootY =
      previewPosition || reducedMotion
        ? target[1]
        : MathUtils.damp(group.position.y, target[1], 24, delta);
    const nextDepthScale = reducedMotion
      ? depthScale
      : MathUtils.damp(currentDepthScaleRef.current, depthScale, 18, delta);
    let needsAnotherFrame =
      Math.abs(nextRootX - target[0]) > 0.0008 ||
      Math.abs(nextRootY - target[1]) > 0.0008 ||
      Math.abs(nextDepthScale - depthScale) > 0.0008;

    group.position.x = nextRootX;
    group.position.y = nextRootY;
    currentDepthScaleRef.current = nextDepthScale;
    slabInstances.count = passiveLayers.length;
    backInstances.count = passiveLayers.length;

    passiveLayers.forEach((layer, index) => {
      const targetX = layer.offset[0];
      const targetY = layer.offset[1];
      const targetZ = layer.restingZ;
      let currentPosition = currentPositionsRef.current.get(layer.card.id);

      if (!currentPosition) {
        currentPosition = new Vector3(targetX, targetY, targetZ);
        currentPositionsRef.current.set(layer.card.id, currentPosition);
      }

      const nextX = reducedMotion
        ? targetX
        : MathUtils.damp(currentPosition.x, targetX, 18, delta);
      const nextY = reducedMotion
        ? targetY
        : MathUtils.damp(currentPosition.y, targetY, 18, delta);
      const nextZ = reducedMotion
        ? targetZ
        : MathUtils.damp(currentPosition.z, targetZ, 18, delta);

      currentPosition.set(nextX, nextY, nextZ);
      needsAnotherFrame ||=
        (nextX - targetX) ** 2 +
          (nextY - targetY) ** 2 +
          (nextZ - targetZ) ** 2 >
        0.00000064;

      dummy.position.copy(currentPosition);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, nextDepthScale);
      dummy.updateMatrix();
      slabInstances.setMatrixAt(index, dummy.matrix);

      dummy.position.z =
        currentPosition.z +
        (CARD_THICKNESS / 2 + CARD_FACE_PLANE_OFFSET) * nextDepthScale;
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      backInstances.setMatrixAt(index, dummy.matrix);
    });

    slabInstances.instanceMatrix.needsUpdate = true;
    backInstances.instanceMatrix.needsUpdate = true;

    if (needsAnotherFrame) {
      invalidate();
    }
  });

  const getCutPoint = (event: ThreeEvent<PointerEvent>) =>
    event.ray.intersectPlane(CUT_DRAG_PLANE, new Vector3()) ?? event.point;
  const getCanvasCutPoint = (event: PointerEvent) => {
    const bounds = canvas.getBoundingClientRect();
    const pointer = pointerNdcRef.current;

    pointer.set(
      ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
      -((event.clientY - bounds.top) / bounds.height) * 2 + 1
    );
    pointerRaycasterRef.current.setFromCamera(pointer, camera);

    return (
      pointerRaycasterRef.current.ray.intersectPlane(
        CUT_DRAG_PLANE,
        new Vector3()
      ) ??
      cutDragRef.current?.lastPoint.clone() ??
      new Vector3()
    );
  };
  const clearCutLostPointerCapture = () => {
    const binding = cutLostPointerCaptureRef.current;

    if (!binding) {
      return;
    }

    binding.target.removeEventListener(
      "lostpointercapture",
      binding.handler
    );
    cutLostPointerCaptureRef.current = null;
  };
  const clearCutPointerFallback = () => {
    const binding = cutPointerFallbackRef.current;

    if (!binding) {
      return;
    }

    binding.target.removeEventListener(
      "pointermove",
      binding.pointerMoveHandler
    );
    binding.target.removeEventListener(
      "pointerup",
      binding.pointerUpHandler
    );
    binding.target.removeEventListener(
      "pointercancel",
      binding.pointerCancelHandler
    );
    cutPointerFallbackRef.current = null;
  };
  const updateCutDragAt = (pointerId: number, point: Vector3) => {
    const drag = cutDragRef.current;

    if (!drag || drag.pointerId !== pointerId) {
      return false;
    }

    const movement = point.distanceTo(drag.lastPoint);

    drag.moved ||= point.distanceTo(drag.origin) > CUT_DRAG_THRESHOLD;
    drag.lastPoint.copy(point);

    if (drag.moved) {
      externalDragRef.current = {
        cardId: drag.cardId,
        position: [point.x - drag.offset.x, point.y - drag.offset.y],
      };
      if (movement > 0.003) {
        onSound("move", { intensity: 0.34 });
      }
      invalidate();
    }

    return true;
  };
  const finishCutDragAt = ({
    pointerId,
    point,
    cancelled = false,
  }: {
    pointerId: number;
    point: Vector3;
    cancelled?: boolean;
  }) => {
    const drag = cutDragRef.current;

    if (!drag || drag.pointerId !== pointerId) {
      return false;
    }

    if (!cancelled && drag.moved) {
      const worldPosition: TablePoint = [
        point.x - drag.offset.x,
        point.y - drag.offset.y,
      ];

      externalDragRef.current = {
        cardId: drag.cardId,
        position: worldPosition,
      };
      onDraw(drag.cardId, layout.toPoint(...worldPosition));
      onCutSelect(null);
    } else if (cancelled) {
      onCutSelect(null);
    }

    externalDragRef.current = null;
    cutDragRef.current = null;
    canvas.style.cursor = "row-resize";
    invalidate();
    return true;
  };
  const getCutLayer = (event: ThreeEvent<PointerEvent>) => {
    const depth = MathUtils.clamp(event.uv?.y ?? 1, 0, 1);
    const index = Math.round(depth * Math.max(0, allLayers.length - 1));

    return allLayers[index];
  };
  const handleCutPointerDown = (event: ThreeEvent<PointerEvent>) => {
    if (event.nativeEvent.button !== 0) {
      return;
    }

    const layer = getCutLayer(event);
    const root = groupRef.current;

    if (!layer || !root) {
      return;
    }

    event.stopPropagation();
    const point = getCutPoint(event);
    const rootWorldPosition = root.getWorldPosition(new Vector3());
    const cardPosition = new Vector3(
      rootWorldPosition.x + layer.offset[0],
      rootWorldPosition.y + layer.offset[1],
      layer.restingZ
    );
    const target = event.target as unknown as DeckPointerCaptureTarget;

    target.setPointerCapture?.(event.pointerId);
    canvas.setPointerCapture?.(event.pointerId);
    clearCutLostPointerCapture();
    clearCutPointerFallback();
    cutDragRef.current = {
      cardId: layer.card.id,
      lastPoint: point.clone(),
      moved: false,
      offset: point.clone().sub(cardPosition),
      origin: point.clone(),
      pointerId: event.pointerId,
    };
    externalDragRef.current = {
      cardId: layer.card.id,
      position: [cardPosition.x, cardPosition.y],
    };
    onCutSelect(layer.card.id);
    onSound("pickup");

    const handleLostPointerCapture = (lostEvent: PointerEvent) => {
      cutLostPointerCaptureRef.current = null;
      const activeDrag = cutDragRef.current;

      if (!activeDrag || activeDrag.pointerId !== lostEvent.pointerId) {
        return;
      }

      clearCutPointerFallback();
      finishCutDragAt({
        pointerId: activeDrag.pointerId,
        point: activeDrag.lastPoint.clone(),
      });
    };
    const handlePointerMoveFallback = (nativeEvent: PointerEvent) => {
      updateCutDragAt(
        nativeEvent.pointerId,
        getCanvasCutPoint(nativeEvent)
      );
    };
    const handlePointerUpFallback = (nativeEvent: PointerEvent) => {
      if (nativeEvent.pointerId !== event.pointerId) {
        return;
      }

      const pointAtRelease = getCanvasCutPoint(nativeEvent);

      clearCutLostPointerCapture();
      clearCutPointerFallback();
      if (canvas.hasPointerCapture(nativeEvent.pointerId)) {
        canvas.releasePointerCapture(nativeEvent.pointerId);
      }
      finishCutDragAt({
        pointerId: nativeEvent.pointerId,
        point: pointAtRelease,
      });
    };
    const handlePointerCancelFallback = (nativeEvent: PointerEvent) => {
      if (nativeEvent.pointerId !== event.pointerId) {
        return;
      }

      clearCutLostPointerCapture();
      clearCutPointerFallback();
      if (canvas.hasPointerCapture(nativeEvent.pointerId)) {
        canvas.releasePointerCapture(nativeEvent.pointerId);
      }
      finishCutDragAt({
        pointerId: nativeEvent.pointerId,
        point: getCanvasCutPoint(nativeEvent),
        cancelled: true,
      });
    };

    canvas.addEventListener(
      "lostpointercapture",
      handleLostPointerCapture,
      { once: true }
    );
    cutLostPointerCaptureRef.current = {
      handler: handleLostPointerCapture,
      target: canvas,
    };
    document.addEventListener("pointermove", handlePointerMoveFallback);
    document.addEventListener("pointerup", handlePointerUpFallback);
    document.addEventListener(
      "pointercancel",
      handlePointerCancelFallback
    );
    cutPointerFallbackRef.current = {
      pointerCancelHandler: handlePointerCancelFallback,
      pointerMoveHandler: handlePointerMoveFallback,
      pointerUpHandler: handlePointerUpFallback,
      target: document,
    };
    canvas.style.cursor = "grabbing";
    invalidate();
  };
  const handleCutPointerMove = (event: ThreeEvent<PointerEvent>) => {
    const drag = cutDragRef.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      canvas.style.cursor = "row-resize";
      return;
    }

    event.stopPropagation();
    updateCutDragAt(event.pointerId, getCutPoint(event));
  };
  const finishCutDrag = (
    event: ThreeEvent<PointerEvent>,
    cancelled = false
  ) => {
    const drag = cutDragRef.current;

    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    event.stopPropagation();
    const target = event.target as unknown as DeckPointerCaptureTarget;
    const point = getCutPoint(event);

    clearCutLostPointerCapture();
    clearCutPointerFallback();
    target.releasePointerCapture?.(event.pointerId);
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    finishCutDragAt({
      pointerId: event.pointerId,
      point,
      cancelled,
    });
  };

  useEffect(
    () => () => {
      const lostCapture = cutLostPointerCaptureRef.current;
      const pointerFallback = cutPointerFallbackRef.current;
      const activeDrag = cutDragRef.current;

      if (lostCapture) {
        lostCapture.target.removeEventListener(
          "lostpointercapture",
          lostCapture.handler
        );
        cutLostPointerCaptureRef.current = null;
      }
      if (pointerFallback) {
        pointerFallback.target.removeEventListener(
          "pointermove",
          pointerFallback.pointerMoveHandler
        );
        pointerFallback.target.removeEventListener(
          "pointerup",
          pointerFallback.pointerUpHandler
        );
        pointerFallback.target.removeEventListener(
          "pointercancel",
          pointerFallback.pointerCancelHandler
        );
        cutPointerFallbackRef.current = null;
      }
      if (
        activeDrag &&
        canvas.hasPointerCapture(activeDrag.pointerId)
      ) {
        canvas.releasePointerCapture(activeDrag.pointerId);
      }
      cutDragRef.current = null;
      externalDragRef.current = null;
      canvas.style.cursor = "default";
    },
    [canvas, externalDragRef]
  );

  if (allLayers.length === 0) {
    return null;
  }

  return (
    <group ref={groupRef} renderOrder={DECK_STACK_RENDER_ORDER}>
      <DeckMat palette={palette} width={width} height={height} position={[0, 0]} />
      <instancedMesh
        ref={slabInstancesRef}
        args={[slabGeometry, undefined, capacity]}
        castShadow
        frustumCulled={false}
        receiveShadow
        renderOrder={DECK_CARD_RENDER_ORDER}
      >
        <CardPaperMaterial
          color="#e8dcc5"
          roughness={0.94}
          paperSeed={getPaperSeed(`${backUrl}:deck`)}
          depthTest
        />
      </instancedMesh>
      <instancedMesh
        ref={backInstancesRef}
        args={[backGeometry, undefined, capacity]}
        frustumCulled={false}
        receiveShadow
        renderOrder={DECK_CARD_RENDER_ORDER + 1}
      >
        <CardPaperMaterial
          map={backTexture}
          color="#fffdf7"
          roughness={0.9}
          paperSeed={getPaperSeed(`${backUrl}:back`)}
          toneMapped={false}
          depthTest
        />
      </instancedMesh>
      <group position={[railX, 0, topSurface + 0.025]}>
        <Line
          points={[
            [0, -railHeight * 0.44, 0],
            [0, railHeight * 0.44, 0],
          ]}
          color={palette.deckMatEdge}
          lineWidth={0.7}
          transparent
          opacity={0.26}
          depthTest={false}
          depthWrite={false}
        />
        {Array.from({ length: 9 }, (_, index) => {
          const y = (index / 8 - 0.5) * railHeight * 0.78;

          return (
            <Line
              key={index}
              points={[
                [-railWidth * 0.15, y, 0.001],
                [railWidth * 0.15, y, 0.001],
              ]}
              color={palette.cardPaper}
              lineWidth={0.8}
              transparent
              opacity={0.38}
              depthTest={false}
              depthWrite={false}
            />
          );
        })}
        <mesh
          onPointerDown={handleCutPointerDown}
          onPointerMove={handleCutPointerMove}
          onPointerUp={finishCutDrag}
          onPointerCancel={(event) => finishCutDrag(event, true)}
          onPointerOver={() => {
            canvas.style.cursor = "row-resize";
          }}
          onPointerOut={() => {
            if (!cutDragRef.current) {
              canvas.style.cursor = "default";
            }
          }}
        >
          <planeGeometry args={[railWidth, railHeight]} />
          <meshBasicMaterial
            colorWrite={false}
            depthTest={false}
            depthWrite={false}
            transparent
            opacity={0}
          />
        </mesh>
      </group>
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
          emissive={palette.table}
          emissiveIntensity={0.46}
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

type SceneSpotlightDefinition = {
  color: string;
  intensity: number;
  position: [number, number, number];
};

function SceneSpotlight({
  angle,
  castShadow,
  color,
  intensity,
  position,
  shadowRadius,
}: SceneSpotlightDefinition & {
  angle: number;
  castShadow: boolean;
  shadowRadius: number;
}) {
  const lightRef = useRef<ThreeSpotLight>(null);
  const invalidate = useThree((state) => state.invalidate);
  const target = useMemo(() => {
    const object = new Object3D();
    object.position.set(0, 0, TABLE_SURFACE_Z);
    return object;
  }, []);

  useLayoutEffect(() => {
    const light = lightRef.current;

    if (!light) {
      return;
    }

    light.target = target;
    target.updateMatrixWorld();
    invalidate();
  }, [invalidate, target]);

  useEffect(() => {
    invalidate();
  }, [angle, color, intensity, invalidate, position, shadowRadius]);

  return (
    <>
      <primitive object={target} />
      <spotLight
        ref={lightRef}
        angle={angle}
        castShadow={castShadow}
        color={color}
        decay={2}
        distance={24}
        intensity={intensity}
        penumbra={0.38}
        position={position}
        shadow-bias={-0.00035}
        shadow-camera-far={18}
        shadow-camera-near={0.2}
        shadow-mapSize-height={1024}
        shadow-mapSize-width={1024}
        shadow-normalBias={0.001}
        shadow-radius={shadowRadius}
      />
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
  const externalDeckDragRef = useRef<ExternalCardDrag | null>(null);
  const [cutCardId, setCutCardId] = useState<string | null>(null);
  const baseViewportWidth = size.width / BASE_CAMERA_ZOOM;
  const baseViewportHeight = size.height / BASE_CAMERA_ZOOM;
  const palette = getSceneTheme(sceneSettings.themeId).palette;
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
  const slabGeometry = useMemo(
    () => createCardSlabGeometry(layout.cardWidth, layout.cardHeight),
    [layout.cardHeight, layout.cardWidth]
  );
  const deckCards = useMemo(() => getDeckCards(session), [session]);
  const deckPreloadUrls = useMemo(
    () =>
      [...deckCards]
        .reverse()
        .slice(0, 3)
        .flatMap((card) => {
          const definition = definitions.get(card.cardId);

          return definition ? [definition.image.preview] : [];
        }),
    [deckCards, definitions]
  );
  const tableCards = useMemo(
    () =>
      session.cards
        .filter((card) => card.zone === "table")
        .sort((first, second) => first.zIndex - second.zIndex),
    [session.cards]
  );
  const deckCount = deckCards.length;
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
  const deckMetrics = getDeckMetrics(deckCount, cardSet.cards.length);
  const deckOffsets = useMemo(
    () =>
      deckCards.map((_, index) =>
        getDeckLayerOffset(index, deckCards.length, layout)
      ),
    [deckCards, layout]
  );
  const deckLayers = useMemo<DeckCardLayer[]>(
    () =>
      deckCards.map((card, index) => ({
        card,
        offset: deckOffsets[index],
        restingZ:
          deckMetrics.bottomCardCenter +
          index * deckMetrics.cardThickness,
      })),
    [deckCards, deckMetrics.bottomCardCenter, deckMetrics.cardThickness, deckOffsets]
  );
  const topDeckCardId = deckCards.at(-1)?.id ?? null;
  const liveDeckCardIds = useMemo(
    () =>
      new Set(
        [topDeckCardId, cutCardId].filter(
          (cardId): cardId is string => cardId !== null
        )
      ),
    [cutCardId, topDeckCardId]
  );
  const passiveDeckLayers = useMemo(
    () =>
      deckLayers.filter((layer) => !liveDeckCardIds.has(layer.card.id)),
    [deckLayers, liveDeckCardIds]
  );
  const liveDeckCards = useMemo(
    () => deckCards.filter((card) => liveDeckCardIds.has(card.id)),
    [deckCards, liveDeckCardIds]
  );
  const deckOrder = useMemo(
    () => new Map(deckCards.map((card, index) => [card.id, index])),
    [deckCards]
  );
  const visibleCards = [...liveDeckCards, ...tableCards];
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

  useEffect(() => () => slabGeometry.dispose(), [slabGeometry]);

  useEffect(() => {
    if (
      cutCardId !== null &&
      !deckCards.some((card) => card.id === cutCardId)
    ) {
      setCutCardId(null);
    }
  }, [cutCardId, deckCards]);

  useEffect(() => {
    useTexture.preload(cardSet.back.preview);
    deckPreloadUrls.forEach((url) => useTexture.preload(url));
  }, [cardSet.back.preview, deckPreloadUrls]);

  useLayoutEffect(() => {
    onLayoutChange(layout);
  }, [layout, onLayoutChange]);

  const handleTableSelect = useCallback(
    (cardId: string | null) => {
      setCutCardId(null);
      onSelect(cardId);
    },
    [onSelect]
  );

  return (
    <>
      <CameraPan
        value={viewPan}
        viewportBounds={layout.viewportBounds}
        targetZoom={viewZoom}
      />
      <ambientLight
        color={palette.keyLight}
        intensity={AMBIENT_FILL_INTENSITY}
      />
      <SceneSpotlight
        angle={SPOTLIGHT_ANGLE}
        castShadow
        color={palette.keyLight}
        intensity={SPOTLIGHT_INTENSITY}
        position={[0, 0, 7.5]}
        shadowRadius={SPOTLIGHT_SHADOW_RADIUS}
      />
      <TableSurface
        palette={palette}
        width={baseViewportWidth}
        height={baseViewportHeight}
        dragBounds={layout.dragBounds}
        reducedMotion={reducedMotion}
        onSelect={handleTableSelect}
      />
      <Suspense fallback={null}>
        <PhysicalDeck
          allLayers={deckLayers}
          artworkCrop={cardSet.artworkCrop}
          backUrl={cardSet.back.preview}
          capacity={cardSet.cards.length}
          depthScale={deckMetrics.depthScale}
          externalDragRef={externalDeckDragRef}
          height={layout.cardHeight}
          layout={layout}
          onCutSelect={setCutCardId}
          onDraw={onDraw}
          onSound={onSound}
          palette={palette}
          passiveLayers={passiveDeckLayers}
          position={deckPosition}
          previewPositionRef={deckPreviewPositionRef}
          reducedMotion={reducedMotion}
          slabGeometry={slabGeometry}
          topSurface={deckMetrics.topSurface}
          viewZoom={viewZoom}
          width={layout.cardWidth}
        />
      </Suspense>
      {visibleCards.map((card) => {
        const definition = definitions.get(card.cardId);

        if (!definition) {
          return null;
        }

        const tableIndex = tableOrder.get(card.id) ?? 0;
        const deckIndex = deckOrder.get(card.id);
        const baseDeckOffset =
          deckIndex === undefined
            ? ([0, 0] as TablePoint)
            : deckOffsets[deckIndex];
        const peeked =
          card.zone === "deck" &&
          card.id === cutCardId &&
          card.id !== topDeckCardId;
        const deckOffset: TablePoint = peeked
          ? [
              baseDeckOffset[0] + layout.cardWidth * 0.22,
              baseDeckOffset[1] - layout.cardHeight * 0.08,
            ]
          : baseDeckOffset;
        const deckCardPosition: TablePoint = [
          deckPosition[0] + deckOffset[0],
          deckPosition[1] + deckOffset[1],
        ];
        const restingZ =
          card.zone === "deck"
            ? peeked
              ? deckMetrics.topSurface + CARD_THICKNESS / 2 + 0.006
              : deckMetrics.bottomCardCenter +
                (deckIndex ?? 0) * deckMetrics.cardThickness
            : tableCardRestingHeights.get(card.id) ?? baseTableCardZ;
        const renderOrder =
          card.zone === "deck"
            ? DECK_CARD_RENDER_ORDER + (deckIndex ?? 0)
            : TABLE_CARD_RENDER_ORDER +
              tableIndex * CARD_RENDER_ORDER_STEP;
        const interactionZ =
          card.zone === "deck"
            ? restingZ + deckMetrics.cardThickness / 2 + 0.004
            : draggingZ + 0.02 + tableIndex * 0.002;

        return (
          <CardMesh
            key={card.id}
            card={card}
            definition={definition}
            cardSet={cardSet}
            layout={layout}
            deckPosition={deckPosition}
            deckCardPosition={deckCardPosition}
            deckOffset={deckOffset}
            deckDepthScale={deckMetrics.depthScale}
            deckPreviewPositionRef={deckPreviewPositionRef}
            externalDragRef={externalDeckDragRef}
            peeked={peeked}
            slabGeometry={slabGeometry}
            restingZ={restingZ}
            interactionZ={interactionZ}
            draggingZ={draggingZ}
            renderOrder={renderOrder}
            dragRenderOrder={DRAG_RENDER_ORDER}
            selected={session.selectedCardId === card.id}
            reducedMotion={reducedMotion}
            deckMoveMode={deckMoveMode}
            onSelect={card.zone === "table" ? handleTableSelect : onSelect}
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
