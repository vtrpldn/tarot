"use client";

import {
  CuboidCollider,
  RigidBody,
  type RapierRigidBody,
  useRapier,
} from "@react-three/rapier";
import { useFrame, useThree } from "@react-three/fiber";
import { type MutableRefObject, useEffect, useRef } from "react";
import { CARD_PHYSICS } from "@/lib/card-physics";
import type { TablePoint } from "@/types";

type DeckPhysicsProps = {
  bottomZ: number;
  centerOffset: TablePoint;
  halfHeight: number;
  halfWidth: number;
  maxStackHeight: number;
  position: TablePoint;
  positionResolverRef: MutableRefObject<DeckPositionResolver | null>;
  previewPositionRef: MutableRefObject<TablePoint | null>;
  stackHeight: number;
};

export type DeckPositionResolver = (position: TablePoint) => TablePoint;

/**
 * The packed deck stays visually instanced, but this fixed-at-rest body gives
 * the stack a real footprint so released table cards cannot pass through it.
 */
export function DeckPhysics({
  bottomZ,
  centerOffset,
  halfHeight,
  halfWidth,
  maxStackHeight,
  position,
  positionResolverRef,
  previewPositionRef,
  stackHeight,
}: DeckPhysicsProps) {
  const bodyRef = useRef<RapierRigidBody>(null);
  const movingRef = useRef(false);
  const { rapier, world } = useRapier();
  const invalidate = useThree((state) => state.invalidate);
  // Keep one stable collider instance while cards move between deck and table.
  // Its top follows the visual stack while the unused depth extends below the
  // cloth; this avoids a remove/add handle race in the React 18 Rapier adapter.
  const halfDepth = Math.max(0.004, maxStackHeight / 2);
  const centerZ = bottomZ + stackHeight - halfDepth;

  useEffect(() => {
    const body = bodyRef.current;

    if (!body) {
      return;
    }

    const shape = new rapier.Cuboid(
      Math.max(0.01, halfWidth),
      Math.max(0.01, halfHeight),
      halfDepth
    );
    const resolvePosition: DeckPositionResolver = (target) => {
      const origin = body.translation();
      const velocity = {
        x: target[0] + centerOffset[0] - origin.x,
        y: target[1] + centerOffset[1] - origin.y,
        z: 0,
      };
      const distance = Math.hypot(velocity.x, velocity.y);

      if (distance <= 0.000001) {
        return target;
      }

      const hit = world.castShape(
        origin,
        { w: 1, x: 0, y: 0, z: 0 },
        velocity,
        shape,
        CARD_PHYSICS.contactSkin,
        1,
        false,
        undefined,
        undefined,
        undefined,
        body,
        (collider) => {
          const userData = collider.parent()?.userData;
          const kind =
            typeof userData === "object" && userData !== null &&
            "kind" in userData
              ? (userData as { kind?: unknown }).kind
              : undefined;

          return !collider.isSensor() && kind === "card";
        }
      );

      if (!hit) {
        return target;
      }

      const safeTime = Math.max(
        0,
        Math.min(1, hit.time_of_impact - 0.0001 / distance)
      );

      return [
        origin.x + velocity.x * safeTime - centerOffset[0],
        origin.y + velocity.y * safeTime - centerOffset[1],
      ];
    };

    positionResolverRef.current = resolvePosition;

    return () => {
      if (positionResolverRef.current === resolvePosition) {
        positionResolverRef.current = null;
      }
    };
  }, [
    centerOffset,
    halfDepth,
    halfHeight,
    halfWidth,
    positionResolverRef,
    rapier,
    world,
  ]);

  useFrame(() => {
    const body = bodyRef.current;

    if (!body) {
      return;
    }

    const target = previewPositionRef.current ?? position;
    const moving = previewPositionRef.current !== null;

    if (moving !== movingRef.current) {
      body.setBodyType(
        moving
          ? rapier.RigidBodyType.KinematicPositionBased
          : rapier.RigidBodyType.Fixed,
        true
      );
      movingRef.current = moving;

      if (!moving) {
        body.setTranslation(
          {
            x: position[0] + centerOffset[0],
            y: position[1] + centerOffset[1],
            z: centerZ,
          },
          true
        );
      }
    }

    if (moving) {
      body.setNextKinematicTranslation({
        x: target[0] + centerOffset[0],
        y: target[1] + centerOffset[1],
        z: centerZ,
      });
    }
  }, -100);

  useEffect(() => {
    const body = bodyRef.current;

    if (!body) {
      return;
    }

    body.setTranslation(
      {
        x: position[0] + centerOffset[0],
        y: position[1] + centerOffset[1],
        z: centerZ,
      },
      true
    );
    invalidate();
  }, [centerOffset, centerZ, invalidate, position]);

  return (
    <RigidBody
      ref={bodyRef}
      type="fixed"
      colliders={false}
      position={[
        position[0] + centerOffset[0],
        position[1] + centerOffset[1],
        centerZ,
      ]}
      userData={{ kind: "deck" }}
    >
      <CuboidCollider
        args={[
          Math.max(0.01, halfWidth),
          Math.max(0.01, halfHeight),
          halfDepth,
        ]}
        contactSkin={CARD_PHYSICS.contactSkin}
        activeCollisionTypes={
          rapier.ActiveCollisionTypes.DEFAULT |
          rapier.ActiveCollisionTypes.KINEMATIC_KINEMATIC
        }
        friction={CARD_PHYSICS.cardFriction}
        restitution={CARD_PHYSICS.cardRestitution}
        sensor={stackHeight <= 0}
      />
    </RigidBody>
  );
}
