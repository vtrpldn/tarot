"use client";

import { Canvas, useThree } from "@react-three/fiber";
import { Suspense, useMemo } from "react";
import { SRGBColorSpace } from "three";
import type {
  CardSetDefinition,
  TableCard,
  TablePoint,
  TarotSession,
} from "@/types";
import {
  getRemainingDeckCount,
  getTableCards,
  getTopDeckCard,
} from "@/lib/tarot-session";
import { CardMesh } from "./CardMesh";
import { createSceneTableLayout } from "./table-layout";

type TarotSceneProps = {
  cardSet: CardSetDefinition;
  session: TarotSession;
  reducedMotion: boolean;
  onSelect: (cardId: string | null) => void;
  onDraw: (cardId: string, position: TablePoint) => void;
  onMove: (cardId: string, position: TablePoint) => void;
  onFlip: (cardId: string) => void;
};

function DeckStack({
  count,
  position,
  width,
  height,
}: {
  count: number;
  position: [number, number];
  width: number;
  height: number;
}) {
  if (count === 0) {
    return null;
  }

  const depth = Math.min(0.34, Math.max(0.08, count * 0.006));

  return (
    <group position={[position[0], position[1], -depth / 2]}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[width * 0.98, height * 0.98, depth]} />
        <meshStandardMaterial color="#dac9a5" roughness={0.76} metalness={0.03} />
      </mesh>
      <mesh position={[0.018, -0.018, depth / 2 + 0.002]}>
        <planeGeometry args={[width * 0.94, height * 0.94]} />
        <meshStandardMaterial color="#172d29" roughness={0.54} metalness={0.12} />
      </mesh>
      <mesh position={[0.018, -0.018, depth / 2 + 0.004]}>
        <planeGeometry args={[width * 0.89, height * 0.89]} />
        <meshStandardMaterial color="#a57d3d" roughness={0.44} metalness={0.44} />
      </mesh>
      <mesh position={[0.018, -0.018, depth / 2 + 0.006]}>
        <planeGeometry args={[width * 0.84, height * 0.84]} />
        <meshStandardMaterial color="#1f4e48" roughness={0.68} metalness={0.04} />
      </mesh>
    </group>
  );
}

function TableSurface({ onSelect }: { onSelect: (cardId: string | null) => void }) {
  const viewport = useThree((state) => state.viewport);

  return (
    <>
      <mesh position={[0, 0, -0.44]} receiveShadow onPointerDown={() => onSelect(null)}>
        <planeGeometry args={[viewport.width, viewport.height]} />
        <meshStandardMaterial
          color="#12342e"
          roughness={0.88}
          metalness={0.025}
          emissive="#071d1a"
          emissiveIntensity={0.24}
        />
      </mesh>
      <mesh position={[0, 0, -0.43]}>
        <ringGeometry
          args={[
            Math.min(viewport.width, viewport.height) * 0.31,
            Math.min(viewport.width, viewport.height) * 0.313,
            96,
          ]}
        />
        <meshBasicMaterial color="#d9b65f" transparent opacity={0.075} />
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
}: TarotSceneProps) {
  const viewport = useThree((state) => state.viewport);
  const size = useThree((state) => state.size);
  const layout = useMemo(
    () =>
      createSceneTableLayout({
        viewportWidth: viewport.width,
        viewportHeight: viewport.height,
        pixelWidth: size.width,
        cardAspectRatio: cardSet.cardAspectRatio,
      }),
    [cardSet.cardAspectRatio, size.width, viewport.height, viewport.width]
  );
  const definitions = useMemo(
    () => new Map(cardSet.cards.map((card) => [card.id, card])),
    [cardSet.cards]
  );
  const tableCards = getTableCards(session);
  const topDeckCard = getTopDeckCard(session);
  const deckCount = getRemainingDeckCount(session);

  return (
    <>
      <ambientLight intensity={0.76} />
      <directionalLight
        castShadow
        position={[-4, 7, 8]}
        intensity={2.7}
        color="#ffe8bd"
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-bias={-0.0004}
      />
      <pointLight position={[4, -2, 5]} intensity={5.6} distance={14} color="#6e9b91" />
      <TableSurface onSelect={onSelect} />
      <DeckStack
        count={deckCount}
        position={layout.deckPosition}
        width={layout.cardWidth}
        height={layout.cardHeight}
      />
      {topDeckCard && definitions.get(topDeckCard.cardId) && (
        <CardMesh
          card={topDeckCard}
          definition={definitions.get(topDeckCard.cardId)!}
          cardSet={cardSet}
          layout={layout}
          selected={session.selectedCardId === topDeckCard.id}
          reducedMotion={reducedMotion}
          onSelect={onSelect}
          onDraw={onDraw}
          onMove={onMove}
          onFlip={onFlip}
        />
      )}
      {tableCards.map((card: TableCard) => {
        const definition = definitions.get(card.cardId);

        if (!definition) {
          return null;
        }

        return (
          <CardMesh
            key={card.id}
            card={card}
            definition={definition}
            cardSet={cardSet}
            layout={layout}
            selected={session.selectedCardId === card.id}
            reducedMotion={reducedMotion}
            onSelect={onSelect}
            onDraw={onDraw}
            onMove={onMove}
            onFlip={onFlip}
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
      camera={{ position: [0, 0, 10], zoom: 75, near: 0.1, far: 100 }}
      gl={{ alpha: true, antialias: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.outputColorSpace = SRGBColorSpace;
        gl.setClearAlpha(0);
      }}
    >
      <Suspense fallback={null}>
        <TarotTable {...props} />
      </Suspense>
    </Canvas>
  );
}
