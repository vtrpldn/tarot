import type { TablePoint } from "@/types";

const CARD_THICKNESS = 0.018;
const CARD_FACE_PLANE_OFFSET = 0.002;

/** Shared rendered-card bounds used by geometry, colliders, and layout. */
export const CARD_GEOMETRY = {
  bevelSize: 0.006,
  facePlaneOffset: CARD_FACE_PLANE_OFFSET,
  thickness: CARD_THICKNESS,
  visibleHalfDepth: CARD_THICKNESS / 2 + CARD_FACE_PLANE_OFFSET,
  visibleThickness: CARD_THICKNESS + CARD_FACE_PLANE_OFFSET * 2,
} as const;

export const CARD_PHYSICS = {
  // Keep a deliberate off-centre flick readable without letting a light card
  // continue into several distracting revolutions after release.
  angularDamping: 5.5,
  cardFriction: 0.28,
  cardMassKilograms: 0.0018,
  cardRestitution: 0.035,
  contactSkin: 0.001,
  dragLift: 0.18,
  gravity: [0, 0, -9.81] as const,
  linearDamping: 0.65,
  maxAngularSpeed: 6,
  // Limit paper-card descent so a higher pickup does not amplify landing impact.
  maxFallSpeed: 1.6,
  maxPlanarSpeed: 4.2,
  // Table-card hold height is independent of the deck-clearance throw arc.
  pickupLift: 0.45,
  throwArcMinimumPlanarSpeed: 1.4,
  throwArcMaximumVerticalSpeed: 1.45,
  settleAngularSpeed: 0.035,
  settleLinearSpeed: 0.018,
  spawnLift: 0.14,
  tableFriction: 0.46,
  tableRestitution: 0,
  timeStep: 1 / 60,
} as const;

const POINTER_VELOCITY_RESPONSE = 36;
const POINTER_VELOCITY_RESPONSE_WINDOW = 1 / 30;
const STALE_POINTER_VELOCITY_SECONDS = 0.12;

export type PhysicsQuaternion = [x: number, y: number, z: number, w: number];

export type PhysicsCardPose = {
  faceUp: boolean;
  position: TablePoint;
  rotation: number;
};

export type PhysicsCardPoseUpdate = PhysicsCardPose & {
  authorityKey: string;
  cardId: string;
};

export type PhysicsFlipVisualState = {
  rotationY: number;
  scaleX: number;
  scaleY: number;
};

export function advanceFlipElapsed({
  durationSeconds,
  elapsedSeconds,
  frameDeltaSeconds,
  reducedMotion,
}: {
  durationSeconds: number;
  elapsedSeconds: number;
  frameDeltaSeconds: number;
  reducedMotion: boolean;
}): number {
  if (reducedMotion) {
    return durationSeconds;
  }

  return Math.min(
    durationSeconds,
    elapsedSeconds + Math.min(Math.max(0, frameDeltaSeconds), 1 / 30)
  );
}

export function getSmoothedPointerVelocity({
  delta,
  elapsedSeconds,
  maxSpeed,
  previousVelocity,
}: {
  delta: TablePoint;
  elapsedSeconds: number;
  maxSpeed: number;
  previousVelocity: TablePoint;
}): TablePoint {
  const sampleElapsed = Math.min(
    0.064,
    Math.max(0.004, elapsedSeconds)
  );
  let sampleVelocityX = delta[0] / sampleElapsed;
  let sampleVelocityY = delta[1] / sampleElapsed;
  const sampleSpeed = Math.hypot(sampleVelocityX, sampleVelocityY);

  if (sampleSpeed > maxSpeed) {
    const velocityScale = maxSpeed / sampleSpeed;
    sampleVelocityX *= velocityScale;
    sampleVelocityY *= velocityScale;
  }

  // Keep one late render frame from replacing an intentional flick with a
  // near-zero final delta. A genuinely paused pointer should still begin a
  // fresh velocity sample instead of resurrecting stale momentum.
  if (elapsedSeconds >= STALE_POINTER_VELOCITY_SECONDS) {
    return [sampleVelocityX, sampleVelocityY];
  }

  const responseElapsed = Math.min(
    POINTER_VELOCITY_RESPONSE_WINDOW,
    Math.max(0.004, elapsedSeconds)
  );
  const blend =
    1 - Math.exp(-responseElapsed * POINTER_VELOCITY_RESPONSE);

  return [
    previousVelocity[0] +
      (sampleVelocityX - previousVelocity[0]) * blend,
    previousVelocity[1] +
      (sampleVelocityY - previousVelocity[1]) * blend,
  ];
}

