import RAPIER from "@dimforge/rapier3d-compat";
import { beforeAll, describe, expect, test } from "vitest";
import {
  CARD_PHYSICS,
  constrainVelocityForNextPhysicsStep,
  flipCardQuaternion,
  getCardColliderHalfExtents,
  getCardPose,
  getReleaseKinematics,
  getSmoothedPointerVelocity,
} from "./card-physics";
import {
  getDynamicDragVelocity,
  getLayerTransitionClearance,
  getLayerTransitionOffset,
  getLayerTransitionPosition,
} from "../components/tarot-studio/physics-card-drag";

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
    bodyType = "dynamic",
    canSleep = false,
    collisionEvents = false,
    kinematicCollisions = false,
    position,
    velocity = [0, 0, 0],
  }: {
    bodyType?: "dynamic" | "kinematic";
    canSleep?: boolean;
    collisionEvents?: boolean;
    kinematicCollisions?: boolean;
    position: [number, number, number];
    velocity?: [number, number, number];
  }
) {
  const descriptor =
    bodyType === "kinematic"
      ? RAPIER.RigidBodyDesc.kinematicPositionBased()
      : RAPIER.RigidBodyDesc.dynamic();
  descriptor.setTranslation(...position).setCanSleep(canSleep);

  if (bodyType === "dynamic") {
    descriptor
      .setLinvel(...velocity)
      .setLinearDamping(CARD_PHYSICS.linearDamping)
      .setAngularDamping(CARD_PHYSICS.angularDamping)
      .setCcdEnabled(true);
  }

  const body = world.createRigidBody(descriptor);
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

  if (collisionEvents) {
    collider.setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS);
  }
  if (kinematicCollisions) {
    collider.setActiveCollisionTypes(
      RAPIER.ActiveCollisionTypes.DEFAULT |
        RAPIER.ActiveCollisionTypes.KINEMATIC_KINEMATIC
    );
  }

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

  test("lets a contact-height pointer drag wake and push a resting table card", () => {
    const world = createWorld();

    try {
      const tableHeight = CARD_HALF_DEPTH + CARD_PHYSICS.contactSkin;
      const target = createCard(world, {
        canSleep: true,
        position: [0, 0, tableHeight],
      });
      const driver = createCard(world, {
        bodyType: "kinematic",
        position: [-2.1, 0, tableHeight + 0.006],
      });
      target.body.sleep();

      for (let frame = 1; frame <= 32; frame += 1) {
        driver.body.setNextKinematicTranslation({
          x: -2.1 + frame * 0.01,
          y: 0,
          z: tableHeight + 0.006,
        });
        world.step();
      }

      expect(target.body.isSleeping()).toBe(false);
      expect(target.body.translation().x).toBeGreaterThan(0.1);
      expect(target.body.translation().z).toBeGreaterThanOrEqual(
        CARD_HALF_DEPTH - 0.0006
      );
    } finally {
      world.free();
    }
  });

  test("keeps a dynamically held card behind the card blocking its pointer target", () => {
    const world = createWorld();

    try {
      const tableHeight = CARD_HALF_DEPTH + CARD_PHYSICS.contactSkin;
      const target = createCard(world, {
        canSleep: true,
        position: [0, 0, tableHeight],
      });
      const driver = createCard(world, {
        position: [-2.1, 0, tableHeight + 0.006],
      });
      driver.body.setGravityScale(0, true);
      target.body.sleep();
      let driverPassedTarget = false;

      for (let frame = 0; frame < 90; frame += 1) {
        const current = driver.body.translation();
        const [x, y, z] = getDynamicDragVelocity({
          current: [current.x, current.y, current.z],
          maximumSpeed: 5.4,
          target: [2.2, 0, tableHeight + 0.006],
          timeStepSeconds: CARD_PHYSICS.timeStep,
        });
        driver.body.setLinvel({ x, y, z }, true);
        driver.body.setAngvel({ x: 0, y: 0, z: 0 }, true);
        world.step();
        driverPassedTarget ||=
          driver.body.translation().x > target.body.translation().x;
      }

      expect(target.body.isSleeping()).toBe(false);
      expect(target.body.translation().x).toBeGreaterThan(0.2);
      expect(driverPassedTarget).toBe(false);
      expect(driver.body.translation().x).toBeLessThan(
        target.body.translation().x
      );
    } finally {
      world.free();
    }
  });

  test("keeps two 45-degree cards separated throughout a kinematic layer swap", () => {
    const world = createWorld();

    try {
      const bottomZ = CARD_HALF_DEPTH + CARD_PHYSICS.contactSkin;
      const layerStep =
        CARD_HALF_DEPTH * 2 + CARD_PHYSICS.contactSkin * 2;
      const lower = createCard(world, {
        bodyType: "kinematic",
        kinematicCollisions: true,
        position: [0, 0, bottomZ],
      });
      const upper = createCard(world, {
        bodyType: "kinematic",
        kinematicCollisions: true,
        position: [0, 0, bottomZ + layerStep],
      });
      const halfYaw = Math.PI / 8;
      lower.body.setRotation(
        { x: 0, y: 0, z: Math.sin(halfYaw), w: Math.cos(halfYaw) },
        true
      );
      upper.body.setRotation(
        { x: 0, y: 0, z: -Math.sin(halfYaw), w: Math.cos(halfYaw) },
        true
      );
      const bounds = { bottom: -8, left: -8, right: 8, top: 8 };
      const clearance = getLayerTransitionClearance({
        cardHeight: CARD_HEIGHT,
        cardWidth: CARD_WIDTH,
        contactSkin: CARD_PHYSICS.contactSkin,
      });
      const lowerOffset = getLayerTransitionOffset({
        bounds,
        clearance,
        layerDirection: 1,
        start: [0, 0],
      });
      const upperOffset = getLayerTransitionOffset({
        bounds,
        clearance,
        layerDirection: -1,
        start: [0, 0],
      });
      let deepestPenetration = 0;

      for (let frame = 0; frame <= 36; frame += 1) {
        const progress = frame / 36;
        const lowerPosition = getLayerTransitionPosition({
          lift: 0.12,
          offset: lowerOffset,
          progress,
          start: [0, 0, bottomZ],
          target: [0, 0, bottomZ + layerStep],
        });
        const upperPosition = getLayerTransitionPosition({
          lift: 0.12,
          offset: upperOffset,
          progress,
          start: [0, 0, bottomZ + layerStep],
          target: [0, 0, bottomZ],
        });
        lower.body.setNextKinematicTranslation({
          x: lowerPosition[0],
          y: lowerPosition[1],
          z: lowerPosition[2],
        });
        upper.body.setNextKinematicTranslation({
          x: upperPosition[0],
          y: upperPosition[1],
          z: upperPosition[2],
        });
        world.step();

        const contact = lower.collider.contactCollider(upper.collider, 0);
        deepestPenetration = Math.min(
          deepestPenetration,
          contact?.distance ?? 0
        );
      }

      expect(deepestPenetration).toBeGreaterThanOrEqual(-0.00005);
      expect(lower.body.translation().z).toBeCloseTo(bottomZ + layerStep);
      expect(upper.body.translation().z).toBeCloseTo(bottomZ);
    } finally {
      world.free();
    }
  });

  test("wakes a sleeping table card when a max-speed release reaches it", () => {
    const world = createWorld();

    try {
      const tableHeight = CARD_HALF_DEPTH + CARD_PHYSICS.contactSkin;
      const target = createCard(world, {
        canSleep: true,
        position: [0, 0, tableHeight],
      });
      const release = getReleaseKinematics({
        grabOffset: [0, 0],
        pointerVelocity: [CARD_PHYSICS.maxPlanarSpeed, 0],
        reducedMotion: false,
      });
      const projectile = createCard(world, {
        position: [-CARD_WIDTH - 0.2, 0, tableHeight + 0.006],
        // Non-deck table releases suppress the vertical arc so their collider
        // remains in the target card's contact band.
        velocity: [release.linearVelocity[0], release.linearVelocity[1], 0],
      });
      target.body.sleep();

      step(world, 24);

      expect(target.body.isSleeping()).toBe(false);
      expect(target.body.translation().x).toBeGreaterThan(0.04);
      expect(projectile.body.translation().x).toBeLessThan(
        target.body.translation().x
      );
    } finally {
      world.free();
    }
  });

  test("promotes an authored kinematic layer after a card impact", () => {
    const world = createWorld();
    const events = new RAPIER.EventQueue(true);

    try {
      const tableHeight = CARD_HALF_DEPTH + CARD_PHYSICS.contactSkin;
      const target = createCard(world, {
        bodyType: "kinematic",
        collisionEvents: true,
        position: [0, 0, tableHeight],
      });
      const projectile = createCard(world, {
        collisionEvents: true,
        position: [-CARD_WIDTH - 0.2, 0, tableHeight],
        velocity: [CARD_PHYSICS.maxPlanarSpeed, 0, 0],
      });
      let promoted = false;

      for (let frame = 0; frame < 90; frame += 1) {
        world.step(events);
        events.drainCollisionEvents((first, second, started) => {
          if (
            !started ||
            promoted ||
            (first !== target.collider.handle && second !== target.collider.handle)
          ) {
            return;
          }

          const incoming = projectile.body.linvel();
          const planarSpeed = Math.hypot(incoming.x, incoming.y);
          const transferScale = Math.min(
            0.55,
            CARD_PHYSICS.maxPlanarSpeed / planarSpeed
          );
          target.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
          target.body.setLinvel(
            {
              x: incoming.x * transferScale,
              y: incoming.y * transferScale,
              z: 0,
            },
            true
          );
          promoted = true;
        });
      }

      expect(promoted).toBe(true);
      expect(target.body.bodyType()).toBe(RAPIER.RigidBodyType.Dynamic);
      expect(target.body.translation().x).toBeGreaterThan(0.1);
    } finally {
      events.free();
      world.free();
    }
  });

  test("activates an authored layer when a contact-height kinematic drag reaches it", () => {
    const world = createWorld();
    const events = new RAPIER.EventQueue(true);

    try {
      const tableHeight = CARD_HALF_DEPTH + CARD_PHYSICS.contactSkin;
      const target = createCard(world, {
        bodyType: "kinematic",
        collisionEvents: true,
        kinematicCollisions: true,
        position: [0, 0, tableHeight],
      });
      const driver = createCard(world, {
        bodyType: "kinematic",
        collisionEvents: true,
        kinematicCollisions: true,
        position: [-2.1, 0, tableHeight + 0.006],
      });
      let promoted = false;

      for (let frame = 1; frame <= 90; frame += 1) {
        driver.body.setNextKinematicTranslation({
          x: -2.1 + Math.min(frame, 32) * 0.01,
          y: 0,
          z: tableHeight + 0.006,
        });
        world.step(events);
        events.drainCollisionEvents((first, second, started) => {
          if (
            !started ||
            promoted ||
            (first !== target.collider.handle && second !== target.collider.handle)
          ) {
            return;
          }

          const incoming = driver.body.linvel();
          const planarSpeed = Math.hypot(incoming.x, incoming.y);
          const transferScale = Math.min(
            0.55,
            CARD_PHYSICS.maxPlanarSpeed / planarSpeed
          );
          target.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
          target.body.setLinvel(
            {
              x: incoming.x * transferScale,
              y: incoming.y * transferScale,
              z: 0,
            },
            true
          );
          promoted = true;
        });
      }

      expect(promoted).toBe(true);
      expect(target.body.bodyType()).toBe(RAPIER.RigidBodyType.Dynamic);
      expect(target.body.translation().x).toBeGreaterThan(0.1);
    } finally {
      events.free();
      world.free();
    }
  });

  test("keeps authored overlapping rest layers stable without solver compression", () => {
    const world = createWorld();

    try {
      const tableHeight = CARD_HALF_DEPTH + CARD_PHYSICS.contactSkin;
      const layerStep = CARD_HALF_DEPTH * 2 + CARD_PHYSICS.contactSkin * 2;
      const bottom = createCard(world, {
        bodyType: "kinematic",
        position: [0, 0, tableHeight],
      });
      const layers = Array.from({ length: 11 }, (_, index) =>
        createCard(world, {
          bodyType: "kinematic",
          position: [0, 0, tableHeight + (index + 1) * layerStep],
        })
      );

      step(world, 360);

      const top = layers.at(-1)?.body.translation().z ?? 0;
      expect(bottom.body.translation().z).toBeGreaterThanOrEqual(
        CARD_HALF_DEPTH - 0.0006
      );
      expect(top - bottom.body.translation().z).toBeGreaterThanOrEqual(
        11 * (CARD_THICKNESS - 0.001)
      );
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

  test("turns a moving card over without changing its dynamic momentum", () => {
    const world = createWorld();

    try {
      const card = createCard(world, {
        position: [0, 0, 1],
        velocity: [1.2, -0.4, 0.3],
      });
      card.body.setAngvel({ x: 0, y: 0, z: 2 }, true);
      const initialRotation = card.body.rotation();
      const initialFace = getCardPose(
        card.body.translation(),
        initialRotation
      ).faceUp;
      const [x, y, z, w] = flipCardQuaternion(initialRotation);

      card.body.setRotation({ x, y, z, w }, true);

      expect(card.body.bodyType()).toBe(RAPIER.RigidBodyType.Dynamic);
      expect(card.body.linvel()).toMatchObject({
        x: expect.closeTo(1.2, 6),
        y: expect.closeTo(-0.4, 6),
        z: expect.closeTo(0.3, 6),
      });
      expect(card.body.angvel()).toMatchObject({
        x: expect.closeTo(0, 6),
        y: expect.closeTo(0, 6),
        z: expect.closeTo(2, 6),
      });
      expect(
        getCardPose(card.body.translation(), card.body.rotation()).faceUp
      ).toBe(!initialFace);

      step(world, 1);

      expect(card.body.translation().x).toBeGreaterThan(0);
      expect(card.body.linvel().x).toBeGreaterThan(1);
      expect(card.body.angvel().z).toBeGreaterThan(1.5);
    } finally {
      world.free();
    }
  });

  test("brakes an airborne flick at the durable centre boundary", () => {
    const world = createWorld();

    try {
      const right = 3;
      const card = createCard(world, {
        position: [right - 0.01, 0, CARD_HALF_DEPTH + CARD_PHYSICS.dragLift],
        velocity: [
          CARD_PHYSICS.maxPlanarSpeed,
          0,
          CARD_PHYSICS.throwArcMaximumVerticalSpeed,
        ],
      });
      let maximumX = card.body.translation().x;

      for (let frame = 0; frame < 180; frame += 1) {
        const translation = card.body.translation();
        const velocity = card.body.linvel();
        const [x, y, z] = constrainVelocityForNextPhysicsStep({
          bounds: { bottom: -2, left: -3, right, top: 2 },
          position: [translation.x, translation.y],
          timeStepSeconds: CARD_PHYSICS.timeStep,
          velocity: [velocity.x, velocity.y, velocity.z],
        });

        card.body.setLinvel({ x, y, z }, true);
        world.step();
        maximumX = Math.max(maximumX, card.body.translation().x);
      }

      expect(maximumX).toBeLessThanOrEqual(right + 0.001);
      expect(card.body.translation().x).toBeGreaterThan(right - 0.02);
    } finally {
      world.free();
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
