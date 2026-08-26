"use client";

import { memo, useEffect, useMemo } from "react";
import {
  Color,
  MeshStandardMaterial,
  type ColorRepresentation,
} from "three";

const CLOTH_VERTEX_DECLARATION = /* glsl */ `
#include <common>
varying vec3 vClothPosition;
`;

const CLOTH_VERTEX_POSITION = /* glsl */ `
#include <begin_vertex>
vClothPosition = position;
`;

const CLOTH_FRAGMENT_DECLARATION = /* glsl */ `
#include <common>
varying vec3 vClothPosition;

float clothHash(vec2 point) {
  return fract(sin(dot(point, vec2(41.7, 289.1))) * 43758.5453);
}

float clothNoise(vec2 point) {
  vec2 cell = floor(point);
  vec2 offset = fract(point);
  vec2 blend = offset * offset * (3.0 - 2.0 * offset);

  return mix(
    mix(clothHash(cell), clothHash(cell + vec2(1.0, 0.0)), blend.x),
    mix(
      clothHash(cell + vec2(0.0, 1.0)),
      clothHash(cell + vec2(1.0, 1.0)),
      blend.x
    ),
    blend.y
  );
}

// Procedural cloth has no mip chain. Fade each thread as its cell footprint
// approaches a pixel so camera zoom and low DPR cannot turn it into moire.
float clothDetailFade(vec2 point) {
  vec2 footprint = fwidth(point);
  float largestFootprint = max(footprint.x, footprint.y);

  return 1.0 - smoothstep(0.28, 0.85, largestFootprint);
}
`;

const CLOTH_FRAGMENT_COLOR = /* glsl */ `
#include <map_fragment>
vec2 clothPoint = vClothPosition.xy;
vec2 clothWarpPoint = clothPoint * vec2(5.5, 1.4);
vec2 clothWeftPoint = clothPoint * vec2(1.2, 6.2) + 0.72;
vec2 clothNapPoint = clothPoint * 7.0;
float clothWarp = clothNoise(clothWarpPoint);
float clothWeft = clothNoise(clothWeftPoint);
float clothNap = clothNoise(clothNapPoint);
float clothFiber =
  ((clothWarp - 0.5) * clothDetailFade(clothWarpPoint) +
    (clothWeft - 0.5) * clothDetailFade(clothWeftPoint)) * 0.012;
float clothCloud =
  (clothNap - 0.5) * clothDetailFade(clothNapPoint) * 0.024;
diffuseColor.rgb *= 1.0 + clothFiber + clothCloud;
`;

const CLOTH_FRAGMENT_ROUGHNESS = /* glsl */ `
#include <roughnessmap_fragment>
roughnessFactor = clamp(
  roughnessFactor + (clothNap - 0.5) * 0.055,
  0.88,
  1.0
);
`;

export const TableClothMaterial = memo(function TableClothMaterial({
  color,
  emissive,
}: {
  color: ColorRepresentation;
  emissive: ColorRepresentation;
}) {
  const material = useMemo(() => {
    const nextMaterial = new MeshStandardMaterial({
      color,
      emissive: new Color(emissive),
      emissiveIntensity: 0.16,
      metalness: 0,
      roughness: 0.965,
    });

    nextMaterial.name = "tarot-table-cloth";
    (
      nextMaterial as MeshStandardMaterial & {
        extensions: { derivatives: boolean };
      }
    ).extensions = { derivatives: true };
    nextMaterial.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", CLOTH_VERTEX_DECLARATION)
        .replace("#include <begin_vertex>", CLOTH_VERTEX_POSITION);
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", CLOTH_FRAGMENT_DECLARATION)
        .replace("#include <map_fragment>", CLOTH_FRAGMENT_COLOR)
        .replace(
          "#include <roughnessmap_fragment>",
          CLOTH_FRAGMENT_ROUGHNESS
        );
    };
    nextMaterial.customProgramCacheKey = () => "tarot-table-cloth-v3";
    return nextMaterial;
  }, [color, emissive]);

  useEffect(() => () => material.dispose(), [material]);

  return <primitive object={material} attach="material" />;
});
