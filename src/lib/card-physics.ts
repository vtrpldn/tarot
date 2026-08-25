import type { TablePoint } from "@/types";

export const CARD_PHYSICS = {
  angularDamping: 8.5,
  cardFriction: 0.62,
  cardMassKilograms: 0.0018,
  cardRestitution: 0.035,
  colliderInset: 0.025,
  contactSkin: 0.001,
  dragLift: 0.18,
  gravity: [0, 0, -9.81] as const,
  linearDamping: 5.5,
  maxAngularSpeed: 14,
  maxPlanarSpeed: 5.8,
  settleAngularSpeed: 0.035,
  settleLinearSpeed: 0.018,
  spawnLift: 0.14,
  tableFriction: 0.78,
  tableRestitution: 0,
  timeStep: 1 / 60,
} as const;

export type PhysicsQuaternion = [x: number, y: number, z: number, w: number];

export type PhysicsCardPose = {
  faceUp: boolean;
  position: TablePoint;
  rotation: number;
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

export function normalizeRotation(rotation: number): number {
  if (!Number.isFinite(rotation)) {
    return 0;
  }

  const normalized = ((rotation + 180) % 360 + 360) % 360 - 180;
  return Object.is(normalized, -0) ? 0 : normalized;
}
