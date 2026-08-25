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
  Float32BufferAttribute,
  InstancedMesh,
  LineBasicMaterial,
  MathUtils,
  MeshBasicMaterial,
  Object3D,
} from "three";
import { getSpreadById } from "@/lib/tarot-spreads";
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
};

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
  selectedCardId,
  surfaceZ,
}: {
  activeSpread: ActiveSpreadReading | null;
  cards: TableCard[];
  isMobileViewport: boolean;
  layout: SceneTableLayout;
  palette: ScenePalette;
  reducedMotion: boolean;
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
      spread?.connections.flatMap(([fromIndex, toIndex]) => {
        if (!activeSpread) {
          return [];
        }

        const fromCardId = activeSpread.cardIds[fromIndex];
        const toCardId = activeSpread.cardIds[toIndex];
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
              },
            ]
          : [];
      }) ?? [],
    [activeSpread, nodeByCardId, spread]
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
    updateLineGeometry(
      selectedLineGeometry,
      selectedEdges,
      revealProgressRef.current
    );
    invalidate();
  }, [
    edges,
    invalidate,
    lineGeometry,
    reducedMotion,
    revealSignature,
    selectedEdges,
    selectedLineGeometry,
  ]);

  useFrame((_, delta) => {
    const currentProgress = revealProgressRef.current;
    const nextProgress = reducedMotion
      ? 1
      : MathUtils.damp(currentProgress, 1, 7.5, delta);
    const easedProgress = 1 - Math.pow(1 - nextProgress, 3);
    const fade = MathUtils.smoothstep(nextProgress, 0, 0.72);

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
