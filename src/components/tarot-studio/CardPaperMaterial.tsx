"use client";

import { memo, useEffect, useMemo } from "react";
import {
  MeshStandardMaterial,
  type ColorRepresentation,
  type Texture,
} from "three";

type CardPaperMaterialProps = {
  color: ColorRepresentation;
  map?: Texture;
  roughness?: number;
  paperSeed?: number;
  albedoVariation?: number;
  roughnessVariation?: number;
  toneMapped?: boolean;
};

const PAPER_VERTEX_DECLARATION = /* glsl */ `
#include <common>
varying vec3 vPaperPosition;
`;

const PAPER_VERTEX_POSITION = /* glsl */ `
#include <begin_vertex>
vPaperPosition = position;
`;

const PAPER_FRAGMENT_DECLARATION = /* glsl */ `
#include <common>
uniform float uPaperSeed;
uniform float uPaperAlbedoVariation;
uniform float uPaperRoughnessVariation;
varying vec3 vPaperPosition;

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
`;

const PAPER_FRAGMENT_COLOR = /* glsl */ `
#include <map_fragment>
vec2 paperPoint = vPaperPosition.xy + vec2(
  uPaperSeed * 0.071,
  uPaperSeed * 0.113
);
float paperCloud = paperNoise(paperPoint * vec2(15.0, 11.0));
float paperFiber = paperNoise(paperPoint * vec2(8.0, 92.0));
float paperGrain =
  (paperCloud - 0.5) * 0.62 +
  (paperFiber - 0.5) * 0.38;
diffuseColor.rgb *= 1.0 + paperGrain * uPaperAlbedoVariation;
`;

const PAPER_FRAGMENT_ROUGHNESS = /* glsl */ `
#include <roughnessmap_fragment>
roughnessFactor = clamp(
  roughnessFactor + paperGrain * uPaperRoughnessVariation,
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
  albedoVariation = 0.035,
  roughnessVariation = 0.12,
  toneMapped = true,
}: CardPaperMaterialProps) {
  const material = useMemo(() => {
    const nextMaterial = new MeshStandardMaterial({
      color,
      map,
      metalness: 0,
      roughness,
      toneMapped,
    });

    nextMaterial.name = "tarot-card-paper";
    nextMaterial.onBeforeCompile = (shader) => {
      shader.uniforms.uPaperSeed = { value: paperSeed };
      shader.uniforms.uPaperAlbedoVariation = {
        value: albedoVariation,
      };
      shader.uniforms.uPaperRoughnessVariation = {
        value: roughnessVariation,
      };
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
    };
    nextMaterial.customProgramCacheKey = () => "tarot-card-paper-v1";

    return nextMaterial;
  }, [
    albedoVariation,
    color,
    map,
    paperSeed,
    roughness,
    roughnessVariation,
    toneMapped,
  ]);

  useEffect(() => () => material.dispose(), [material]);

  return <primitive object={material} attach="material" />;
});
