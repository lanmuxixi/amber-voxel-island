# Voxel Island Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished single-player desktop-browser voxel island where the player can explore, jump, place and remove blocks, and automatically restore progress after refresh.

**Architecture:** Use a client-only Vite application with a Three.js render loop and DOM HUD. Keep deterministic generation, block storage, meshing, physics, persistence, and interaction in focused modules with pure boundaries so core behavior is testable without WebGL.

**Tech Stack:** TypeScript 5.9, Vite 7, Three.js r180, Vitest 3, Playwright 1.55, browser `localStorage`

## Global Constraints

- Target desktop browsers with keyboard and mouse only.
- Generate one finite island; do not implement infinite streaming.
- Use original procedural textures, colors, sounds, names, and interface assets.
- Exclude survival, crafting, enemies, combat, multiplayer, mobile controls, gamepads, and a day-night cycle.
- Save a versioned seed, player state, selected slot, and block delta; never save the complete generated world.
- Use exposed-face chunk meshes, never one Three.js mesh per world block.
- Keep one animation-frame owner and keep synchronous storage writes out of the frame loop.
- Resetting clears edits and player state but regenerates the same seed.

---

## Planned File Structure

```text
index.html
package.json
playwright.config.ts
tsconfig.json
vite.config.ts
src/
  main.ts
  styles.css
  game/config.ts
  game/Game.ts
  world/blocks.ts
  world/coords.ts
  world/terrain.ts
  world/World.ts
  world/mesh.ts
  world/atlas.ts
  world/ChunkRenderer.ts
  player/physics.ts
  player/PlayerController.ts
  interaction/hitCoordinates.ts
  interaction/BlockInteraction.ts
  inventory/Inventory.ts
  persistence/SaveStore.ts
  effects/BlockEffects.ts
  ui/Hud.ts
tests/*.test.ts
e2e/game.spec.ts
```

## Task 1: Project Shell and Test Harness

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`
- Create: `src/game/config.ts`, `src/main.ts`, `src/styles.css`
- Create: `tests/config.test.ts`
- Modify: `.gitignore`

**Interfaces:**
- Produces: `GAME_CONFIG: Readonly<GameConfig>`.
- Produces: `#game-canvas` and `#hud-root` browser elements.

- [ ] **Step 1: Add project configuration**

Create `package.json`:

```json
{
  "name": "amber-voxel-island",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test"
  },
  "dependencies": { "three": "^0.180.0" },
  "devDependencies": {
    "@playwright/test": "^1.55.0",
    "typescript": "^5.9.2",
    "vite": "^7.1.4",
    "vitest": "^3.2.4"
  }
}
```

Create `tsconfig.json` with `target: ES2022`, `module: ESNext`, `moduleResolution: Bundler`, DOM libraries, `strict: true`, `noUncheckedIndexedAccess: true`, `noEmit: true`, and types `vite/client` plus `vitest/globals`. Create `vite.config.ts` with `defineConfig({ test: { environment: 'node', include: ['tests/**/*.test.ts'] } })`. Append `playwright-report/` and `test-results/` to `.gitignore`.

- [ ] **Step 2: Install dependencies**

Run: `npm install`

Expected: exit `0` and a new `package-lock.json`.

- [ ] **Step 3: Write the failing configuration test**

Create `tests/config.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { GAME_CONFIG } from '../src/game/config';

describe('GAME_CONFIG', () => {
  it('uses compatible dimensions', () => {
    expect(GAME_CONFIG.worldDiameter % GAME_CONFIG.chunkSize).toBe(0);
    expect(GAME_CONFIG.worldHeight).toBeGreaterThan(GAME_CONFIG.maxTerrainHeight);
  });
  it('fits the player through a block-wide corridor', () => {
    expect(GAME_CONFIG.playerRadius * 2).toBeLessThan(1);
    expect(GAME_CONFIG.playerHeight).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 4: Verify the test fails**

Run: `npm test -- tests/config.test.ts`

Expected: FAIL because `src/game/config.ts` is missing.

- [ ] **Step 5: Implement the game constants and shell**

Create `src/game/config.ts`:

```ts
export const GAME_CONFIG = Object.freeze({
  chunkSize: 16,
  worldDiameter: 64,
  worldHeight: 32,
  maxTerrainHeight: 16,
  playerRadius: 0.32,
  playerHeight: 1.8,
  eyeHeight: 1.62,
  walkSpeed: 5.4,
  jumpSpeed: 7.2,
  gravity: 20,
  interactionDistance: 6,
  chunkRebuildsPerFrame: 2,
});
export type GameConfig = typeof GAME_CONFIG;
```

Create `index.html` with a `canvas#game-canvas`, `div#hud-root`, title `琥珀群岛`, and module script `/src/main.ts`. Create `src/main.ts` to import `styles.css`, require both elements, and render `正在生成琥珀群岛...` into the HUD. Create `src/styles.css` with a full-viewport canvas, fixed pointer-event-free HUD layer, amber-to-purple body gradient, and centered translucent boot card.

- [ ] **Step 6: Verify and commit**

Run: `npm test -- tests/config.test.ts`

Expected: 2 tests pass.

Run: `npm run build`

