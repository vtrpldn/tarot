import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";

const source = await readFile(
  new URL("../src/lib/card-balance.ts", import.meta.url),
  "utf8"
);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2020,
  },
  fileName: "card-balance.ts",
});
const moduleUrl = `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`;
const {
  evaluateCardSupport,
  getCardStackLevels,
  resolvePrimaryCardDrop,
  shouldFlipAfterFall,
} = await import(moduleUrl);

const layout = {
  cardHeight: 4,
  cardWidth: 2.4,
  dragBounds: { bottom: -8, left: -8, right: 8, top: 8 },
  toPoint: (x, y) => [x, y],
  toWorld: (point) => [point[0], point[1]],
};

function card(id, position, zIndex, rotation = 0) {
  return {
    cardId: id,
    cardSetId: "test",
    faceUp: false,
    id,
    position,
    rotation,
    zIndex,
    zone: "table",
  };
}

function assess(cards, cardId) {
  const levels = getCardStackLevels({
    baseHeight: 0,
    cards,
    layerStep: 1,
    layout,
  });

  return evaluateCardSupport({ cardId, layout, levels });
}

const tableCard = card("table", [0, 0], 0);
assert.equal(assess([tableCard], "table")?.kind, "table");
assert.equal(assess([tableCard], "table")?.stable, true);

const centeredSupport = card("lower", [0, 0], 0);
const centeredCard = card("upper", [0, 0], 1);
assert.equal(
  assess([centeredSupport, centeredCard], "upper")?.stable,
  true,
  "centred card should be stable on a matching support"
);

const rotatedSupport = card("rotated-lower", [0, 0], 0, 35);
const rotatedCard = card("rotated-upper", [0, 0], 1, 35);
assert.equal(
  assess([rotatedSupport, rotatedCard], "rotated-upper")?.stable,
  true,
  "matching rotated cards should keep a stable support polygon"
);

const edgeCards = [
  card("edge-lower", [0, 0], 0),
  card("edge-upper", [1.9, 0], 1),
];
const edgeResolution = resolvePrimaryCardDrop({
  baseHeight: 0,
  cards: edgeCards,
  layerStep: 1,
  layout,
  primaryCardId: "edge-upper",
});
assert.equal(edgeResolution?.outcome, "fell");
assert.ok(
  (edgeResolution?.direction?.[0] ?? 0) > 0,
  "edge card should fall away from its exposed right-side centre of mass"
);

const nearEdgeCards = [
  card("near-edge-lower", [0, 0], 0),
  card("near-edge-upper", [1.1, 0], 1),
];
const nearEdgeResolution = resolvePrimaryCardDrop({
  baseHeight: 0,
  cards: nearEdgeCards,
  layerStep: 1,
  layout,
  primaryCardId: "near-edge-upper",
  supportMargin: 0.12,
});
assert.ok(
  (nearEdgeResolution?.direction?.[0] ?? 0) > 0,
  "a marginally supported card should tip toward its nearest exposed edge"
);

const bridgeCards = [
  card("bridge-left", [-2.25, 0], 0),
  card("bridge-right", [2.25, 0], 1),
  card("bridge-upper", [0, 0], 2),
];
assert.equal(
  assess(bridgeCards, "bridge-upper")?.stable,
  true,
  "two contact patches should form a valid bridge support polygon"
);

assert.equal(
  shouldFlipAfterFall({ cardHeight: 4, cardWidth: 2.4, overhang: 0.1 }),
  false
);
assert.equal(
  shouldFlipAfterFall({ cardHeight: 4, cardWidth: 2.4, overhang: 0.8 }),
  true
);

const repeatedResolution = resolvePrimaryCardDrop({
  baseHeight: 0,
  cards: edgeCards,
  layerStep: 1,
  layout,
  primaryCardId: "edge-upper",
});
assert.deepEqual(
  repeatedResolution,
  edgeResolution,
  "same input should resolve to the same landing"
);

const patch = edgeResolution?.patch;
assert.ok(patch, "falling card should produce a final placement");
assert.ok(
  patch.position[0] >= -6.8 &&
    patch.position[0] <= 6.8 &&
    patch.position[1] >= -6 &&
    patch.position[1] <= 6,
  "resolved landing must keep the whole card inside drag bounds"
);

console.log(
  "Validated support-aware card balance geometry and primary-drop resolution."
);
