import * as THREE from 'three';

import { BLOCKS, BlockId } from './blocks';

function clampChannel(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), 1 | state);
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function tileColorWithLightness(hex: string, delta: number): string {
  const normalized = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!normalized) {
    throw new Error(`Expected a six-digit hex color, received "${hex}".`);
  }
  const value = normalized[1] ?? '000000';
  const red = clampChannel(parseInt(value.slice(0, 2), 16) + delta);
  const green = clampChannel(parseInt(value.slice(2, 4), 16) + delta);
  const blue = clampChannel(parseInt(value.slice(4, 6), 16) + delta);
  return `#${red.toString(16).padStart(2, '0')}${green.toString(16).padStart(2, '0')}${blue.toString(16).padStart(2, '0')}`;
}

export function createBlockAtlas(documentPort: Document = document): THREE.CanvasTexture {
  const canvas = documentPort.createElement('canvas');
  canvas.width = 48;
  canvas.height = 48;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Could not create atlas 2D context.');
  }

  context.clearRect(0, 0, canvas.width, canvas.height);

  for (const id of Object.values(BlockId).filter((value): value is BlockId => typeof value === 'number')) {
    if (id === BlockId.Air) {
      continue;
    }

    const tile = BLOCKS[id].atlasTile;
    const tileX = (tile % 3) * 16;
    const tileY = Math.floor(tile / 3) * 16;
    context.fillStyle = BLOCKS[id].color;
    context.fillRect(tileX, tileY, 16, 16);

    const random = mulberry32(id * 9973);
    for (let index = 0; index < 48; index += 1) {
      const x = tileX + Math.floor(random() * 16);
      const y = tileY + Math.floor(random() * 16);
      const delta = Math.floor(random() * 25) - 12;
      context.fillStyle = tileColorWithLightness(BLOCKS[id].color, delta);
      context.fillRect(x, y, 1, 1);
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.magFilter = THREE.NearestFilter;
  texture.minFilter = THREE.NearestMipmapLinearFilter;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}