Expected: TypeScript and Vite succeed.

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts index.html src tests/config.test.ts .gitignore
git commit -m "chore: scaffold voxel island app"
```

## Task 2: Deterministic World Model

**Files:**
- Create: `src/world/blocks.ts`, `src/world/coords.ts`, `src/world/terrain.ts`, `src/world/World.ts`
- Create: `tests/coords.test.ts`, `tests/terrain.test.ts`, `tests/world.test.ts`

**Interfaces:**
- Produces: `BlockId`, `BLOCKS`, `HOTBAR_BLOCKS`, `Vec3i`, `blockKey()`, `worldToChunk()`.
- Produces: `generateIsland(seed): GeneratedIsland`.
- Produces: `World.getBlock()`, `World.setBlock()`, `World.applyDelta()`, `World.getDelta()`.

- [ ] **Step 1: Write failing coordinate and world tests**

Test these exact cases:

```ts
expect(worldToChunk({ x: 15, y: 3, z: 15 })).toEqual({ chunkX: 0, chunkZ: 0, localX: 15, localZ: 15 });
expect(worldToChunk({ x: 16, y: 3, z: 16 })).toEqual({ chunkX: 1, chunkZ: 1, localX: 0, localZ: 0 });
expect(worldToChunk({ x: -1, y: 3, z: -1 })).toEqual({ chunkX: -1, chunkZ: -1, localX: 15, localZ: 15 });
expect(blockKey({ x: -2, y: 7, z: 9 })).toBe('-2,7,9');
```

In `tests/terrain.test.ts`, assert two `generateIsland(9137)` results have identical entries and spawn, `0,0,0` is foundation, `31,1,31` is air, and spawn stands above a solid block. In `tests/world.test.ts`, remove a block, assert one delta entry, restore its original value, assert the delta is empty, and assert changing `y = 0` returns `false`.

- [ ] **Step 2: Verify missing modules fail**

Run: `npm test -- tests/coords.test.ts tests/terrain.test.ts tests/world.test.ts`

Expected: FAIL with unresolved `src/world` imports.

- [ ] **Step 3: Define blocks and coordinates**

Use these block IDs in `src/world/blocks.ts`:

```ts
export enum BlockId { Air, Grass, Dirt, Stone, Sand, Wood, Leaves, Foundation }
export interface BlockDefinition {
  id: BlockId; label: string; color: string; opaque: boolean; breakable: boolean; atlasTile: number;
}
```

Define `BLOCKS` for `空气`, `暮草`, `赭土`, `暗石`, `霞砂`, `暮木`, `灰叶`, and `基岩`. Air is transparent; foundation is not breakable; all others are opaque and breakable. Assign atlas tiles `0..6`. Define the nine-slot array as `[Grass, Dirt, Stone, Sand, Wood, Leaves, null, null, null]`.

Create `src/world/coords.ts`:

```ts
export interface Vec3i { x: number; y: number; z: number }
export function blockKey({ x, y, z }: Vec3i): string { return `${x},${y},${z}`; }
export function worldToChunk({ x, z }: Vec3i) {
  const size = GAME_CONFIG.chunkSize;
  const chunkX = Math.floor(x / size);
  const chunkZ = Math.floor(z / size);
  return { chunkX, chunkZ, localX: x - chunkX * size, localZ: z - chunkZ * size };
}
```

- [ ] **Step 4: Implement deterministic terrain**

In `src/world/terrain.ts`, implement `hash2(seed, x, z)` with integer multiplication and XOR, returning a normalized unsigned value. `generateIsland(seed)` iterates `x,z` from `-32` to `31`, computes radial falloff from the center, and chooses a surface height clamped to `1..16`. Fill `y = 0` with foundation, the top with sand when height is at most 4 or grass otherwise, the next three layers with dirt, and deeper layers with stone. Skip columns with height 1 so the square corners remain air.

Use this deterministic tree condition:

```ts
const hasTree = height >= 6
  && Math.hypot(x, z) < 27
  && hash2(seed ^ 0x68bc21eb, x, z) >= 0.985;
```

For each tree, add a three-block wood trunk and leaves within offsets `dx,dz = -2..2`, `dy = 2..4` where `abs(dx) + abs(dz) + abs(dy - 3) <= 4`. Skip leaf writes at `dx === 0 && dz === 0 && dy <= 3` so foliage does not overwrite the trunk. Return spawn `{ x: 0.5, y: surfaceHeight(seed, 0, 0) + 1.01, z: 0.5 }`.

- [ ] **Step 5: Implement mutable world state**

Create `World` with a cloned immutable base map, mutable block map, and delta map keyed by `blockKey`. `getBlock()` returns air outside `0 <= y < worldHeight`. `setBlock()` rejects non-integer coordinates, `y <= 0`, `y >= worldHeight`, unknown IDs, and foundation. It deletes air from the mutable map, writes non-air blocks, and removes the delta entry whenever the new value equals the generated base value.

Use this public contract:

```ts
export type BlockDeltaEntry = [x: number, y: number, z: number, block: BlockId];
export interface WorldReader { getBlock(position: Vec3i): BlockId }
export class World implements WorldReader {
  constructor(baseBlocks: ReadonlyMap<string, BlockId>);
  getBlock(position: Vec3i): BlockId;
  isSolid(position: Vec3i): boolean;
  setBlock(position: Vec3i, block: BlockId): boolean;
  applyDelta(entries: readonly BlockDeltaEntry[]): void;
  getDelta(): BlockDeltaEntry[];
}
```

Return `getDelta()` entries sorted by their string key for deterministic saves.

- [ ] **Step 6: Verify and commit**

Run: `npm test -- tests/coords.test.ts tests/terrain.test.ts tests/world.test.ts`

Expected: all world-domain tests pass.

```bash
git add src/world tests/coords.test.ts tests/terrain.test.ts tests/world.test.ts
git commit -m "feat: add deterministic voxel world"
```

## Task 3: Versioned Browser Persistence

**Files:**
- Create: `src/persistence/SaveStore.ts`
- Create: `tests/save-store.test.ts`

**Interfaces:**
- Consumes: `BlockDeltaEntry`.
- Produces: `SaveDataV1`, `SaveLoadResult`, `decodeSave()`, `SaveStore.load()`, `schedule()`, `flush()`, `reset()`.

- [ ] **Step 1: Write failing persistence tests**

Use this valid fixture:

```ts
const validSave: SaveDataV1 = {
  version: 1,
  seed: 42,
  player: { x: 1, y: 8, z: 2, yaw: 0.4, pitch: -0.1 },
  selectedSlot: 2,
  changes: [[1, 2, 3, BlockId.Stone]],
};
```

Assert `decodeSave(JSON.stringify(validSave))` round-trips. Assert `not json`, `{}`, version 2, non-finite player values, slots outside `0..8`, unknown block IDs, and foundation changes return `null`. Assert `load()` returns `{ data: null, issue: 'invalid' }` for corrupt stored text and `{ data: null, issue: 'unavailable' }` when `getItem()` throws. With fake timers, schedule two saves within 100 ms and assert storage receives only the newer snapshot. Make `setItem()` throw, call `flush()` twice, assert both calls return `false`, and assert the optional failure callback runs exactly once.

- [ ] **Step 2: Verify the test fails**

Run: `npm test -- tests/save-store.test.ts`

Expected: FAIL because the persistence module is missing.

- [ ] **Step 3: Implement the schema and store**

Create `src/persistence/SaveStore.ts`:

```ts
export interface SaveDataV1 {
  version: 1;
  seed: number;
  player: { x: number; y: number; z: number; yaw: number; pitch: number };
  selectedSlot: number;
  changes: BlockDeltaEntry[];
}

