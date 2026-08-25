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
  height: number;
  maxStackHeight: number;
  position: TablePoint;
  previewPositionRef: MutableRefObject<TablePoint | null>;
  stackHeight: number;
  width: number;
};

/**
 * The packed deck stays visually instanced, but this fixed-at-rest body gives
 * the stack a real footprint so released table cards cannot pass through it.
 */
export function DeckPhysics({
  bottomZ,
  height,
  maxStackHeight,
  position,
  previewPositionRef,
  stackHeight,
  width,
}: DeckPhysicsProps) {
  const bodyRef = useRef<RapierRigidBody>(null);
  const movingRef = useRef(false);
  const { rapier } = useRapier();
  const invalidate = useThree((state) => state.invalidate);
  // Keep one stable collider instance while cards move between deck and table.
  // Its top follows the visual stack while the unused depth extends below the
  // cloth; this avoids a remove/add handle race in the React 18 Rapier adapter.
  const halfDepth = Math.max(0.004, maxStackHeight / 2);
  const centerZ = bottomZ + stackHeight - halfDepth;

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
          { x: position[0], y: position[1], z: centerZ },
          true
        );
      }
    }

    if (moving) {
      body.setNextKinematicTranslation({
        x: target[0],
        y: target[1],
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
      { x: position[0], y: position[1], z: centerZ },
      true
    );
    invalidate();
  }, [centerZ, invalidate, position]);

  return (
    <RigidBody
      ref={bodyRef}
      type="fixed"
      colliders={false}
      position={[position[0], position[1], centerZ]}
      userData={{ kind: "deck" }}
    >
      <CuboidCollider
        args={[
          Math.max(0.01, width / 2 - CARD_PHYSICS.colliderInset),
          Math.max(0.01, height / 2 - CARD_PHYSICS.colliderInset),
          halfDepth,
        ]}
        contactSkin={CARD_PHYSICS.contactSkin}
        friction={CARD_PHYSICS.cardFriction}
        restitution={CARD_PHYSICS.cardRestitution}
        sensor={stackHeight <= 0}
      />
    </RigidBody>
  );
}
