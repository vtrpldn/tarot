"use client";

import { useFrame, useThree } from "@react-three/fiber";
import {
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import {
  BufferGeometry,
  CanvasTexture,
  Float32BufferAttribute,
  InstancedMesh,
  LinearFilter,
  LineBasicMaterial,
  MathUtils,
  MeshBasicMaterial,
  Object3D,
  SRGBColorSpace,
} from "three";
import {
  getSpreadById,
  type SpreadRelationshipId,
} from "@/lib/tarot-spreads";
import type {
  ActiveSpreadReading,
  TableCard,
} from "@/types";
import type { SceneTableLayout } from "./table-layout";
import type { ScenePalette } from "./theme";

type ConstellationNode = {
  cardId: string;
  position: readonly [number, number, number];
  ringScale: number;
};

type ConstellationEdge = {
  fromCardId: string;
  toCardId: string;
  start: readonly [number, number, number];
  end: readonly [number, number, number];
  relationship?: SpreadRelationshipId;
  label?: string;
  labelSide: -1 | 1;
};

type RelationshipLabelPlacement = {
  edge: ConstellationEdge;
  key: string;
  label: string;
  position: readonly [number, number, number];
  selected: boolean;
};

type RelationshipLabelTexture = {
  aspect: number;
  texture: CanvasTexture;
};

function traceRoundedRectangle(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  const resolvedRadius = Math.min(radius, width / 2, height / 2);

  context.beginPath();
  context.moveTo(x + resolvedRadius, y);
  context.lineTo(x + width - resolvedRadius, y);
  context.quadraticCurveTo(x + width, y, x + width, y + resolvedRadius);
  context.lineTo(x + width, y + height - resolvedRadius);
  context.quadraticCurveTo(
    x + width,
    y + height,
    x + width - resolvedRadius,
    y + height
  );
  context.lineTo(x + resolvedRadius, y + height);
  context.quadraticCurveTo(x, y + height, x, y + height - resolvedRadius);
  context.lineTo(x, y + resolvedRadius);
  context.quadraticCurveTo(x, y, x + resolvedRadius, y);
  context.closePath();
}

function createRelationshipLabelTexture(
  label: string,
  palette: ScenePalette
): RelationshipLabelTexture | null {
  if (typeof document === "undefined") {
    return null;
  }

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    return null;
  }

  const font = 'italic 500 38px "Iowan Old Style", Baskerville, Georgia, serif';
  const horizontalPadding = 34;
  const height = 88;
  context.font = font;
  const measuredWidth = Math.ceil(context.measureText(label).width);
  canvas.width = measuredWidth + horizontalPadding * 2;
  canvas.height = height;

  context.font = font;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.globalAlpha = 0.88;
  context.fillStyle = palette.tableEmissive;
  traceRoundedRectangle(context, 2, 7, canvas.width - 4, height - 14, 24);
  context.fill();
  context.globalAlpha = 0.5;
  context.strokeStyle = palette.celestialGold;
  context.lineWidth = 1.5;
  context.stroke();
  context.globalAlpha = 1;
  context.fillStyle = palette.celestialGold;
  context.fillText(label, canvas.width / 2, height / 2 + 1);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.generateMipmaps = false;
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.name = `spread-relationship:${label}`;
  texture.needsUpdate = true;

  return {
    aspect: canvas.width / canvas.height,
    texture,
  };
}

const RelationshipLabel = memo(function RelationshipLabel({
  label,
  materialRef,
  palette,
  position,
  height,
}: {
  label: string;
  materialRef: (material: MeshBasicMaterial | null) => void;
  palette: ScenePalette;
  position: readonly [number, number, number];
  height: number;
}) {
  const labelTexture = useMemo(
    () => createRelationshipLabelTexture(label, palette),
    [label, palette]
  );

  useEffect(
    () => () => {
      labelTexture?.texture.dispose();
    },
    [labelTexture]
  );

  if (!labelTexture) {
    return null;
  }

  return (
    <mesh
      position={position}
      renderOrder={4}
      raycast={() => undefined}
    >
      <planeGeometry args={[height * labelTexture.aspect, height]} />
      <meshBasicMaterial
        ref={materialRef}
        alphaTest={0.015}
        depthTest
        depthWrite={false}
        map={labelTexture.texture}
        opacity={0}
        toneMapped={false}
        transparent
      />
    </mesh>
  );
});

function createLineGeometry(edgeCount: number): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute(
    "position",
    new Float32BufferAttribute(new Float32Array(edgeCount * 6), 3)
  );
  return geometry;
}