export type PhysicsCardLaunch = {
  id: number;
  angularVelocity: [x: number, y: number, z: number];
  faceUp: boolean;
  linearVelocity: [x: number, y: number, z: number];
  position: [x: number, y: number, z: number];
  rotation: number;
  targetPosition: TablePoint;
};

export type PhysicsCardLaunchInput = Omit<PhysicsCardLaunch, "id">;

export type PhysicsTableBounds = {
  bottom: number;
  left: number;
  right: number;
  top: number;
};

export type ReleaseKinematics = {
  angularVelocity: [x: number, y: number, z: number];
  linearVelocity: [x: number, y: number, z: number];
};

/**
 * Whether a forward planar release path reaches an axis-aligned footprint.
 * This deliberately works with an expanded collider footprint so the moving
 * card's own half extents are accounted for at the call site.
 */
export function doesPlanarRayEnterBounds({
  bounds,
  origin,
  velocity,
}: {
  bounds: PhysicsTableBounds;
  origin: TablePoint;
  velocity: TablePoint;
}): boolean {
  const left = Math.min(bounds.left, bounds.right);
  const right = Math.max(bounds.left, bounds.right);
  const bottom = Math.min(bounds.bottom, bounds.top);
  const top = Math.max(bounds.bottom, bounds.top);
  const [originX, originY] = origin;
  const [velocityX, velocityY] = velocity;

  if (
    !Number.isFinite(originX) ||
    !Number.isFinite(originY) ||
    !Number.isFinite(velocityX) ||
    !Number.isFinite(velocityY) ||
    Math.hypot(velocityX, velocityY) < 0.000001
  ) {
    return false;
  }

  let entry = -Infinity;
  let exit = Infinity;
  const axes: Array<[number, number, number, number]> = [
    [originX, velocityX, left, right],
    [originY, velocityY, bottom, top],
  ];

  for (const [coordinate, speed, minimum, maximum] of axes) {
    if (Math.abs(speed) < 0.000001) {
      if (coordinate < minimum || coordinate > maximum) {
        return false;
      }
      continue;
    }

    const firstHit = (minimum - coordinate) / speed;
    const secondHit = (maximum - coordinate) / speed;
    entry = Math.max(entry, Math.min(firstHit, secondHit));
    exit = Math.min(exit, Math.max(firstHit, secondHit));
  }

  return exit >= Math.max(0, entry);
}

/**
 * Uses the elevated crossing path only for an actual throw whose forward
 * trajectory reaches the deck. A slow push has no vertical launch component,
 * so it must remain in the table contact plane and meet the deck edge.
 */
export function shouldUseDeckClearanceArc({
  bounds,
  kinematics,
  origin,
}: {
  bounds: PhysicsTableBounds | undefined;
  kinematics: ReleaseKinematics;
  origin: TablePoint;
}): boolean {
  return Boolean(
    bounds &&
      kinematics.linearVelocity[2] > 0.0001 &&
      doesPlanarRayEnterBounds({
        bounds,
        origin,
        velocity: [
          kinematics.linearVelocity[0],
          kinematics.linearVelocity[1],
        ],
      })
  );
}

type QuaternionLike = {
  w: number;
  x: number;
  y: number;
  z: number;
};

type TranslationLike = {
  x: number;
  y: number;
};

