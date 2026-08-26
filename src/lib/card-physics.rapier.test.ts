import RAPIER from "@dimforge/rapier3d-compat";
import { beforeAll, describe, expect, test } from "vitest";
import {
  CARD_PHYSICS,
  getCardColliderHalfExtents,
  getReleaseKinematics,
  getSmoothedPointerVelocity,
} from "./card-physics";

const CARD_WIDTH = 2;
const CARD_HEIGHT = 3.5;
const CARD_THICKNESS = 0.018;
const [CARD_HALF_WIDTH, CARD_HALF_HEIGHT, CARD_HALF_DEPTH] =
  getCardColliderHalfExtents(CARD_WIDTH, CARD_HEIGHT, CARD_THICKNESS);
const DECK_HALF_DEPTH = 0.035;
const DECK_TOP = DECK_HALF_DEPTH * 2;

beforeAll(async () => {
  await RAPIER.init();
});

function createWorld() {
  const world = new RAPIER.World({ x: 0, y: 0, z: CARD_PHYSICS.gravity[2] });
  world.timestep = CARD_PHYSICS.timeStep;
  world.numSolverIterations = 8;
  world.numAdditionalFrictionIterations = 4;

  const table = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(12, 12, 0.04)
      .setTranslation(0, 0, -0.04)
      .setFriction(CARD_PHYSICS.tableFriction)
      .setRestitution(CARD_PHYSICS.tableRestitution),
    table
  );

  return world;
}

function createCard(
  world: RAPIER.World,
  {
    position,
    velocity = [0, 0, 0],
  }: {
    position: [number, number, number];
    velocity?: [number, number, number];
  }
) {
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(...position)
      .setLinvel(...velocity)
      .setLinearDamping(CARD_PHYSICS.linearDamping)
      .setAngularDamping(CARD_PHYSICS.angularDamping)
      .setCcdEnabled(true)
      .setCanSleep(false)
  );
  const collider = world.createCollider(
    RAPIER.ColliderDesc.cuboid(
      CARD_HALF_WIDTH,
      CARD_HALF_HEIGHT,
      CARD_HALF_DEPTH
    )
      .setMass(CARD_PHYSICS.cardMassKilograms)
      .setFriction(CARD_PHYSICS.cardFriction)
      .setRestitution(CARD_PHYSICS.cardRestitution)
      .setContactSkin(CARD_PHYSICS.contactSkin),
    body
  );

  return { body, collider };
}

function createDeck(world: RAPIER.World) {
  const deck = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());

  return world.createCollider(
    RAPIER.ColliderDesc.cuboid(
      CARD_HALF_WIDTH,
      CARD_HALF_HEIGHT,
      DECK_HALF_DEPTH
    )
      .setTranslation(0, 0, DECK_HALF_DEPTH)
      .setFriction(CARD_PHYSICS.cardFriction)
      .setRestitution(CARD_PHYSICS.cardRestitution)
      .setContactSkin(CARD_PHYSICS.contactSkin),
    deck
  );
}

function step(world: RAPIER.World, frames: number) {
  for (let frame = 0; frame < frames; frame += 1) {
    world.step();
  }
}