function updateLineGeometry(
  geometry: BufferGeometry,
  edges: ConstellationEdge[],
  progress: number
) {
  const position = geometry.getAttribute("position");

  edges.forEach((edge, index) => {
    const offset = index * 2;
    const endX = MathUtils.lerp(edge.start[0], edge.end[0], progress);
    const endY = MathUtils.lerp(edge.start[1], edge.end[1], progress);
    const endZ = MathUtils.lerp(edge.start[2], edge.end[2], progress);

    position.setXYZ(offset, edge.start[0], edge.start[1], edge.start[2]);
    position.setXYZ(offset + 1, endX, endY, endZ);
  });
  position.needsUpdate = true;
}

function getNodeKey(position: readonly [number, number, number]): string {
  return `${position[0].toFixed(3)}:${position[1].toFixed(3)}`;
}

export const ConstellationReading = memo(function ConstellationReading({
  activeSpread,
  cards,
  isMobileViewport,
  layout,
  palette,
  reducedMotion,
  relationshipLabels,
  selectedCardId,
  surfaceZ,
}: {
  activeSpread: ActiveSpreadReading | null;
  cards: TableCard[];
  isMobileViewport: boolean;
  layout: SceneTableLayout;
  palette: ScenePalette;
  reducedMotion: boolean;
  relationshipLabels: Readonly<Record<SpreadRelationshipId, string>>;
  selectedCardId: string | null;
  surfaceZ: number;
}) {
  const invalidate = useThree((state) => state.invalidate);
  const ringInstancesRef = useRef<InstancedMesh>(null);
  const dotInstancesRef = useRef<InstancedMesh>(null);
  const lineMaterialRef = useRef<LineBasicMaterial>(null);
  const selectedLineMaterialRef = useRef<LineBasicMaterial>(null);
  const ringMaterialRef = useRef<MeshBasicMaterial>(null);
  const dotMaterialRef = useRef<MeshBasicMaterial>(null);
  const selectedRingMaterialRef = useRef<MeshBasicMaterial>(null);
  const labelMaterialRefs = useRef<Array<MeshBasicMaterial | null>>([]);
  const revealProgressRef = useRef(reducedMotion ? 1 : 0);
  const instanceDummy = useMemo(() => new Object3D(), []);
  const cardById = useMemo(
    () => new Map(cards.map((card) => [card.id, card])),
    [cards]
  );
  const spread = activeSpread ? getSpreadById(activeSpread.id) : undefined;
  const rawNodes = useMemo(
    () =>
      activeSpread?.cardIds.flatMap((cardId) => {
        const card = cardById.get(cardId);

        if (!card?.faceUp || card.zone !== "table") {
          return [];
        }

        const [x, y] = layout.toWorld(card.position);
        return [{ cardId, position: [x, y, surfaceZ] as const }];
      }) ?? [],
    [activeSpread, cardById, layout, surfaceZ]
  );
  const nodes = useMemo<ConstellationNode[]>(() => {
    const duplicateCounts = new Map<string, number>();

    return rawNodes.map((node) => {
      const key = getNodeKey(node.position);
      const duplicateIndex = duplicateCounts.get(key) ?? 0;
      duplicateCounts.set(key, duplicateIndex + 1);

      return {
        ...node,
        ringScale: 1 + duplicateIndex * 0.5,
      };
    });
  }, [rawNodes]);
  const nodeByCardId = useMemo(
    () => new Map(nodes.map((node) => [node.cardId, node])),
    [nodes]
  );
  const edges = useMemo<ConstellationEdge[]>(
    () =>
      spread?.connections.flatMap((connection) => {
        if (!activeSpread) {
          return [];
        }

        const fromCardId = activeSpread.cardIds[connection.from];
        const toCardId = activeSpread.cardIds[connection.to];
        const from = nodeByCardId.get(fromCardId);
        const to = nodeByCardId.get(toCardId);

        if (!from || !to) {
          return [];
        }

        const distance = Math.hypot(
          to.position[0] - from.position[0],
          to.position[1] - from.position[1]
        );

        return distance > 0.04
          ? [
              {
                fromCardId,
                toCardId,
                start: from.position,
                end: to.position,
                relationship: connection.relationship,
                label: connection.relationship
                  ? relationshipLabels[connection.relationship]
                  : undefined,
                labelSide: connection.labelSide ?? 1,
              },
            ]
          : [];
      }) ?? [],
    [activeSpread, nodeByCardId, relationshipLabels, spread]
  );
  const selectedEdges = useMemo(
    () =>
      selectedCardId
        ? edges.filter(
            (edge) =>
              edge.fromCardId === selectedCardId ||
              edge.toCardId === selectedCardId
          )
        : [],
    [edges, selectedCardId]
  );
  const lineGeometry = useMemo(
    () => createLineGeometry(edges.length),
    [edges.length]
  );
  const selectedLineGeometry = useMemo(
    () => createLineGeometry(selectedEdges.length),
    [selectedEdges.length]
  );
  const selectedNode = selectedCardId
    ? nodeByCardId.get(selectedCardId)
    : undefined;
  const selectedHaloRadius = layout.cardWidth * 0.56;
  const relationshipLabelHeight =
    layout.cardWidth * (isMobileViewport ? 0.17 : 0.115);
  const visibleRelationshipLabels = useMemo<
    RelationshipLabelPlacement[]
  >(() => {
    const labelledEdges = edges
      .filter(
        (edge): edge is ConstellationEdge & { label: string } =>
          Boolean(edge.label)
      )
      .map((edge) => ({
        edge,
        selected:
          edge.fromCardId === selectedCardId ||
          edge.toCardId === selectedCardId,
      }))
      .sort((first, second) => Number(second.selected) - Number(first.selected));
    const candidates = isMobileViewport
      ? labelledEdges.filter((candidate) => candidate.selected).slice(0, 2)
      : labelledEdges;
    const accepted: RelationshipLabelPlacement[] = [];

    candidates.forEach(({ edge, selected }) => {
      const deltaX = edge.end[0] - edge.start[0];
      const deltaY = edge.end[1] - edge.start[1];
      const distance = Math.hypot(deltaX, deltaY);

      if (distance < layout.cardWidth * 0.24) {
        return;
      }

      const normalX = -deltaY / distance;
      const normalY = deltaX / distance;
      const approximateLabelWidth = relationshipLabelHeight * MathUtils.clamp(
        2.8 + edge.label.length * 0.115,
        3.4,
        6.6
      );
      const clearGap = distance - layout.cardWidth * 1.08;
      const crowded = clearGap < approximateLabelWidth;
      const cardClearance =
        Math.abs(normalX) * (layout.cardWidth / 2) +
        Math.abs(normalY) * (layout.cardHeight / 2);
      const offset = crowded
        ? cardClearance + relationshipLabelHeight * 0.9
        : relationshipLabelHeight * 0.72;
      const midpointX = (edge.start[0] + edge.end[0]) / 2;
      const midpointY = (edge.start[1] + edge.end[1]) / 2;
      const position = [
        midpointX + normalX * offset * edge.labelSide,
        midpointY + normalY * offset * edge.labelSide,
        surfaceZ + 0.0015,
      ] as const;
      const collidesWithAccepted = accepted.some((placement) => {
        const labelDistance = Math.hypot(
          placement.position[0] - position[0],
          placement.position[1] - position[1]
        );

        return labelDistance < layout.cardWidth * 0.38;
      });

      if (!collidesWithAccepted) {
        accepted.push({
          edge,
          key: `${edge.fromCardId}:${edge.toCardId}:${edge.relationship}`,
          label: edge.label,
          position,
          selected,
        });
      }
    });

    return accepted;
  }, [
    edges,
    isMobileViewport,
    layout.cardHeight,
    layout.cardWidth,
    relationshipLabelHeight,
    selectedCardId,
    surfaceZ,
  ]);
  const revealSignature = nodes
    .map(
      (node) =>
        `${node.cardId}:${node.position[0].toFixed(3)}:${node.position[1].toFixed(3)}`
    )
    .join("|");

  useEffect(
    () => () => {
      lineGeometry.dispose();
    },
    [lineGeometry]
  );
  useEffect(
    () => () => {
      selectedLineGeometry.dispose();
    },
    [selectedLineGeometry]
  );

  useLayoutEffect(() => {
    const ringInstances = ringInstancesRef.current;
    const dotInstances = dotInstancesRef.current;

    if (!ringInstances || !dotInstances) {
      return;
    }

    nodes.forEach((node, index) => {
      instanceDummy.position.set(...node.position);
      instanceDummy.scale.setScalar(node.ringScale);
      instanceDummy.rotation.set(0, 0, index * 0.37);
      instanceDummy.updateMatrix();
      ringInstances.setMatrixAt(index, instanceDummy.matrix);

      instanceDummy.scale.setScalar(0.72);
      instanceDummy.updateMatrix();
      dotInstances.setMatrixAt(index, instanceDummy.matrix);
    });
    ringInstances.instanceMatrix.needsUpdate = true;
    dotInstances.instanceMatrix.needsUpdate = true;
    invalidate();
  }, [instanceDummy, invalidate, nodes]);

  useEffect(() => {
    revealProgressRef.current = reducedMotion ? 1 : 0;
    updateLineGeometry(
      lineGeometry,
      edges,
      revealProgressRef.current
    );
    invalidate();
  }, [
    edges,
    invalidate,
    lineGeometry,
    reducedMotion,
    revealSignature,
  ]);

  useEffect(() => {
    const progress = revealProgressRef.current;
    const easedProgress = 1 - Math.pow(1 - progress, 3);
    updateLineGeometry(
      selectedLineGeometry,
      selectedEdges,
      easedProgress
    );
    invalidate();
  }, [
    invalidate,
    selectedEdges,
    selectedLineGeometry,
  ]);

  useEffect(() => {
    labelMaterialRefs.current.length = visibleRelationshipLabels.length;
  }, [visibleRelationshipLabels.length]);

  useFrame((_, delta) => {
    const currentProgress = revealProgressRef.current;
    const nextProgress = reducedMotion
      ? 1
      : MathUtils.damp(currentProgress, 1, 7.5, delta);
    const easedProgress = 1 - Math.pow(1 - nextProgress, 3);
    const fade = MathUtils.smoothstep(nextProgress, 0, 0.72);
    const labelFade = MathUtils.smoothstep(nextProgress, 0.58, 0.9);

    revealProgressRef.current = nextProgress;
    updateLineGeometry(lineGeometry, edges, easedProgress);
    updateLineGeometry(selectedLineGeometry, selectedEdges, easedProgress);

    if (lineMaterialRef.current) {
      lineMaterialRef.current.opacity =
        fade * (isMobileViewport ? 0.15 : 0.21);
    }
    if (selectedLineMaterialRef.current) {
      selectedLineMaterialRef.current.opacity = fade * 0.54;
    }
    if (ringMaterialRef.current) {
      ringMaterialRef.current.opacity = fade * 0.42;
    }
    if (dotMaterialRef.current) {
      dotMaterialRef.current.opacity = fade * 0.3;
    }
    if (selectedRingMaterialRef.current) {
      selectedRingMaterialRef.current.opacity = fade * 0.68;
    }
    visibleRelationshipLabels.forEach((placement, index) => {
      const material = labelMaterialRefs.current[index];

      if (material) {
        material.opacity =
          labelFade *
          (placement.selected ? 1 : isMobileViewport ? 0.78 : 0.86);
      }
    });

    if (Math.abs(1 - nextProgress) > 0.001) {
      invalidate();
    }
  });

  if (!activeSpread || !spread || nodes.length === 0) {
    return null;
  }

  return (
    <group renderOrder={2}>
      <lineSegments
        geometry={lineGeometry}
        frustumCulled={false}
        renderOrder={2}
        raycast={() => undefined}
      >
        <lineBasicMaterial
          ref={lineMaterialRef}
          color={palette.celestialGold}
          depthTest
          depthWrite={false}
          opacity={0}
          toneMapped={false}
          transparent
        />
      </lineSegments>
      <lineSegments
        geometry={selectedLineGeometry}
        frustumCulled={false}
        renderOrder={3}
        raycast={() => undefined}
      >
        <lineBasicMaterial
          ref={selectedLineMaterialRef}
          color={palette.fillLight}
          depthTest
          depthWrite={false}
          opacity={0}
          toneMapped={false}
          transparent
        />
      </lineSegments>
      {visibleRelationshipLabels.map((placement, index) => (
        <RelationshipLabel
          key={placement.key}
          height={relationshipLabelHeight}
          label={placement.label}
          materialRef={(material) => {
            labelMaterialRefs.current[index] = material;
          }}
          palette={palette}
          position={placement.position}
        />
      ))}
      <instancedMesh
        ref={ringInstancesRef}
        args={[undefined, undefined, nodes.length]}
        frustumCulled={false}
        renderOrder={3}
        raycast={() => undefined}
      >
        <ringGeometry args={[0.034, 0.048, 28]} />
        <meshBasicMaterial
          ref={ringMaterialRef}
          color={palette.celestialGold}
          depthTest
          depthWrite={false}
          opacity={0}
          toneMapped={false}
          transparent
        />
      </instancedMesh>
      <instancedMesh
        ref={dotInstancesRef}
        args={[undefined, undefined, nodes.length]}
        frustumCulled={false}
        renderOrder={3}
        raycast={() => undefined}
      >
        <circleGeometry args={[0.019, 18]} />
        <meshBasicMaterial
          ref={dotMaterialRef}
          color={palette.fillLight}
          depthTest
          depthWrite={false}
          opacity={0}
          toneMapped={false}
          transparent
        />
      </instancedMesh>
      {selectedNode ? (
        <mesh
          position={selectedNode.position}
          renderOrder={4}
          scale={Math.min(1.24, selectedNode.ringScale)}
          raycast={() => undefined}
        >
          <ringGeometry
            args={[
              selectedHaloRadius,
              selectedHaloRadius + 0.012,
              72,
            ]}
          />
          <meshBasicMaterial
            ref={selectedRingMaterialRef}
            color={palette.fillLight}
            depthTest
            depthWrite={false}
            opacity={0}
            toneMapped={false}
            transparent
          />
        </mesh>
      ) : null}
    </group>
  );
});