const clampMagnitude = (
  first: number,
  second: number,
  maximum: number
): [number, number] => {
  const magnitude = Math.hypot(first, second);

  if (!Number.isFinite(magnitude) || magnitude === 0) {
    return [0, 0];
  }

  const scale = Math.min(1, maximum / magnitude);
  return [first * scale, second * scale];
};

export function clampPhysicsPointToBounds(
  point: TablePoint,
  bounds: PhysicsTableBounds
): TablePoint {
  const left = Math.min(bounds.left, bounds.right);
  const right = Math.max(bounds.left, bounds.right);
  const bottom = Math.min(bounds.bottom, bounds.top);
  const top = Math.max(bounds.bottom, bounds.top);
  const fallbackX = (left + right) / 2;
  const fallbackY = (bottom + top) / 2;
  const x = Number.isFinite(point[0]) ? point[0] : fallbackX;
  const y = Number.isFinite(point[1]) ? point[1] : fallbackY;

  return [
    Math.max(left, Math.min(right, x)),
    Math.max(bottom, Math.min(top, y)),
  ];
}

/** Limits collision-added rotation without changing its physical direction. */
export function clampAngularVelocity(
  velocity: [x: number, y: number, z: number]
): [x: number, y: number, z: number] {
  const magnitude = Math.hypot(velocity[0], velocity[1], velocity[2]);

  if (!Number.isFinite(magnitude)) {
    return [0, 0, 0];
  }

  if (magnitude <= CARD_PHYSICS.maxAngularSpeed || magnitude === 0) {
    return velocity;
  }

  const scale = CARD_PHYSICS.maxAngularSpeed / magnitude;

  return [velocity[0] * scale, velocity[1] * scale, velocity[2] * scale];
}

export function createCardQuaternion(
  rotationDegrees: number,
  faceUp: boolean
): PhysicsQuaternion {
  const halfYaw = (rotationDegrees * Math.PI) / 360;
  const sine = Math.sin(halfYaw);
  const cosine = Math.cos(halfYaw);

  // Yaw is applied after the face-down half-turn around local Y. Keeping the
  // local Y axis stable makes persisted table rotation recoverable on either
  // face without relying on Euler-angle decomposition near 180 degrees.
  return faceUp
    ? [0, 0, sine, cosine]
    : [-sine, cosine, 0, 0];
}

/** Turns a card over around its local Y axis without changing its yaw. */
export function flipCardQuaternion(
  quaternion: QuaternionLike
): PhysicsQuaternion {
  return [
    -quaternion.z,
    quaternion.w,
    quaternion.x,
    -quaternion.y,
  ];
}

export function getCardPose(
  translation: TranslationLike,
  quaternion: QuaternionLike
): PhysicsCardPose {
  const normalZ =
    1 - 2 * (quaternion.x * quaternion.x + quaternion.y * quaternion.y);
  const localYAxisX =
    2 * (quaternion.x * quaternion.y - quaternion.w * quaternion.z);
  const localYAxisY =
    1 - 2 * (quaternion.x * quaternion.x + quaternion.z * quaternion.z);
  const rawRotation =
    (Math.atan2(-localYAxisX, localYAxisY) * 180) / Math.PI;

  return {
    faceUp: normalZ >= 0,
    position: [translation.x, translation.y],
    rotation: normalizeRotation(rawRotation),
  };
}