describe("configured Tarot card colliders in Rapier", () => {
  test("uses card mass and falls onto the table without passing through it", () => {
    const world = createWorld();

    try {
      const { body, collider } = createCard(world, {
        position: [0, 0, 1],
      });

      expect(collider.mass()).toBeCloseTo(CARD_PHYSICS.cardMassKilograms, 8);
      expect(body.mass()).toBeCloseTo(CARD_PHYSICS.cardMassKilograms, 8);
      expect(body.localCom()).toMatchObject({ x: 0, y: 0, z: 0 });

      step(world, 12);
      expect(body.translation().z).toBeLessThan(1);

      step(world, 180);
      expect(body.translation().z).toBeGreaterThanOrEqual(
        CARD_HALF_DEPTH - 0.0006
      );
      expect(body.translation().z).toBeLessThan(CARD_HALF_DEPTH + 0.02);
      expect(Math.abs(body.linvel().z)).toBeLessThan(0.03);
    } finally {
      world.free();
    }
  });

  test("transfers a high-speed card impact to another card without tunneling", () => {
    const world = createWorld();

    try {
      const tableHeight = CARD_HALF_DEPTH + CARD_PHYSICS.contactSkin;
      const target = createCard(world, {
        position: [0, 0, tableHeight],
      });
      const projectile = createCard(world, {
        position: [-2.7, 0, tableHeight],
        velocity: [25, 0, 0],
      });

      step(world, 12);

      const projectileX = projectile.body.translation().x;
      const targetX = target.body.translation().x;

      expect(projectileX).toBeLessThan(targetX + CARD_WIDTH);
      expect(targetX).toBeGreaterThan(0.04);
      expect(target.body.linvel().x).toBeGreaterThan(0);
      expect(target.body.translation().z).toBeGreaterThanOrEqual(
        CARD_HALF_DEPTH - 0.0006
      );
    } finally {
      world.free();
    }
  });

  test("transfers a configured-speed throw into a visible card interaction", () => {
    const world = createWorld();

    try {
      const tableHeight = CARD_HALF_DEPTH + CARD_PHYSICS.contactSkin;
      const target = createCard(world, {
        position: [0, 0, tableHeight],
      });
      const projectile = createCard(world, {
        position: [-2.2, 0, tableHeight],
        velocity: [CARD_PHYSICS.maxPlanarSpeed, 0, 0],
      });

      step(world, 180);

      expect(target.body.translation().x).toBeGreaterThan(0.18);
      expect(projectile.body.translation().x).toBeLessThan(
        target.body.translation().x
      );
      expect(Math.abs(target.body.linvel().x)).toBeLessThan(0.08);
      expect(Math.abs(projectile.body.linvel().x)).toBeLessThan(0.08);
    } finally {
      world.free();
    }
  });

  test("lets a max flick travel across the deck while a slow push is stopped at its edge", () => {
    const fastWorld = createWorld();
    const slowWorld = createWorld();

    try {
      createDeck(fastWorld);
      createDeck(slowWorld);
      const releaseHeight =
        CARD_HALF_DEPTH + CARD_PHYSICS.contactSkin + CARD_PHYSICS.dragLift;
      const fastRelease = getReleaseKinematics({
        grabOffset: [0, 0],
        pointerVelocity: [-CARD_PHYSICS.maxPlanarSpeed, 0],
        reducedMotion: false,
      });
      const slowRelease = getReleaseKinematics({
        grabOffset: [0, 0],
        pointerVelocity: [-1.2, 0],
        reducedMotion: false,
      });
      const fastCard = createCard(fastWorld, {
        position: [2.2, 0, releaseHeight],
        velocity: fastRelease.linearVelocity,
      });
      const slowCard = createCard(slowWorld, {
        position: [2, 0, releaseHeight],
        velocity: slowRelease.linearVelocity,
      });

      step(fastWorld, 180);
      step(slowWorld, 180);

      expect(fastCard.body.translation().x).toBeLessThan(1.2);
      expect(fastCard.body.translation().z).toBeGreaterThan(DECK_TOP);
      expect(slowCard.body.translation().x).toBeGreaterThan(1.55);
      expect(slowCard.body.translation().x).toBeLessThan(1.95);
      expect(slowCard.body.translation().z).toBeLessThan(DECK_TOP);
      expect(fastCard.body.translation().x).toBeLessThan(
        slowCard.body.translation().x - 0.35
      );
    } finally {
      fastWorld.free();
      slowWorld.free();
    }
  });

  test("keeps visible inertia when a flick ends with a slower sample", () => {
    const world = createWorld();

    try {
      const fastSample = getSmoothedPointerVelocity({
        delta: [0.2, 0],
        elapsedSeconds: 0.016,
        maxSpeed: 8,
        previousVelocity: [0, 0],
      });
      const releaseVelocity = getSmoothedPointerVelocity({
        delta: [0.004, 0],
        elapsedSeconds: 0.016,
        maxSpeed: 8,
        previousVelocity: fastSample,
      });
      const card = createCard(world, {
        position: [0, 0, CARD_HALF_DEPTH + CARD_PHYSICS.contactSkin],
        velocity: [releaseVelocity[0], releaseVelocity[1], 0],
      });

      step(world, 18);

      expect(card.body.translation().x).toBeGreaterThan(0.2);
      expect(card.body.translation().z).toBeGreaterThanOrEqual(
        CARD_HALF_DEPTH - 0.0006
      );
    } finally {
      world.free();
    }
  });
});
