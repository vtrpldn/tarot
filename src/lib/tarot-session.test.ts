import { describe, expect, test } from "vitest";
import { TABLE_POINT_LIMIT, type TarotSession } from "@/types";
import {
  createPhysicsAuthorityKey,
  type PhysicsCardPose,
  type PhysicsCardPoseUpdate,
} from "./card-physics";
import { tarotSessionReducer } from "./tarot-session";

function createSession(): TarotSession {
  const activeSpread = {
    id: "three-card" as const,
    cardIds: ["table-first", "table-second"],
  };
  const snapshot = {
    activeSpread: null,
    cards: [],
    deckPosition: null,
    selectedCardId: null,
  };

  return {
    activeSpread,
    cardSetId: "rider-waite",
    cards: [
      {
        id: "table-first",
        cardId: "first",
        cardSetId: "rider-waite",
        zone: "table",
        position: [0, 0],
        rotation: 0,
        zIndex: 4,
        faceUp: false,
      },
      {
        id: "table-second",
        cardId: "second",
        cardSetId: "rider-waite",
        zone: "table",
        position: [-0.5, 0.25],
        rotation: 15,
        zIndex: 9,
        faceUp: true,
      },
      {
        id: "deck-card",
        cardId: "third",
        cardSetId: "rider-waite",
        zone: "deck",
        position: [0, 0],
        rotation: 0,
        zIndex: 12,
        faceUp: false,
      },
    ],
    deckPosition: [1, -1],
    selectedCardId: "table-second",
    history: [snapshot],
    redo: [snapshot],
  };
}

function settledPose(
  session: TarotSession,
  cardId: string,
  pose: PhysicsCardPose
): PhysicsCardPoseUpdate {
  const card = session.cards.find((candidate) => candidate.id === cardId);

  return {
    ...pose,
    authorityKey: card ? createPhysicsAuthorityKey(card) : "missing",
    cardId,
  };
}

describe("move", () => {
  test("preserves an explicitly reordered layer while updating position and rotation", () => {
    const reordered = tarotSessionReducer(createSession(), {
      type: "reorder",
      cardId: "table-second",
      direction: "backward",
    });

    const result = tarotSessionReducer(reordered, {
      type: "move",
      cardId: "table-second",
      position: [0.72, -0.36],
      rotation: -42,
    });

    expect(result.cards.find((card) => card.id === "table-second")).toMatchObject({
      position: [0.72, -0.36],
      rotation: -42,
      zIndex: 1,
    });
    expect(result.cards.find((card) => card.id === "table-first")?.zIndex).toBe(2);
  });
});

describe("sync-physics-poses", () => {
  test("synchronizes a batch of settled table poses without recording history", () => {
    const session = createSession();
    const result = tarotSessionReducer(session, {
      type: "sync-physics-poses",
      poses: [
        settledPose(session, "table-first", {
          faceUp: true,
          position: [0.6, -0.4],
          rotation: 37,
        }),
        settledPose(session, "table-second", {
          faceUp: false,
          position: [-0.75, 0.45],
          rotation: -28,
        }),
      ],
    });

    expect(result.cards.slice(0, 2)).toMatchObject([
      {
        id: "table-first",
        faceUp: true,
        position: [0.6, -0.4],
        rotation: 37,
        zIndex: 4,
      },
      {
        id: "table-second",
        faceUp: false,
        position: [-0.75, 0.45],
        rotation: -28,
        zIndex: 9,
      },
    ]);
    expect(result.history).toBe(session.history);
    expect(result.redo).toBe(session.redo);
    expect(result.selectedCardId).toBe(session.selectedCardId);
    expect(result.activeSpread).toBe(session.activeSpread);
  });

  test("ignores poses for deck cards and unknown cards", () => {
    const session = createSession();

    expect(
      tarotSessionReducer(session, {
        type: "sync-physics-poses",
        poses: [
          settledPose(session, "deck-card", {
            faceUp: true,
            position: [1, 1],
            rotation: 60,
          }),
          settledPose(session, "missing-card", {
            faceUp: true,
            position: [1, 1],
            rotation: 60,
          }),
        ],
      })
    ).toBe(session);
  });

  test("clamps persisted table positions to the table limit", () => {
    const session = createSession();
    const result = tarotSessionReducer(session, {
      type: "sync-physics-poses",
      poses: [
        settledPose(session, "table-first", {
          faceUp: true,
          position: [TABLE_POINT_LIMIT + 1, -TABLE_POINT_LIMIT - 1],
          rotation: 45,
        }),
      ],
    });

    expect(result.cards[0].position).toEqual([
      TABLE_POINT_LIMIT,
      -TABLE_POINT_LIMIT,
    ]);
  });

  test("returns the original session when poses only contain solver noise", () => {
    const session = createSession();

    expect(
      tarotSessionReducer(session, {
        type: "sync-physics-poses",
        poses: [
          settledPose(session, "table-first", {
            faceUp: false,
            position: [0.0005, -0.0005],
            rotation: 0.05,
          }),
        ],
      })
    ).toBe(session);
  });

  test("ignores non-finite solver output instead of corrupting persistence", () => {
    const session = createSession();

    expect(
      tarotSessionReducer(session, {
        type: "sync-physics-poses",
        poses: [
          settledPose(session, "table-first", {
            faceUp: true,
            position: [Number.NaN, Number.POSITIVE_INFINITY],
            rotation: Number.NEGATIVE_INFINITY,
          }),
        ],
      })
    ).toBe(session);
  });

  test("rejects a settled pose from an older authoritative session", () => {
    const session = createSession();
    const stalePose = settledPose(session, "table-first", {
      faceUp: true,
      position: [0.8, 0.4],
      rotation: 22,
    });
    const newerSession: TarotSession = {
      ...session,
      cards: session.cards.map((card) =>
        card.id === "table-first"
          ? { ...card, position: [-0.4, -0.2] }
          : card
      ),
    };

    expect(
      tarotSessionReducer(newerSession, {
        type: "sync-physics-poses",
        poses: [stalePose],
      })
    ).toBe(newerSession);
  });
});
