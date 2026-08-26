"use client";

import { useFrame } from "@react-three/fiber";
import {
  type MutableRefObject,
  memo,
  useEffect,
  useMemo,
} from "react";
import {
  MeshStandardMaterial,
  type ColorRepresentation,
  type Texture,
  Vector2,
} from "three";

export type CardPaperMotion = {
  curlX: number;
  curlY: number;
};

type CardPaperMaterialProps = {
  color: ColorRepresentation;
  map?: Texture;
  roughness?: number;
  paperSeed?: number;
  albedoVariation?: number;
  roughnessVariation?: number;
  toneMapped?: boolean;
  depthTest?: boolean;
  depthWrite?: boolean;
  attach?: string;
  cardSize?: readonly [number, number];
  edgePatina?: number;
  motionRef?: MutableRefObject<CardPaperMotion>;
};

type PaperShader = {
  uniforms: Record<string, { value: unknown }>;
};

const DEFAULT_CARD_SIZE = [1, 1] as const;

const CardPaperCurlUpdater = memo(function CardPaperCurlUpdater({
  material,
  motionRef,
}: {
  material: MeshStandardMaterial;
  motionRef: MutableRefObject<CardPaperMotion>;
}) {
  useFrame(() => {
    const shader = material.userData.paperShader as PaperShader | undefined;
    const curl = shader?.uniforms.uPaperCurl?.value;

    if (curl instanceof Vector2) {
      curl.set(motionRef.current.curlX, motionRef.current.curlY);
    }
  });

  return null;
});

const PAPER_VERTEX_DECLARATION = /* glsl */ `
#include <common>
varying vec3 vPaperPosition;
varying float vPaperEdge;
uniform vec2 uPaperCurl;
uniform vec2 uPaperSize;
`;

const PAPER_VERTEX_POSITION = /* glsl */ `
#include <begin_vertex>
vPaperPosition = position;
vec2 paperSize = max(uPaperSize, vec2(0.001));
vec2 normalizedPaper = clamp(
  position.xy / (paperSize * 0.5),
  vec2(-1.0),
  vec2(1.0)
);
vec2 paperCurve = pow(abs(normalizedPaper), vec2(2.35));
transformed.z +=
  uPaperCurl.x * (paperCurve.x - 0.26) +
  uPaperCurl.y * (paperCurve.y - 0.26);
vPaperEdge = max(abs(normalizedPaper.x), abs(normalizedPaper.y));
`;

const PAPER_FRAGMENT_DECLARATION = /* glsl */ `
#include <common>
uniform float uPaperSeed;
uniform float uPaperAlbedoVariation;
uniform float uPaperRoughnessVariation;
uniform float uPaperEdgePatina;
varying vec3 vPaperPosition;
varying float vPaperEdge;

float paperHash(vec2 point) {
  return fract(
    sin(dot(point, vec2(127.1, 311.7)) + uPaperSeed * 19.19) *
    43758.5453123
  );
}

float paperNoise(vec2 point) {
  vec2 cell = floor(point);
  vec2 offset = fract(point);
  vec2 blend = offset * offset * (3.0 - 2.0 * offset);

  return mix(
    mix(paperHash(cell), paperHash(cell + vec2(1.0, 0.0)), blend.x),
    mix(
      paperHash(cell + vec2(0.0, 1.0)),
      paperHash(cell + vec2(1.0, 1.0)),
      blend.x
    ),
    blend.y
  );
}

// Fade procedural detail before one noise cell becomes smaller than a pixel.
// Unlike texture mipmaps, this shader-generated grain has no automatic
// minification, so without this it can alias into visible stripes at low DPR.
float paperDetailFade(vec2 point) {
  vec2 footprint = fwidth(point);
  float largestFootprint = max(footprint.x, footprint.y);

  return 1.0 - smoothstep(0.28, 0.85, largestFootprint);
}
`;

