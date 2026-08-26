import type { TablePoint } from "@/types";

export const CARD_PHYSICS = {
  angularDamping: 3.2,
  cardFriction: 0.28,
  cardMassKilograms: 0.0018,
  cardRestitution: 0.035,
  colliderInset: 0.025,
  contactSkin: 0.001,
  dragLift: 0.18,
  gravity: [0, 0, -9.81] as const,
  linearDamping: 0.85,
  maxAngularSpeed: 14,
  maxPlanarSpeed: 4.2,
  settleAngularSpeed: 0.035,
  settleLinearSpeed: 0.018,
  spawnLift: 0.14,
  tableFriction: 0.46,
  tableRestitution: 0,
  timeStep: 1 / 60,
} as const;

const POINTER_VELOCITY_RESPONSE = 36;

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
  rotationX: number;
  scaleX: number;
  scaleY: number;
};

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

  const responseElapsed = Math.max(0.004, elapsedSeconds);
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

export function createCardQuaternion(
  rotationDegrees: number,
  faceUp: boolean
): PhysicsQuaternion {
  const halfYaw = (rotationDegrees * Math.PI) / 360;
  const sine = Math.sin(halfYaw);
  const cosine = Math.cos(halfYaw);

  // Yaw is applied after the face-down half-turn around local X. Keeping the
  // local X axis stable makes persisted table rotation recoverable on either
  // face without relying on Euler-angle decomposition near 180 degrees.
  return faceUp
    ? [0, 0, sine, cosine]
    : [cosine, sine, 0, 0];
}

export function getCardPose(
  translation: TranslationLike,
  quaternion: QuaternionLike
): PhysicsCardPose {
  const normalZ =
    1 - 2 * (quaternion.x * quaternion.x + quaternion.y * quaternion.y);
  const localXAxisX =
    1 - 2 * (quaternion.y * quaternion.y + quaternion.z * quaternion.z);
  const localXAxisY =
    2 *
    (quaternion.x * quaternion.y + quaternion.w * quaternion.z);
  const rawRotation =
    (Math.atan2(localXAxisY, localXAxisX) * 180) / Math.PI;

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
  const angularZ = Math.max(
    -CARD_PHYSICS.maxAngularSpeed,
    Math.min(CARD_PHYSICS.maxAngularSpeed, torque * 5.4)
  );

  return {
    angularVelocity: [0, 0, angularZ],
    linearVelocity: [velocityX, velocityY, 0],
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

export function getFlipVisualState(progress: number): PhysicsFlipVisualState {
  const boundedProgress = Math.max(0, Math.min(1, progress));
  const eased =
    boundedProgress * boundedProgress * (3 - 2 * boundedProgress);
  const envelope = Math.sin(Math.PI * eased);

  return {
    rotationX: eased < 0.5 ? 0 : Math.PI,
    scaleX: 1 - envelope * 0.006,
    scaleY: Math.max(0.12, Math.abs(Math.cos(Math.PI * eased))),
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
    Math.max(0.01, width / 2 - CARD_PHYSICS.colliderInset),
    Math.max(0.01, height / 2 - CARD_PHYSICS.colliderInset),
    Math.max(0.001, thickness / 2),
  ];
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
