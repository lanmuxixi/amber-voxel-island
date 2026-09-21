import * as THREE from 'three';

import { GAME_CONFIG } from '../game/config';

import { createBlockAtlas } from './atlas';
import { worldToChunk, type Vec3i } from './coords';
import { buildChunkMeshData } from './mesh';
import type { WorldReader } from './World';

export class ChunkRenderer {
  private world: WorldReader;

  private readonly atlas: THREE.CanvasTexture;

  private readonly material: THREE.MeshLambertMaterial;

  private readonly meshes = new Map<string, THREE.Mesh>();

  private readonly dirty = new Set<string>();

  constructor(
    private readonly scene: THREE.Scene,
    world: WorldReader,
    atlas = createBlockAtlas(),
  ) {
    this.world = world;
    this.atlas = atlas;
    this.material = new THREE.MeshLambertMaterial({ map: atlas, alphaTest: 0.5 });
  }

  buildAll(): void {
    for (let chunkX = -2; chunkX <= 1; chunkX += 1) {
      for (let chunkZ = -2; chunkZ <= 1; chunkZ += 1) {
        this.rebuildChunk(chunkX, chunkZ);
      }
    }
  }

  replaceWorld(world: WorldReader): void {
    this.world = world;
    for (const mesh of this.meshes.values()) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
    }
    this.meshes.clear();
    this.dirty.clear();
    this.buildAll();
  }

  markBlockDirty(position: Vec3i): void {
    const owner = worldToChunk(position);
    this.dirty.add(`${owner.chunkX},${owner.chunkZ}`);

    if (owner.localX === 0) {
      this.dirty.add(`${owner.chunkX - 1},${owner.chunkZ}`);
    }
    if (owner.localX === GAME_CONFIG.chunkSize - 1) {
      this.dirty.add(`${owner.chunkX + 1},${owner.chunkZ}`);
    }
    if (owner.localZ === 0) {
      this.dirty.add(`${owner.chunkX},${owner.chunkZ - 1}`);
    }
    if (owner.localZ === GAME_CONFIG.chunkSize - 1) {
      this.dirty.add(`${owner.chunkX},${owner.chunkZ + 1}`);
    }
  }

  rebuildPending(limit = GAME_CONFIG.chunkRebuildsPerFrame): void {
    const pending = [...this.dirty].slice(0, limit);
    for (const key of pending) {
      this.dirty.delete(key);
      const [chunkX = 0, chunkZ = 0] = key.split(',').map(Number);
      this.rebuildChunk(chunkX, chunkZ);
    }
  }

  getMeshes(): readonly THREE.Mesh[] {
    return [...this.meshes.values()];
  }

  dispose(): void {
    for (const mesh of this.meshes.values()) {
      this.scene.remove(mesh);
      mesh.geometry.dispose();
    }
    this.meshes.clear();
    this.dirty.clear();
    this.material.dispose();
    this.atlas.dispose();
  }

  private rebuildChunk(chunkX: number, chunkZ: number): void {
    const key = `${chunkX},${chunkZ}`;
    const old = this.meshes.get(key);
    if (old) {
      this.scene.remove(old);
      old.geometry.dispose();
      this.meshes.delete(key);
    }

    const data = buildChunkMeshData(this.world, chunkX, chunkZ);
    if (data.indices.length === 0) {
      return;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(data.normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(data.uvs, 2));
    geometry.setIndex(data.indices);
    geometry.computeBoundingSphere();

    const mesh = new THREE.Mesh(geometry, this.material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.chunkKey = key;
    this.scene.add(mesh);
    this.meshes.set(key, mesh);
  }
}
