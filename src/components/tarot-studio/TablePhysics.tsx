"use client";

import { CuboidCollider, RigidBody } from "@react-three/rapier";
import { CARD_PHYSICS } from "@/lib/card-physics";
import type { SceneBounds } from "./table-layout";

const FLOOR_HALF_DEPTH = 0.04;
const RAIL_THICKNESS = 0.06;
// Taller than the maximum pointer lift so a fast release cannot skim across
// the invisible boundary before gravity returns the card to the cloth.
const RAIL_HALF_HEIGHT = 0.36;
const MINIMUM_HALF_EXTENT = 0.01;

type TablePhysicsProps = {
  cardHeight: number;
  cardWidth: number;
  surfaceZ: number;
  dragBounds: SceneBounds;
  /** World-space rail top required by the current scripted layout. */
  railTopZ?: number;
};

const finiteOrZero = (value: number) => (Number.isFinite(value) ? value : 0);

/**
 * Fixed colliders for the XY tarot table. The physics world uses Z as up.
 */
export function TablePhysics({
  cardHeight,
  cardWidth,
  surfaceZ,
  dragBounds,
  railTopZ,
}: TablePhysicsProps) {
  const left = Math.min(
    finiteOrZero(dragBounds.left),
    finiteOrZero(dragBounds.right)
  );
  const right = Math.max(
    finiteOrZero(dragBounds.left),
    finiteOrZero(dragBounds.right)
  );
  const bottom = Math.min(
    finiteOrZero(dragBounds.bottom),
    finiteOrZero(dragBounds.top)
  );
  const top = Math.max(
    finiteOrZero(dragBounds.bottom),
    finiteOrZero(dragBounds.top)
  );
  const centerX = (left + right) / 2;
  const centerY = (bottom + top) / 2;
  const halfWidth = Math.max(MINIMUM_HALF_EXTENT, (right - left) / 2);
  const halfHeight = Math.max(MINIMUM_HALF_EXTENT, (top - bottom) / 2);
  // The durable bounds describe card centres. Put the physical rail one card
  // radius farther out so a centre can reach every valid persisted position
  // without spawning the collider inside a wall.
  const cardRadius = Math.hypot(
    Math.max(MINIMUM_HALF_EXTENT, cardWidth / 2 - CARD_PHYSICS.colliderInset),
    Math.max(MINIMUM_HALF_EXTENT, cardHeight / 2 - CARD_PHYSICS.colliderInset)
  );
  const physicalHalfWidth = halfWidth + cardRadius;
  const physicalHalfHeight = halfHeight + cardRadius;
  // A stack may intentionally raise its top card well above the normal drag
  // lift. Extend the invisible walls only in that case, otherwise a fast
  // release could pass over a rail before gravity returns it to the cloth.
  const railTop = Math.max(
    surfaceZ + RAIL_HALF_HEIGHT * 2,
    Number.isFinite(railTopZ) ? railTopZ ?? surfaceZ : surfaceZ
  );
  const railHalfHeight = Math.max(
    RAIL_HALF_HEIGHT,
    (railTop - surfaceZ) / 2
  );
  const railCenterZ = surfaceZ + railHalfHeight;

  return (
    <RigidBody type="fixed" colliders={false}>
      <CuboidCollider
        args={[physicalHalfWidth, physicalHalfHeight, FLOOR_HALF_DEPTH]}
        position={[centerX, centerY, surfaceZ - FLOOR_HALF_DEPTH]}
        friction={CARD_PHYSICS.tableFriction}
        restitution={CARD_PHYSICS.tableRestitution}
      />
      {/*
       * Each rail sits one card radius beyond the centre boundary. Keeping
       * collider volume outside the usable bounds avoids spawning valid cards
       * inside a wall while still catching them before they leave the floor.
      */}
      <CuboidCollider
        args={[
          RAIL_THICKNESS / 2,
          physicalHalfHeight + RAIL_THICKNESS,
          railHalfHeight,
        ]}
        position={[
          right + cardRadius + RAIL_THICKNESS / 2,
          centerY,
          railCenterZ,
        ]}
        friction={CARD_PHYSICS.tableFriction}
        restitution={CARD_PHYSICS.tableRestitution}
      />
      <CuboidCollider
        args={[
          RAIL_THICKNESS / 2,
          physicalHalfHeight + RAIL_THICKNESS,
          railHalfHeight,
        ]}
        position={[
          left - cardRadius - RAIL_THICKNESS / 2,
          centerY,
          railCenterZ,
        ]}
        friction={CARD_PHYSICS.tableFriction}
        restitution={CARD_PHYSICS.tableRestitution}
      />
      <CuboidCollider
        args={[
          physicalHalfWidth + RAIL_THICKNESS,
          RAIL_THICKNESS / 2,
          railHalfHeight,
        ]}
        position={[
          centerX,
          top + cardRadius + RAIL_THICKNESS / 2,
          railCenterZ,
        ]}
        friction={CARD_PHYSICS.tableFriction}
        restitution={CARD_PHYSICS.tableRestitution}
      />
      <CuboidCollider
        args={[
          physicalHalfWidth + RAIL_THICKNESS,
          RAIL_THICKNESS / 2,
          railHalfHeight,
        ]}
        position={[
          centerX,
          bottom - cardRadius - RAIL_THICKNESS / 2,
          railCenterZ,
        ]}
        friction={CARD_PHYSICS.tableFriction}
        restitution={CARD_PHYSICS.tableRestitution}
      />
    </RigidBody>
  );
}