export function getReleaseKinematics({
  grabOffset,
  pointerVelocity,
  reducedMotion,
}: {
  grabOffset: TablePoint;
  pointerVelocity: TablePoint;
  reducedMotion: boolean;
}): ReleaseKinematics {
  if (reducedMotion) {
    return {
      angularVelocity: [0, 0, 0],
      linearVelocity: [0, 0, 0],
    };
  }

  const [velocityX, velocityY] = clampMagnitude(
    pointerVelocity[0],
    pointerVelocity[1],
    CARD_PHYSICS.maxPlanarSpeed
  );
  const torque = grabOffset[0] * velocityY - grabOffset[1] * velocityX;
  // Pointer coordinates are in world units, so an edge grab can otherwise
  // produce a much larger torque than the planar throw warrants.
  const angularZ = Math.max(
    -CARD_PHYSICS.maxAngularSpeed,
    Math.min(CARD_PHYSICS.maxAngularSpeed, torque * 3.6)
  );
  const planarSpeed = Math.hypot(velocityX, velocityY);
  const throwArcProgress = Math.max(
    0,
    Math.min(
      1,
      (planarSpeed - CARD_PHYSICS.throwArcMinimumPlanarSpeed) /
        (CARD_PHYSICS.maxPlanarSpeed -
          CARD_PHYSICS.throwArcMinimumPlanarSpeed)
    )
  );
  const verticalVelocity =
    CARD_PHYSICS.throwArcMaximumVerticalSpeed * throwArcProgress;

  return {
    angularVelocity: [0, 0, angularZ],
    linearVelocity: [velocityX, velocityY, verticalVelocity],
  };
}

export function constrainReleaseToBounds({
  bounds,
  kinematics,
  position,
}: {
  bounds: PhysicsTableBounds;
  kinematics: ReleaseKinematics;
  position: TablePoint;
}): ReleaseKinematics {
  const left = Math.min(bounds.left, bounds.right);
  const right = Math.max(bounds.left, bounds.right);
  const bottom = Math.min(bounds.bottom, bounds.top);
  const top = Math.max(bounds.bottom, bounds.top);
  const [velocityX, velocityY, velocityZ] = kinematics.linearVelocity;
  const boundedVelocityX =
    (position[0] <= left && velocityX < 0) ||
    (position[0] >= right && velocityX > 0)
      ? 0
      : velocityX;
  const boundedVelocityY =
    (position[1] <= bottom && velocityY < 0) ||
    (position[1] >= top && velocityY > 0)
      ? 0
      : velocityY;

  return {
    angularVelocity: [...kinematics.angularVelocity],
    linearVelocity: [boundedVelocityX, boundedVelocityY, velocityZ],
  };
}

export function constrainVelocityForNextPhysicsStep({
  bounds,
  maximumFallSpeed = Infinity,
  position,
  timeStepSeconds,
  velocity,
}: {
  bounds: PhysicsTableBounds;
  maximumFallSpeed?: number;
  position: TablePoint;
  timeStepSeconds: number;
  velocity: [x: number, y: number, z: number];
}): [x: number, y: number, z: number] {
  const left = Math.min(bounds.left, bounds.right);
  const right = Math.max(bounds.left, bounds.right);
  const bottom = Math.min(bounds.bottom, bounds.top);
  const top = Math.max(bounds.bottom, bounds.top);
  const step = Math.max(0.0001, timeStepSeconds);
  const constrainAxis = (
    coordinate: number,
    speed: number,
    minimum: number,
    maximum: number
  ) => {
    if (speed > 0) {
      return Math.min(speed, Math.max(0, (maximum - coordinate) / step));
    }

    if (speed < 0) {
      return Math.max(speed, Math.min(0, (minimum - coordinate) / step));
    }

    return speed;
  };

  return [
    constrainAxis(position[0], velocity[0], left, right),
    constrainAxis(position[1], velocity[1], bottom, top),
    Math.max(-Math.max(0, maximumFallSpeed), velocity[2]),
  ];
}

export function getFlipVisualState(progress: number): PhysicsFlipVisualState {
  const boundedProgress = Math.max(0, Math.min(1, progress));
  const eased =
    boundedProgress * boundedProgress * (3 - 2 * boundedProgress);
  // Hold the card fully edge-on around the face swap. Demand-rendered frames
  // can advance by almost eight percent of a flip, so a single zero-width
  // instant is easy to skip and exposes the face change at a visible width.
  const collapseEnd = 0.42;
  const expandStart = 0.58;
  const horizontalFold =
    eased < collapseEnd
      ? Math.cos((eased / collapseEnd) * (Math.PI / 2))
      : eased <= expandStart
        ? 0
        : Math.sin(
            ((eased - expandStart) / (1 - expandStart)) * (Math.PI / 2)
          );

  return {
    // Stay in the card's physical plane: squeeze horizontally, swap the
    // already-opposed face planes while edge-on, then reopen. A real nested
    // quarter-turn would leave the collider hull and intersect nearby cards.
    rotationY: eased < 0.5 ? 0 : Math.PI,
    scaleX: horizontalFold,
    scaleY: 1,
  };
}