type StoragePort = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
export interface SaveLoadResult {
  data: SaveDataV1 | null;
  issue: 'invalid' | 'unavailable' | null;
}

export function decodeSave(raw: string | null): SaveDataV1 | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') return null;
    const save = value as Record<string, unknown>;
    const player = save.player as Record<string, unknown> | undefined;
    const finite = (item: unknown): item is number => typeof item === 'number' && Number.isFinite(item);
    if (save.version !== 1 || !Number.isInteger(save.seed) || !player) return null;
    if (![player.x, player.y, player.z, player.yaw, player.pitch].every(finite)) return null;
    if (!Number.isInteger(save.selectedSlot) || Number(save.selectedSlot) < 0 || Number(save.selectedSlot) > 8) return null;
    if (!Array.isArray(save.changes)) return null;
    const changes: BlockDeltaEntry[] = [];
    for (const entry of save.changes) {
      if (!Array.isArray(entry) || entry.length !== 4 || !entry.every(Number.isInteger)) return null;
      const [x, y, z, block] = entry;
      if (!(Number(block) in BLOCKS) || block === BlockId.Foundation) return null;
      changes.push([Number(x), Number(y), Number(z), Number(block) as BlockId]);
    }
    return { version: 1, seed: Number(save.seed), player: player as SaveDataV1['player'], selectedSlot: Number(save.selectedSlot), changes };
  } catch { return null; }
}

export class SaveStore {
  private pending: SaveDataV1 | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private writeFailureReported = false;
  constructor(
    private storage: StoragePort,
    private key = 'amber-voxel-island:v1',
    private delayMs = 250,
    private onWriteFailure: () => void = () => undefined,
  ) {}
  load(): SaveLoadResult {
    try {
      const raw = this.storage.getItem(this.key);
      const data = decodeSave(raw);
      return { data, issue: raw !== null && data === null ? 'invalid' : null };
    } catch { return { data: null, issue: 'unavailable' }; }
  }
  schedule(snapshot: SaveDataV1): void {
    this.pending = structuredClone(snapshot);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), this.delayMs);
  }
  flush(): boolean {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (!this.pending) return true;
    try { this.storage.setItem(this.key, JSON.stringify(this.pending)); this.pending = null; return true; }
    catch {
      if (!this.writeFailureReported) this.onWriteFailure();
      this.writeFailureReported = true;
      return false;
    }
  }
  reset(): boolean {
    this.pending = null;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    try { this.storage.removeItem(this.key); return true; } catch { return false; }
  }
}
```

- [ ] **Step 4: Verify and commit**

Run: `npm test -- tests/save-store.test.ts`

Expected: all persistence tests pass.

```bash
git add src/persistence/SaveStore.ts tests/save-store.test.ts
git commit -m "feat: persist versioned world changes"
```

## Task 4: Exposed-Face Chunk Rendering

**Files:**
- Create: `src/world/mesh.ts`, `src/world/atlas.ts`, `src/world/ChunkRenderer.ts`
- Create: `tests/mesh.test.ts`

**Interfaces:**
- Consumes: `WorldReader`, `BlockId`, `BLOCKS`, `GAME_CONFIG`.
- Produces: `buildChunkMeshData(world, chunkX, chunkZ): MeshData`.
- Produces: `createBlockAtlas(): THREE.CanvasTexture`.
- Produces: `ChunkRenderer.buildAll()`, `markBlockDirty()`, `rebuildPending()`, `getMeshes()`, `dispose()`.

- [ ] **Step 1: Write failing exposed-face tests**

Create `tests/mesh.test.ts` with an in-memory `WorldReader`. Assert an isolated stone block produces 6 faces and 36 indices. Place blocks at `(15,1,0)` and `(16,1,0)`, build chunk `(0,0)`, and assert the first block produces 5 faces and 30 indices because the cross-chunk neighbor occludes one face. Also test `tileColorWithLightness('#000000', -20) === '#000000'` and `tileColorWithLightness('#ffffff', 20) === '#ffffff'`.

- [ ] **Step 2: Verify the mesh tests fail**

Run: `npm test -- tests/mesh.test.ts`

Expected: FAIL because mesh and atlas modules are missing.

- [ ] **Step 3: Implement the pure mesh-data builder**

Create `src/world/mesh.ts` with:

```ts
export interface MeshData {
  positions: number[];
  normals: number[];
  uvs: number[];
  indices: number[];
  blockFaces: number;
}

