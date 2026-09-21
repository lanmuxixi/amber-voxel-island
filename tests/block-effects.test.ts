import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import { BlockEffects, ParticlePool } from '../src/effects/BlockEffects';
import { BlockId } from '../src/world/blocks';

function isRegularMesh(child: THREE.Object3D): child is THREE.Mesh {
  return child instanceof THREE.Mesh && !(child instanceof THREE.InstancedMesh);
}

describe('ParticlePool', () => {
  it('reuses entries when capacity is exhausted or released', () => {
    const pool = new ParticlePool(24);
    const acquired = Array.from({ length: 24 }, () => pool.acquire(0.45));

    expect(acquired[0]?.index).toBe(0);
    expect(acquired[23]?.index).toBe(23);
    expect(pool.acquire(0.45).index).toBe(0);

    pool.release(3);
    expect(pool.acquire(0.45).index).toBe(3);
  });

  it('expires active entries after their duration elapses', () => {
    const pool = new ParticlePool(24);
    const entry = pool.acquire(0.1);

    pool.update(0.11);

    expect(entry.active).toBe(false);
  });
});

describe('BlockEffects', () => {
  it('spreads removal particles across six deterministic radial directions', () => {
    const scene = new THREE.Scene();
    const effects = new BlockEffects(scene);

    effects.remove({ x: 1, y: 2, z: 3 }, BlockId.Stone);
    effects.update(0.01);

    const particles = scene.children.find((child) => child instanceof THREE.InstancedMesh);
    expect(particles).toBeInstanceOf(THREE.InstancedMesh);
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const radialPositions = new Set<string>();
    for (let index = 0; index < 6; index += 1) {
      (particles as THREE.InstancedMesh).getMatrixAt(index, matrix);
      position.setFromMatrixPosition(matrix);
      radialPositions.add(`${position.x.toFixed(5)},${position.z.toFixed(5)}`);
    }
    expect(radialPositions.size).toBe(6);

    effects.dispose();
  });

  it('does not frustum-cull particles using stale instance bounds', () => {
    const scene = new THREE.Scene();
    const effects = new BlockEffects(scene);
    const particles = scene.children.find((child) => child instanceof THREE.InstancedMesh);

    expect(particles?.frustumCulled).toBe(false);

    effects.dispose();
  });

  it('removes completed place animations from the scene', () => {
    const scene = new THREE.Scene();
    const effects = new BlockEffects(scene);

    effects.place({ x: 1, y: 2, z: 3 }, BlockId.Grass);
    const placedMesh = scene.children.find(isRegularMesh);

    expect(placedMesh).toBeDefined();
    effects.update(0.12);
    expect(scene.children).not.toContain(placedMesh);

    effects.dispose();
  });

  it('renders place animations above the opaque placed block', () => {
    const scene = new THREE.Scene();
    const effects = new BlockEffects(scene);

    effects.place({ x: 1, y: 2, z: 3 }, BlockId.Grass);
    const placedMesh = scene.children.find(isRegularMesh);
    const material = placedMesh?.material as THREE.MeshBasicMaterial | undefined;

    expect(material?.depthTest).toBe(false);
    expect(material?.depthWrite).toBe(false);
    expect(placedMesh?.renderOrder).toBeGreaterThan(0);

    effects.dispose();
  });

  it('keeps four visible place animations when reusing the oldest active entry', () => {
    const scene = new THREE.Scene();
    const effects = new BlockEffects(scene);

    effects.place({ x: 0, y: 2, z: 3 }, BlockId.Stone);
    effects.update(0.06);
    for (let x = 1; x < 5; x += 1) {
      effects.place({ x, y: 2, z: 3 }, BlockId.Stone);
    }

    const placeMeshes = scene.children.filter(isRegularMesh);
    expect(placeMeshes).toHaveLength(4);
    const reusedMesh = placeMeshes.find((mesh) => mesh.position.x === 4.5);
    expect(reusedMesh).toBeDefined();
    expect((reusedMesh?.material as THREE.MeshBasicMaterial).opacity).toBe(0.45);

    effects.dispose();
  });
});