const PAPER_FRAGMENT_COLOR = /* glsl */ `
#include <map_fragment>
vec2 paperPoint = vPaperPosition.xy + vec2(
  uPaperSeed * 0.071,
  uPaperSeed * 0.113
);
vec2 paperCloudPoint = paperPoint * vec2(15.0, 11.0);
vec2 paperFiberPoint = paperPoint * vec2(6.0, 32.0);
float paperCloud = paperNoise(paperCloudPoint);
float paperFiber = paperNoise(paperFiberPoint);
float paperGrain =
  (paperCloud - 0.5) * 0.74 * paperDetailFade(paperCloudPoint) +
  (paperFiber - 0.5) * 0.26 * paperDetailFade(paperFiberPoint);
diffuseColor.rgb *= 1.0 + paperGrain * uPaperAlbedoVariation;
float paperEdgeWear = smoothstep(0.78, 1.0, vPaperEdge);
vec3 agedPaperEdge = vec3(0.76, 0.67, 0.52);
diffuseColor.rgb = mix(
  diffuseColor.rgb,
  diffuseColor.rgb * agedPaperEdge,
  paperEdgeWear * uPaperEdgePatina
);
`;

const PAPER_FRAGMENT_ROUGHNESS = /* glsl */ `
#include <roughnessmap_fragment>
roughnessFactor = clamp(
  roughnessFactor + paperGrain * uPaperRoughnessVariation,
  0.72,
  1.0
);
roughnessFactor = clamp(
  roughnessFactor + paperEdgeWear * uPaperEdgePatina * 0.12,
  0.72,
  1.0
);
`;

export function getPaperSeed(value: string): number {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0) / 4294967295;
}

export const CardPaperMaterial = memo(function CardPaperMaterial({
  color,
  map,
  roughness = 0.92,
  paperSeed = 0,
  albedoVariation = 0.028,
  roughnessVariation = 0.08,
  toneMapped = true,
  depthTest = true,
  depthWrite = true,
  attach = "material",
  cardSize = DEFAULT_CARD_SIZE,
  edgePatina = 0.08,
  motionRef,
}: CardPaperMaterialProps) {
  const cardWidth = cardSize[0];
  const cardHeight = cardSize[1];
  const material = useMemo(() => {
    const nextMaterial = new MeshStandardMaterial({
      color,
      metalness: 0,
      roughness,
      toneMapped,
      depthTest,
      depthWrite,
      ...(map ? { map } : {}),
    });

    nextMaterial.name = "tarot-card-paper";
    (
      nextMaterial as MeshStandardMaterial & {
        extensions: { derivatives: boolean };
      }
    ).extensions = { derivatives: true };
    nextMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.uPaperSeed = { value: paperSeed };
      shader.uniforms.uPaperAlbedoVariation = {
        value: albedoVariation,
      };
      shader.uniforms.uPaperRoughnessVariation = {
        value: roughnessVariation,
      };
      shader.uniforms.uPaperCurl = { value: new Vector2() };
      shader.uniforms.uPaperSize = {
        value: new Vector2(cardWidth, cardHeight),
      };
      shader.uniforms.uPaperEdgePatina = { value: edgePatina };
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", PAPER_VERTEX_DECLARATION)
        .replace("#include <begin_vertex>", PAPER_VERTEX_POSITION);
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", PAPER_FRAGMENT_DECLARATION)
        .replace("#include <map_fragment>", PAPER_FRAGMENT_COLOR)
        .replace(
          "#include <roughnessmap_fragment>",
          PAPER_FRAGMENT_ROUGHNESS
        );
      nextMaterial.userData.paperShader = shader;
    };
    nextMaterial.customProgramCacheKey = () => "tarot-card-paper-v4";

    return nextMaterial;
  }, [
    albedoVariation,
    cardHeight,
    cardWidth,
    color,
    depthTest,
    depthWrite,
    map,
    paperSeed,
    edgePatina,
    roughness,
    roughnessVariation,
    toneMapped,
  ]);

  useEffect(() => () => material.dispose(), [material]);

  return (
    <>
      <primitive object={material} attach={attach} />
      {motionRef ? (
        <CardPaperCurlUpdater material={material} motionRef={motionRef} />
      ) : null}
    </>
  );
});