const FACES = [
  { n: [1,0,0], v: [[1,0,0],[1,1,0],[1,1,1],[1,0,1]] },
  { n: [-1,0,0], v: [[0,0,1],[0,1,1],[0,1,0],[0,0,0]] },
  { n: [0,1,0], v: [[0,1,1],[1,1,1],[1,1,0],[0,1,0]] },
  { n: [0,-1,0], v: [[0,0,0],[1,0,0],[1,0,1],[0,0,1]] },
  { n: [0,0,1], v: [[1,0,1],[1,1,1],[0,1,1],[0,0,1]] },
  { n: [0,0,-1], v: [[0,0,0],[0,1,0],[1,1,0],[1,0,0]] },
] as const;
```

`buildChunkMeshData()` loops local `x,z = 0..15` and `y = 0..31`. Skip air. For each face, query the neighboring world coordinate and skip it when `BLOCKS[neighbor].opaque` is true. Append four world-space vertices, four normals, atlas UVs, and indices `[base, base+1, base+2, base, base+2, base+3]`. Atlas UVs use a `3 x 3` grid and a `0.002` inset to prevent texture bleeding.

- [ ] **Step 4: Implement the original procedural atlas**

Create `src/world/atlas.ts`. `createBlockAtlas(documentPort = document)` creates a `48 x 48` canvas. For every non-air block, fill its `16 x 16` tile from `BLOCKS[id].color`, then draw 48 deterministic one-pixel flecks using a `mulberry32(id * 9973)` generator and lightness changes within `-12..12`. Set:

```ts
texture.magFilter = THREE.NearestFilter;
texture.minFilter = THREE.NearestMipmapLinearFilter;
texture.colorSpace = THREE.SRGBColorSpace;
texture.generateMipmaps = true;
```

Export `tileColorWithLightness(hex, delta)`; parse six-digit hex input, clamp RGB channels to `0..255`, and return a six-digit lowercase hex color.

- [ ] **Step 5: Implement chunk mesh lifecycle**

Create `ChunkRenderer` with one shared `MeshLambertMaterial({ map: atlas, alphaTest: 0.5 })`, a `Map<string, THREE.Mesh>`, and an insertion-ordered dirty `Set<string>`. Use this rebuild core:

```ts
private rebuildChunk(chunkX: number, chunkZ: number): void {
  const key = `${chunkX},${chunkZ}`;
  const old = this.meshes.get(key);
  if (old) { this.scene.remove(old); old.geometry.dispose(); this.meshes.delete(key); }
  const data = buildChunkMeshData(this.world, chunkX, chunkZ);
  if (data.indices.length === 0) return;
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
```

`buildAll()` rebuilds chunk coordinates `-2..1` on both axes. `markBlockDirty()` queues the owning chunk and a neighbor when local `x` or `z` equals `0` or `15`. `rebuildPending()` consumes at most `limit ?? GAME_CONFIG.chunkRebuildsPerFrame`. `dispose()` removes meshes, disposes each geometry, then disposes the shared material and atlas.

- [ ] **Step 6: Verify and commit**

Run: `npm test -- tests/mesh.test.ts`

Expected: face-culling and atlas-color tests pass.

Run: `npm run build`

Expected: strict compilation passes.

```bash
git add src/world/mesh.ts src/world/atlas.ts src/world/ChunkRenderer.ts tests/mesh.test.ts
git commit -m "feat: render exposed voxel chunk faces"
```

## Task 5: Player Physics and Pointer Lock

**Files:**
- Create: `src/player/physics.ts`, `src/player/PlayerController.ts`
- Create: `tests/physics.test.ts`

**Interfaces:**
- Consumes: `WorldReader`, `GAME_CONFIG`, `THREE.PerspectiveCamera`.
- Produces: `PlayerState`, `PlayerInput`, `stepPlayer()`, `playerOverlapsBlock()`, `PlayerController`.

- [ ] **Step 1: Write failing movement tests**

Build a flat in-memory world with blocks at `y = 0`. Advance a falling player for 120 frames at `1/60` seconds and assert it stops with feet in `1.0..1.01` and `grounded === true`. Assert a player moving right toward a block at `(1,1,0)` never advances beyond `x = 0.68`, a grounded jump produces positive vertical velocity, a second airborne jump does not reset that velocity, and `playerOverlapsBlock()` detects a block intersecting the body.

Use this shared state:

```ts
const resting: PlayerState = {
  position: { x: 0.5, y: 1.001, z: 0.5 },
  velocity: { x: 0, y: 0, z: 0 },
  yaw: 0,
  pitch: 0,
  grounded: true,
};
```

- [ ] **Step 2: Verify the physics tests fail**

Run: `npm test -- tests/physics.test.ts`

Expected: FAIL because the player modules are missing.

- [ ] **Step 3: Implement axis-separated voxel collision**

Create these public types in `src/player/physics.ts`:

```ts
export interface Vec3 { x: number; y: number; z: number }
export interface PlayerState {
  position: Vec3;
  velocity: Vec3;
  yaw: number;
  pitch: number;
  grounded: boolean;
}
export interface PlayerInput { forward: number; right: number; jump: boolean }
```

`stepPlayer(world, previous, input, rawDt)` clones state, clamps `dt` to `0.05`, normalizes the two movement axes, rotates movement by yaw, applies `walkSpeed`, applies `jumpSpeed` only if grounded, subtracts gravity, and moves X, Z, then Y. Each axis is divided into increments no larger than `0.2`; after an overlapping increment, reverse it, zero that velocity component, and mark grounded only for downward Y collisions.

The overlap bounds are:

```ts
minX = floor(position.x - playerRadius)
maxX = floor(position.x + playerRadius)
minY = floor(position.y)
maxY = floor(position.y + playerHeight - 0.001)
minZ = floor(position.z - playerRadius)
maxZ = floor(position.z + playerRadius)
```

`playerOverlapsBlock()` performs strict AABB intersection between those player bounds and `[x,x+1] x [y,y+1] x [z,z+1]`.

- [ ] **Step 4: Implement the browser controller**

Create `PlayerController` with this API:

```ts
export class PlayerController {
  constructor(canvas: HTMLCanvasElement, camera: THREE.PerspectiveCamera, world: WorldReader, initial: PlayerState);
  update(deltaSeconds: number): void;
  getState(): PlayerState;
  setState(state: PlayerState): void;
  isLocked(): boolean;
  requestLock(): void;
  dispose(): void;
}
```

Track `KeyW`, `KeyA`, `KeyS`, `KeyD`, and `Space` in a `Set`. While pointer lock belongs to the canvas, subtract `movementX * 0.0022` from yaw and `movementY * 0.0022` from pitch, clamped just inside `+-PI/2`. `update()` calls `stepPlayer()`, moves the camera to `feetY + eyeHeight`, sets rotation order `YXZ`, and applies pitch/yaw. Define event handlers as class fields so `dispose()` removes the same function references.

- [ ] **Step 5: Verify and commit**

Run: `npm test -- tests/physics.test.ts`

Expected: movement, collision, jump, and overlap tests pass.

Run: `npm run build`

Expected: strict compilation passes.

```bash
git add src/player tests/physics.test.ts
git commit -m "feat: add voxel player movement and collision"
```

## Task 6: Inventory, Targeting, and HUD

**Files:**
- Create: `src/inventory/Inventory.ts`
- Create: `src/interaction/hitCoordinates.ts`, `src/interaction/BlockInteraction.ts`
- Create: `src/ui/Hud.ts`
- Create: `tests/inventory.test.ts`, `tests/hit-coordinates.test.ts`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `HOTBAR_BLOCKS`, `World`, `ChunkRenderer`, player state, and chunk meshes.
- Produces: `Inventory.select()`, `cycle()`, `selectedBlock`.
- Produces: `hitToEditCoordinates()` and `BlockInteraction.update()`.
- Produces: `Hud.renderHotbar()`, `setPaused()`, `notice()`, `confirmReset()`.

- [ ] **Step 1: Write failing inventory and hit-coordinate tests**

Assert selecting slot `2` chooses stone, selecting empty slot `8` returns false without changing selection, and cycling backward from slot `0` selects leaves. For a hit at `{ x: 2, y: 3.4, z: 4.8 }` with normal `{ x: 1, y: 0, z: 0 }`, assert remove maps to `{ x: 1, y: 3, z: 4 }` and place maps to `{ x: 2, y: 3, z: 4 }`.

- [ ] **Step 2: Verify the tests fail**

Run: `npm test -- tests/inventory.test.ts tests/hit-coordinates.test.ts`

Expected: FAIL because the modules are missing.

- [ ] **Step 3: Implement inventory and ray-hit conversion**

Create `Inventory` so `select(index)` accepts only populated slots and `cycle(direction)` wraps until it finds a populated slot. Its `selectedBlock` getter returns the non-null block at `selectedIndex`.

Create `hitToEditCoordinates(point, normal, mode)` using epsilon `0.001`:

```ts
const sign = mode === 'place' ? 1 : -1;
return {
  x: Math.floor(point.x + normal.x * epsilon * sign),
  y: Math.floor(point.y + normal.y * epsilon * sign),
  z: Math.floor(point.z + normal.z * epsilon * sign),
};
```

- [ ] **Step 4: Implement block targeting and edit commands**

Create `BlockInteraction` with one `THREE.Raycaster`, one center-screen vector `(0,0)`, and one `BoxGeometry(1.006, 1.006, 1.006)` line outline using pale gold `#ffe3a3`. `update(meshes)` selects the nearest hit within `interactionDistance`, derives remove/place coordinates with `hitToEditCoordinates()`, moves the outline to the target block center, and hides it when no hit exists.

Expose callbacks rather than mutating the world internally:

```ts
export interface BlockInteractionCallbacks {
  remove(position: Vec3i): void;
  place(position: Vec3i): void;
}
export class BlockInteraction {
  constructor(camera: THREE.Camera, scene: THREE.Scene, canvas: HTMLCanvasElement, callbacks: BlockInteractionCallbacks);
  update(meshes: readonly THREE.Mesh[]): void;
  dispose(): void;
}
```

Handle `mousedown`: button `0` invokes remove coordinates and button `2` invokes place coordinates only while pointer lock is active. Prevent the canvas context menu.

- [ ] **Step 5: Implement the HUD and styling**

`Hud` builds semantic DOM once and updates text/classes without replacing the root. Required elements are `.crosshair`, `.hotbar` with nine `.hotbar-slot` buttons, `.onboarding`, `.pause-menu`, `.notice`, and a native `<dialog>` reset confirmation. Use these methods:

```ts
constructor(root: HTMLElement, actions: { onResume(): void; onReset(): void });
renderHotbar(selectedIndex: number): void;
setPaused(paused: boolean, firstVisit: boolean): void;
dismissOnboarding(): void;
notice(message: string, persistent?: boolean): void;
confirmReset(): Promise<boolean>;
dispose(): void;
```

Style the HUD with pale gold accents, dark translucent panels, `backdrop-filter: blur(12px)`, bottom-centered hotbar, a thin central crosshair, visible keyboard focus states, and `pointer-events: auto` only for menus and dialog. The onboarding copy must name all controls and say `点击进入琥珀群岛`.

- [ ] **Step 6: Verify and commit**

Run: `npm test -- tests/inventory.test.ts tests/hit-coordinates.test.ts`

Expected: inventory and hit-coordinate tests pass.

Run: `npm run build`

Expected: strict compilation and CSS bundling pass.

```bash
git add src/inventory src/interaction src/ui src/styles.css tests/inventory.test.ts tests/hit-coordinates.test.ts
git commit -m "feat: add block targeting and creative hotbar"
```

## Task 7: Compose the Playable Game

**Files:**
- Create: `src/game/Game.ts`
- Modify: `src/main.ts`, `src/ui/Hud.ts`, `src/world/ChunkRenderer.ts`

**Interfaces:**
- Consumes every module from Tasks 1 through 6.
- Produces: `new Game(canvas, hudRoot)`, `Game.start()`, `Game.dispose()`.
- Produces in `?e2e=1` mode: `window.__VOXEL_TEST__.snapshot()` for deterministic browser assertions.

- [ ] **Step 1: Add an integration smoke test before composition**

Add `tests/game-contract.test.ts` importing the game class and asserting the prototype has `start` and `dispose` functions:

```ts
import { describe, expect, it } from 'vitest';
import { Game } from '../src/game/Game';

describe('Game contract', () => {
  it('owns start and dispose lifecycle methods', () => {
    expect(typeof Game.prototype.start).toBe('function');
    expect(typeof Game.prototype.dispose).toBe('function');
  });
});
```

- [ ] **Step 2: Verify the integration test fails**

Run: `npm test -- tests/game-contract.test.ts`

Expected: FAIL because `Game.ts` is missing.

- [ ] **Step 3: Implement startup and module composition**

Create `src/game/Game.ts`. The constructor must perform these actions in order:

1. Create `Hud(root, { onResume, onReset })`. The callbacks are closures that call the player and reset routine after those fields are assigned.
2. Create `SaveStore(localStorage, 'amber-voxel-island:v1', 250, onWriteFailure)`; the callback calls `hud.notice('浏览器存储不可用，本次进度可能无法保留。', true)`.
3. Load `SaveLoadResult`. Use `result.data?.seed` or generate `crypto.getRandomValues(new Uint32Array(1))[0]`.
4. Generate the island, construct `World`, and apply valid saved changes.
5. Create `WebGLRenderer({ canvas, antialias: true, alpha: true })`, set pixel ratio to `min(devicePixelRatio, 2)`, enable `PCFSoftShadowMap`, and use output color space `SRGBColorSpace`.
6. Create the scene with fog `new THREE.Fog('#8a6f82', 26, 78)`, a perspective camera with near `0.05` and far `120`, the atlas, and `ChunkRenderer`; then call `buildAll()`. Add a neutral `HemisphereLight('#ffffff', '#777777', 1.2)` so this task remains visually testable before Task 8 replaces it.
7. Create `Inventory`, `PlayerController`, and `BlockInteraction`. Construct inventory at slot 0, then call `select(result.data?.selectedSlot ?? 0)` so an empty saved slot falls back safely.
8. Restore the saved player only when all values are finite and the feet/body do not overlap blocks. Otherwise use generated spawn with yaw `0` and pitch `-0.35`.
9. Add resize, pointer-lock-change, visibility-change, and before-unload listeners.
10. If the load result says data was invalid, display `旧存档无法读取，已创建新岛屿。`. If storage was unavailable, display `浏览器存储不可用，本次进度可能无法保留。` persistently.

Use this state snapshot method:

```ts
private createSave(): SaveDataV1 {
  const player = this.player.getState();
  return {
    version: 1,
    seed: this.seed,
    player: {
      x: player.position.x,
      y: player.position.y,
      z: player.position.z,
      yaw: player.yaw,
      pitch: player.pitch,
    },
    selectedSlot: this.inventory.selectedIndex,
    changes: this.world.getDelta(),
  };
}
```

- [ ] **Step 4: Wire block edits with validation**

Removal callback:

```ts
const block = this.world.getBlock(position);
if (block === BlockId.Air || !BLOCKS[block].breakable) return;
if (!this.world.setBlock(position, BlockId.Air)) return;
this.chunks.markBlockDirty(position);
this.queueSave();
```

Placement callback:

```ts
if (this.world.getBlock(position) !== BlockId.Air) return;
if (playerOverlapsBlock(this.player.getState(), position)) {
  this.hud.notice('这里会挡住你');
  return;
}
if (!this.world.setBlock(position, this.inventory.selectedBlock)) return;
this.chunks.markBlockDirty(position);
this.queueSave();
```

Number keys select slots `0..8`; wheel direction calls `inventory.cycle()`. After selection, update the HUD and queue a save.

- [ ] **Step 5: Implement pause, reset, and the sole frame loop**

Clicking onboarding or Resume calls `player.requestLock()`. Pointer-lock change calls `hud.setPaused(!player.isLocked(), firstVisit)`. Escape relies on the browser to release pointer lock.

Reset must run:

```ts
if (await this.hud.confirmReset()) {
  this.saveStore.reset();
  this.world = new World(generateIsland(this.seed).blocks);
  this.player.setState(this.spawnState());
  this.inventory.select(0);
  this.chunks.replaceWorld(this.world);
  this.saveStore.schedule(this.createSave());
  this.saveStore.flush();
  this.hud.renderHotbar(this.inventory.selectedIndex);
}
```

Add `replaceWorld(world)` to `ChunkRenderer`; it updates the world reference, disposes current geometries, clears dirty work, and calls `buildAll()`. `BlockInteraction` needs no world replacement because it communicates only through edit callbacks and the current chunk-mesh list.

`start()` records `performance.now()` and requests the first frame. The frame callback calculates capped delta time, updates the player only while pointer lock is active, calls `hud.dismissOnboarding()` once horizontal displacement exceeds `0.03`, restores spawn if feet fall below `-10`, updates targeting, rebuilds pending chunks, and renders. Accumulate active play time and schedule a player-state save every second. Only this callback schedules the next animation frame.

`dispose()` cancels the frame, flushes the save, removes every window/document listener, and disposes interaction, controller, chunks, renderer, and HUD.

- [ ] **Step 6: Replace the boot placeholder with game startup**

Modify `src/main.ts`:

```ts
import './styles.css';
import { Game } from './game/Game';

const canvas = document.querySelector<HTMLCanvasElement>('#game-canvas');
const hudRoot = document.querySelector<HTMLElement>('#hud-root');
if (!canvas || !hudRoot) throw new Error('Game shell is missing required DOM elements.');

const game = new Game(canvas, hudRoot);
game.start();
window.addEventListener('pagehide', () => game.dispose(), { once: true });
```

When `location.search` contains `e2e=1`, expose a read-only snapshot containing player position, selected slot, delta length, pointer-lock state, pause state, and current target. Do not expose mutation commands.

- [ ] **Step 7: Verify and commit**

Run: `npm test -- tests/game-contract.test.ts`

Expected: game lifecycle contract passes.

Run: `npm run build`

Expected: complete app compiles and bundles.

Run: `npm run dev -- --host 127.0.0.1`

Expected: Vite prints a local URL; opening it shows the onboarding overlay over a rendered island with no console errors.

```bash
git add src/game/Game.ts src/main.ts src/ui/Hud.ts src/world/ChunkRenderer.ts tests/game-contract.test.ts
git commit -m "feat: compose playable voxel sandbox"
```

## Task 8: Amber Dusk Lighting and Block Feedback

**Files:**
- Create: `src/effects/BlockEffects.ts`
- Modify: `src/game/Game.ts`, `src/styles.css`
- Create: `tests/block-effects.test.ts`

**Interfaces:**
- Consumes: block positions, `BlockId`, `BLOCKS`, scene, camera.
- Produces: `BlockEffects.remove()`, `place()`, `update()`, `dispose()`.

- [ ] **Step 1: Add deterministic effect-pool tests**

Create `tests/block-effects.test.ts` around an exported pure `ParticlePool` helper. Initialize capacity `24`, acquire 24 entries, assert the next acquire reuses index `0`, release index `3`, and assert the next acquire returns index `3`. Advance an entry past its duration and assert `active` becomes false.

- [ ] **Step 2: Verify the effect test fails**

Run: `npm test -- tests/block-effects.test.ts`

Expected: FAIL because the effects module is missing.

- [ ] **Step 3: Implement pooled particles and place animation**

Create `BlockEffects` with one `THREE.InstancedMesh` of 24 cubes using `BoxGeometry(0.09, 0.09, 0.09)` and vertex colors. `remove(position, block)` activates six particles at the block center, colors them from `BLOCKS[block].color`, and gives each deterministic radial velocity derived from particle index. Gravity is `12`; lifetime is `0.45` seconds. `update(dt)` advances active particles, expires them, and writes hidden instances with scale zero.

`place(position, block)` creates one temporary mesh using a shared unit box and a transparent material colored from the block. Scale it from `0.72` to `1.0` over `0.12` seconds, then remove it. Keep at most four place animations; reuse the oldest when full.

Create a lazy Web Audio context after the first mouse edit. Removal uses a sine oscillator falling from `130 Hz` to `75 Hz` over `0.08` seconds through a gain falling from `0.035` to zero. Placement uses a triangle oscillator falling from `180 Hz` to `120 Hz` over `0.055` seconds. No audio files are added.

Modify `Game` to construct `BlockEffects` after the scene. Call `effects.remove(position, block)` after successful removal and `effects.place(position, selectedBlock)` after successful placement. Call `effects.update(dt)` before rendering each frame and `effects.dispose()` during game disposal.

- [ ] **Step 4: Apply the approved lighting and atmosphere**

In `Game`, add:

```ts
const ambient = new THREE.HemisphereLight('#c6b3d5', '#694735', 1.35);
const sun = new THREE.DirectionalLight('#ffd59c', 2.4);
sun.position.set(-28, 42, -18);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -42;
sun.shadow.camera.right = 42;
sun.shadow.camera.top = 42;
sun.shadow.camera.bottom = -42;
scene.add(ambient, sun);
```

Keep the renderer alpha-enabled so the CSS orange-to-gray-purple gradient is visible. Add a low-opacity radial glow at the horizon with `body::before`. Use a subtle `fade-in` animation for the HUD and a staggered `rise-in` animation for hotbar slots. Respect `@media (prefers-reduced-motion: reduce)` by disabling both.

- [ ] **Step 5: Verify visual behavior and commit**

Run: `npm test -- tests/block-effects.test.ts`

Expected: particle reuse and expiry tests pass.

Run: `npm run build`

Expected: production build passes.

Manual check: remove and place blocks rapidly for 30 seconds. Expected: particles expire, temporary place meshes disappear, audio remains quiet and short, shadows and fog preserve readable block faces.

```bash
git add src/effects src/game/Game.ts src/styles.css tests/block-effects.test.ts
git commit -m "feat: add amber dusk atmosphere and feedback"
```

## Task 9: Browser Acceptance, Persistence, and Documentation

**Files:**
- Create: `playwright.config.ts`, `e2e/game.spec.ts`, `README.md`
- Modify: `package.json`, `src/game/Game.ts`, `src/interaction/BlockInteraction.ts`, `src/ui/Hud.ts`

**Interfaces:**
- Consumes: the `?e2e=1` read-only snapshot from `Game`.
- Produces: reproducible browser acceptance tests and run instructions.

- [ ] **Step 1: Configure Playwright**

Create `playwright.config.ts`:

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:4173', viewport: { width: 1440, height: 900 } },
  webServer: {
    command: 'npm run build && npm run preview -- --host 127.0.0.1 --port 4173',
    port: 4173,
    reuseExistingServer: !process.env.CI,
  },
});
```

Add `"e2e:install": "playwright install chromium"` to package scripts.

- [ ] **Step 2: Write the failing browser path**

Create `e2e/game.spec.ts` with one serial test covering:

```ts
await page.goto('/?e2e=1');
await expect(page.getByText('点击进入琥珀群岛')).toBeVisible();
await page.getByText('点击进入琥珀群岛').click();
await expect.poll(() => page.evaluate(() => window.__VOXEL_TEST__?.snapshot().locked)).toBe(true);