export function isPhysicsLaunchForTarget(
  launch: PhysicsCardLaunch | undefined,
  target: TablePoint
): launch is PhysicsCardLaunch {
  return Boolean(
    launch &&
      Math.hypot(
        launch.targetPosition[0] - target[0],
        launch.targetPosition[1] - target[1]
      ) <= 0.0015
  );
}

export function isPhysicsLaunchForMountedCard(
  launch: PhysicsCardLaunch,
  zone: "deck" | "table",
  target: TablePoint
): boolean {
  return zone === "table" && isPhysicsLaunchForTarget(launch, target);
}

export function getCardColliderHalfExtents(
  width: number,
  height: number,
  thickness: number
): [x: number, y: number, z: number] {
  return [
    Math.max(0.01, Math.abs(width) / 2 + CARD_GEOMETRY.bevelSize),
    Math.max(0.01, Math.abs(height) / 2 + CARD_GEOMETRY.bevelSize),
    Math.max(
      0.001,
      Math.abs(thickness) / 2 + CARD_GEOMETRY.facePlaneOffset
    ),
  ];
}

/** Bounds a cascaded card stack around the midpoint of all layer offsets. */
export function getOffsetCollisionFootprint({
  halfHeight,
  halfWidth,
  offsets,
}: {
  halfHeight: number;
  halfWidth: number;
  offsets: readonly TablePoint[];
}): {
  centerOffset: TablePoint;
  halfHeight: number;
  halfWidth: number;
} {
  const finiteOffsets = offsets.filter(
    ([x, y]) => Number.isFinite(x) && Number.isFinite(y)
  );
  const points =
    finiteOffsets.length > 0 ? finiteOffsets : [[0, 0] as TablePoint];
  const minimumX = Math.min(...points.map(([x]) => x));
  const maximumX = Math.max(...points.map(([x]) => x));
  const minimumY = Math.min(...points.map(([, y]) => y));
  const maximumY = Math.max(...points.map(([, y]) => y));

  return {
    centerOffset: [
      (minimumX + maximumX) / 2,
      (minimumY + maximumY) / 2,
    ],
    halfHeight: Math.max(0, halfHeight) + (maximumY - minimumY) / 2,
    halfWidth: Math.max(0, halfWidth) + (maximumX - minimumX) / 2,
  };
}

export function hasMeaningfulPoseChange(
  current: PhysicsCardPose,
  next: PhysicsCardPose
): boolean {
  const positionDelta = Math.hypot(
    current.position[0] - next.position[0],
    current.position[1] - next.position[1]
  );
  const rotationDelta = Math.abs(
    normalizeRotation(current.rotation - next.rotation)
  );

  return (
    current.faceUp !== next.faceUp ||
    positionDelta > 0.0015 ||
    rotationDelta > 0.08
  );
}

/**
 * Identifies the durable pose that a physics body was last reconciled with.
 * Settled solver output is accepted only while this key still matches the
 * session, preventing a late sleep event from overwriting undo or redo.
 */
export function createPhysicsAuthorityKey({
  faceUp,
  position,
  rotation,
  zIndex,
}: PhysicsCardPose & { zIndex: number }): string {
  return [
    faceUp ? 1 : 0,
    position[0],
    position[1],
    normalizeRotation(rotation),
    zIndex,
  ].join(":");
}

export function normalizeRotation(rotation: number): number {
  if (!Number.isFinite(rotation)) {
    return 0;
  }

  const normalized = ((rotation + 180) % 360 + 360) % 360 - 180;
  return Object.is(normalized, -0) ? 0 : normalized;
}
