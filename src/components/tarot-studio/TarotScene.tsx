"use client";

import { RoundedBox } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Suspense, useEffect, useMemo } from "react";
import { MathUtils, OrthographicCamera, SRGBColorSpace } from "three";
import type {
  CardSetDefinition,
  TablePoint,
  TarotSession,
} from "@/types";
import {
  getRemainingDeckCount,
  getTableCards,
  getTopDeckCard,
} from "@/lib/tarot-session";
import { CardArtwork, CARD_THICKNESS, CardMesh } from "./CardMesh";
import { createSceneTableLayout } from "./table-layout";

const BASE_CAMERA_ZOOM = 75;
const MIN_VIEW_ZOOM = 0.65;
const TABLE_SURFACE_Z = -0.16;

type TarotSceneProps = {
  cardSet: CardSetDefinition;
  session: TarotSession;
  reducedMotion: boolean;
  viewZoom: number;
  onSelect: (cardId: string | null) => void;
  onDraw: (cardId: string, position: TablePoint) => void;
  onMove: (cardId: string, position: TablePoint) => void;
  onFlip: (cardId: string) => void;
  onRotate: (cardId: string, degrees: number) => void;
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

function getDeckMetrics(count: number) {
  const layerCount =
    count > 0 ? Math.min(12, Math.max(1, Math.ceil(count / 7))) : 0;
  const layerThickness = 0.034;
  const layerStep = 0.023;
  const firstCenter = TABLE_SURFACE_Z + 0.007 + layerThickness / 2;
  const topSurface = layerCount
    ? firstCenter + (layerCount - 1) * layerStep + layerThickness / 2
    : TABLE_SURFACE_Z + 0.007;

  return {
    firstCenter,
    layerCount,
    layerStep,
    layerThickness,
    topSurface,
    topCardCenter: topSurface + CARD_THICKNESS / 2 + 0.006,
  };
}

function DeckStack({
  count,
  position,
  width,
  height,
  backUrl,
}: {
  count: number;
  position: [number, number];
  width: number;
  height: number;
  backUrl: string;
}) {
  const metrics = getDeckMetrics(count);

  if (metrics.layerCount === 0) {
    return null;
  }

  const outerInset = Math.min(0.2, width * 0.08);
  const ruleInset = Math.min(0.32, width * 0.13);
  const artInset = Math.min(0.42, width * 0.17);
  const topOffsetX = ((metrics.layerCount - 1) % 3 - 1) * 0.012;
  const topOffsetY = ((metrics.layerCount - 1) % 2 ? -1 : 1) * 0.01;

  return (
    <group position={[position[0], position[1], 0]}>
      {Array.from({ length: metrics.layerCount }, (_, index) => {
        const offsetX = (index % 3 - 1) * 0.012;
        const offsetY = (index % 2 ? -1 : 1) * 0.01;

        return (
          <RoundedBox
            key={index}
            args={[width, height, metrics.layerThickness]}
            radius={0.055}
            smoothness={4}
            position={[
              offsetX,
              offsetY,
              metrics.firstCenter + index * metrics.layerStep,
            ]}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial
              color={index % 2 ? "#eadcbd" : "#d7c49e"}
              roughness={0.72}
              metalness={0.025}
            />
          </RoundedBox>
        );
      })}
      <mesh position={[topOffsetX, topOffsetY, metrics.topSurface + 0.001]}>
        <planeGeometry args={[width - outerInset, height - outerInset]} />
        <meshStandardMaterial
          color="#162d29"
          roughness={0.52}
          metalness={0.12}
        />
      </mesh>
      <mesh position={[topOffsetX, topOffsetY, metrics.topSurface + 0.003]}>
        <planeGeometry args={[width - ruleInset, height - ruleInset]} />
        <meshStandardMaterial
          color="#a88042"
          roughness={0.46}
          metalness={0.48}
        />
      </mesh>
      <Suspense fallback={null}>
        <CardArtwork
          url={backUrl}
          position={[topOffsetX, topOffsetY, metrics.topSurface + 0.005]}
          width={width - artInset}
          height={height - artInset}
        />
      </Suspense>
    </group>
  );
}

function TableSurface({
  width,
  height,
  onSelect,
}: {
  width: number;
  height: number;
  onSelect: (cardId: string | null) => void;
}) {
  const visibleWidth = (width / MIN_VIEW_ZOOM) * 1.04;
  const visibleHeight = (height / MIN_VIEW_ZOOM) * 1.04;

  return (
    <>
      <mesh
        position={[0, 0, TABLE_SURFACE_Z]}
        receiveShadow
        onPointerDown={() => onSelect(null)}
      >
        <planeGeometry args={[visibleWidth, visibleHeight]} />
        <meshStandardMaterial
          color="#12342e"
          roughness={0.94}
          metalness={0.012}
          emissive="#071d1a"
          emissiveIntensity={0.18}
        />
      </mesh>
      <mesh position={[0, 0, TABLE_SURFACE_Z + 0.002]}>
        <ringGeometry
          args={[
            Math.min(width, height) * 0.31,
            Math.min(width, height) * 0.313,
            96,
          ]}
        />
        <meshBasicMaterial color="#d9b65f" transparent opacity={0.065} />
      </mesh>
    </>
  );
}

function TarotTable({
  cardSet,
  session,
  reducedMotion,
  onSelect,
  onDraw,
  onMove,
  onFlip,
  onRotate,
}: TarotSceneProps) {
  const size = useThree((state) => state.size);
  const baseViewportWidth = size.width / BASE_CAMERA_ZOOM;
  const baseViewportHeight = size.height / BASE_CAMERA_ZOOM;
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
  const tableCards = getTableCards(session);
  const topDeckCard = getTopDeckCard(session);
  const deckCount = getRemainingDeckCount(session);
  const deckMetrics = getDeckMetrics(Math.max(0, deckCount - 1));
  const visibleCards = topDeckCard
    ? [topDeckCard, ...tableCards]
    : tableCards;
  const tableOrder = new Map(
    tableCards.map((card, index) => [card.id, index])
  );

  return (
    <>
      <ambientLight intensity={0.7} />
      <directionalLight
        castShadow
        position={[-4, 7, 8]}
        intensity={2.45}
        color="#ffe8bd"
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.00035}
        shadow-radius={4}
      />
      <pointLight
        position={[4, -2, 5]}
        intensity={4.2}
        distance={14}
        color="#6e9b91"
      />
      <TableSurface
        width={baseViewportWidth}
        height={baseViewportHeight}
        onSelect={onSelect}
      />
      <DeckStack
        count={Math.max(0, deckCount - 1)}
        position={layout.deckPosition}
        width={layout.cardWidth}
        height={layout.cardHeight}
        backUrl={cardSet.back.preview}
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
            : TABLE_SURFACE_Z +
              CARD_THICKNESS / 2 +
              0.008 +
              tableIndex * 0.0015;

        return (
          <CardMesh
            key={card.id}
            card={card}
            definition={definition}
            cardSet={cardSet}
            layout={layout}
            restingZ={restingZ}
            selected={session.selectedCardId === card.id}
            reducedMotion={reducedMotion}
            onSelect={onSelect}
            onDraw={onDraw}
            onMove={onMove}
            onFlip={onFlip}
            onRotate={onRotate}
          />
        );
      })}
    </>
  );
}

export function TarotScene(props: TarotSceneProps) {
  return (
    <Canvas
      className="tarot-canvas"
      orthographic
      shadows
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
      <TarotTable {...props} />
    </Canvas>
  );
}