const before = await page.evaluate(() => window.__VOXEL_TEST__!.snapshot().player);
await page.keyboard.down('KeyW');
await page.waitForTimeout(350);
await page.keyboard.up('KeyW');
const after = await page.evaluate(() => window.__VOXEL_TEST__!.snapshot().player);
expect(Math.hypot(after.x - before.x, after.z - before.z)).toBeGreaterThan(0.2);

await expect.poll(() => page.evaluate(() => window.__VOXEL_TEST__!.snapshot().target)).not.toBeNull();
await page.mouse.click(720, 450);
await expect.poll(() => page.evaluate(() => window.__VOXEL_TEST__!.snapshot().deltaLength)).toBeGreaterThan(0);

const savedDeltaLength = await page.evaluate(() => window.__VOXEL_TEST__!.snapshot().deltaLength);
await page.waitForTimeout(350);
await page.reload();
await expect.poll(() => page.evaluate(() => window.__VOXEL_TEST__!.snapshot().deltaLength)).toBe(savedDeltaLength);
```

Continue the same test by entering pointer lock again, right-clicking the center to place the selected block, pressing Escape, clicking `重置世界`, confirming the dialog, and asserting `deltaLength === 0` while the seed remains unchanged. Add a second test at `1024 x 768` asserting the hotbar and pause panel are inside the viewport.

- [ ] **Step 3: Run the browser test to expose integration gaps**

Run: `npm run e2e:install`

Expected: Chromium installs successfully.

Run: `npm run e2e`

Expected before fixes: FAIL at the first missing accessible label, state exposure, persistence timing, or reset behavior found by the full browser path.

- [ ] **Step 4: Close only the failures found by the browser path**

Add accessible names to onboarding, Resume, Reset, confirm, cancel, and hotbar controls. Add this global type beside `Game`:

```ts
declare global {
  interface Window {
    __VOXEL_TEST__?: {
      snapshot(): {
        player: { x: number; y: number; z: number };
        selectedSlot: number;
        deltaLength: number;
        seed: number;
        locked: boolean;
        paused: boolean;
        target: { x: number; y: number; z: number } | null;
      };
    };
  }
}
```

Expose it only when the query includes `e2e=1`, and delete it in `dispose()`. Make `BlockInteraction.getTarget()` return a cloned coordinate or null. Before reload or reset assertions, call `saveStore.flush()` from visibility/pagehide handling. Do not add mutation methods to the test API.

- [ ] **Step 5: Add operating documentation**

Create `README.md` with:

- Project summary and original-asset statement.
- Requirements: Node.js 20 or newer and npm 10 or newer.
- Commands: `npm install`, `npm run dev`, `npm test`, `npm run build`, `npm run e2e:install`, `npm run e2e`.
- Complete control list.
- Save location description and reset semantics.
- Explicit first-release exclusions copied from the design.

- [ ] **Step 6: Run the complete verification matrix**

Run: `npm test`

Expected: every unit test passes.

Run: `npm run build`

Expected: TypeScript and Vite production build pass with no errors.

Run: `npm run e2e`

Expected: movement, editing, refresh persistence, reset, and both viewport checks pass.

Run: `git status --short`

Expected: only Task 9 files are modified or untracked.

- [ ] **Step 7: Commit the accepted first release**

```bash
git add playwright.config.ts e2e/game.spec.ts README.md package.json package-lock.json src/game/Game.ts src/interaction/BlockInteraction.ts src/ui/Hud.ts
git commit -m "test: verify complete voxel island play path"
```

## Final Manual Acceptance

- [ ] Start with `npm run dev` and open the printed URL in a current desktop browser.
- [ ] Confirm the first frame shows the Amber Dusk gradient, fog, long warm shadows, original textured blocks, crosshair, and nine-slot hotbar.
- [ ] Confirm click-to-lock, mouse look, WASD, jump, collision, left-click removal, right-click placement, number keys, wheel selection, and Escape pause.
- [ ] Make edits on both sides of a chunk boundary and confirm no stale or missing faces remain.
- [ ] Refresh and confirm edits, selected slot, and a safe player position restore.
- [ ] Confirm reset requires confirmation, preserves the seed, clears edits, and returns the player to spawn.
- [ ] Simulate unavailable storage in DevTools and confirm play continues with one persistent warning.
- [ ] Play and edit rapidly for five minutes; confirm stable responsiveness and no continuing growth after particles expire.
