import { BlockEffects } from '../effects/BlockEffects';
import * as THREE from 'three';

import { BlockInteraction } from '../interaction/BlockInteraction';
import { Inventory } from '../inventory/Inventory';
import { PlayerController } from '../player/PlayerController';
import { playerOverlapsBlock, type PlayerState } from '../player/physics';
import { SaveStore, type SaveDataV1 } from '../persistence/SaveStore';
import { Hud } from '../ui/Hud';
import { BLOCKS, BlockId } from '../world/blocks';
import { ChunkRenderer } from '../world/ChunkRenderer';
import { generateIsland } from '../world/terrain';
import { World } from '../world/World';

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

export class Game {
  private readonly hud: Hud;

  private readonly saveStore: SaveStore;

  private readonly renderer: THREE.WebGLRenderer;

  private readonly scene: THREE.Scene;

  private readonly camera: THREE.PerspectiveCamera;

  private readonly inventory: Inventory;

  private readonly interaction: BlockInteraction;

  private readonly effects: BlockEffects;

  private readonly onResize = (): void => {
    const width = this.canvas.clientWidth || window.innerWidth;
    const height = this.canvas.clientHeight || window.innerHeight;
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  };

  private readonly onPointerLockChange = (): void => {
    this.hud.setPaused(!this.player.isLocked(), this.firstVisit);
  };

  private readonly onVisibilityChange = (): void => {
    if (document.hidden) {
      this.saveStore.flush();
    }
  };

  private readonly onBeforeUnload = (): void => {
    this.saveStore.flush();
  };

  private readonly onWheel = (event: WheelEvent): void => {
    if (event.deltaY === 0) {
      return;
    }
    this.inventory.cycle(event.deltaY > 0 ? 1 : -1);
    this.hud.renderHotbar(this.inventory.selectedIndex);
    this.queueSave();
  };

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (!/^Digit[1-9]$/.test(event.code)) {
      return;
    }
    const index = Number(event.code.slice(-1)) - 1;
    if (this.inventory.select(index)) {
      this.hud.renderHotbar(this.inventory.selectedIndex);
      this.queueSave();
    }
  };

  private world: World;

  private readonly player: PlayerController;

  private readonly chunks: ChunkRenderer;

  private readonly seed: number;

  private readonly initialSpawn: PlayerState;

  private frameHandle: number | null = null;

  private previousFrameTime = 0;

  private activeSaveTimer = 0;

  private firstVisit: boolean;

  private disposed = false;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    root: HTMLElement,
  ) {
    this.hud = new Hud(root, {
      onResume: () => this.player.requestLock(),
      onReset: () => {
        void this.resetWorld();
      },
    });
    this.saveStore = new SaveStore(localStorage, 'amber-voxel-island:v1', 250, () => {
      this.hud.notice('浏览器存储不可用，本次进度可能无法保留。', true);
    });

    const loadResult = this.saveStore.load();
    this.seed = loadResult.data?.seed ?? crypto.getRandomValues(new Uint32Array(1))[0]!;
    const island = generateIsland(this.seed);
    this.world = new World(island.blocks);
    if (loadResult.data) {
      this.world.applyDelta(loadResult.data.changes);
    }
    this.firstVisit = loadResult.data === null;

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog('#8a6f82', 26, 78);
    this.camera = new THREE.PerspectiveCamera(75, 1, 0.05, 120);
    this.effects = new BlockEffects(this.scene);

    this.chunks = new ChunkRenderer(this.scene, this.world);
    this.chunks.buildAll();

    const ambient = new THREE.HemisphereLight('#c6b3d5', '#694735', 1.35);
    const sun = new THREE.DirectionalLight('#ffd59c', 2.4);
    sun.position.set(-28, 42, -18);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.left = -42;
    sun.shadow.camera.right = 42;
    sun.shadow.camera.top = 42;
    sun.shadow.camera.bottom = -42;
    this.scene.add(ambient, sun);

    this.inventory = new Inventory(0);
    this.inventory.select(loadResult.data?.selectedSlot ?? 0);

    const restoredState = loadResult.data ? this.restoreSavedPlayer(loadResult.data) : null;
    this.initialSpawn = restoredState ?? this.spawnState();
    this.player = new PlayerController(this.canvas, this.camera, this.world, this.initialSpawn);

    this.interaction = new BlockInteraction(this.camera, this.scene, this.canvas, {
      remove: (position) => {
        const block = this.world.getBlock(position);
        if (block === BlockId.Air || !BLOCKS[block].breakable) {
          return;
        }
        if (!this.world.setBlock(position, BlockId.Air)) {
          return;
        }
        this.effects.remove(position, block);
        this.chunks.markBlockDirty(position);
        this.queueSave();
      },
      place: (position) => {
        if (this.world.getBlock(position) !== BlockId.Air) {
          return;
        }
        if (playerOverlapsBlock(this.player.getState(), position)) {
          this.hud.notice('这里会挡住你');
          return;
        }
        if (!this.world.setBlock(position, this.inventory.selectedBlock)) {
          return;
        }
        this.effects.place(position, this.inventory.selectedBlock);
        this.chunks.markBlockDirty(position);
        this.queueSave();
      },
    });

    this.hud.renderHotbar(this.inventory.selectedIndex);
    this.hud.setPaused(true, this.firstVisit);
    this.onResize();

    window.addEventListener('resize', this.onResize);
    window.addEventListener('wheel', this.onWheel, { passive: true });
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('beforeunload', this.onBeforeUnload);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    document.addEventListener('visibilitychange', this.onVisibilityChange);

    if (loadResult.issue === 'invalid') {
      this.hud.notice('旧存档无法读取，已创建新岛屿。');
    }
    if (loadResult.issue === 'unavailable') {
      this.hud.notice('浏览器存储不可用，本次进度可能无法保留。', true);
    }

    if (new URLSearchParams(location.search).get('e2e') === '1') {
      window.__VOXEL_TEST__ = {
        snapshot: () => {
          const player = this.player.getState();
          return {
            player: { ...player.position },
            selectedSlot: this.inventory.selectedIndex,
            deltaLength: this.world.getDelta().length,
            seed: this.seed,
            locked: this.player.isLocked(),
            paused: !this.player.isLocked(),
            target: this.interaction.getTarget(),
          };
        },
      };
    }
  }

  start(): void {
    this.previousFrameTime = performance.now();
    this.frameHandle = requestAnimationFrame(this.onFrame);
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }
    this.disposed = true;
    if (this.frameHandle !== null) {
      cancelAnimationFrame(this.frameHandle);
      this.frameHandle = null;
    }
    this.saveStore.flush();
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('beforeunload', this.onBeforeUnload);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    document.removeEventListener('visibilitychange', this.onVisibilityChange);
    this.interaction.dispose();
    this.player.dispose();
    this.chunks.dispose();
    this.effects.dispose();
    this.renderer.dispose();
    this.hud.dispose();
    delete window.__VOXEL_TEST__;
  }

  private readonly onFrame = (time: number): void => {
    const dt = Math.min((time - this.previousFrameTime) / 1000, 0.05);
    this.previousFrameTime = time;

    if (this.player.isLocked()) {
      this.player.update(dt);
      const current = this.player.getState();
      const displacement = Math.hypot(
        current.position.x - this.initialSpawn.position.x,
        current.position.z - this.initialSpawn.position.z,
      );
      if (this.firstVisit && displacement > 0.03) {
        this.firstVisit = false;
        this.hud.dismissOnboarding();
      }
      if (current.position.y < -10) {
        this.player.setState(this.spawnState());
      }
      this.activeSaveTimer += dt;
      if (this.activeSaveTimer >= 1) {
        this.activeSaveTimer = 0;
        this.queueSave();
      }
    }

    this.interaction.update(this.chunks.getMeshes());
    this.chunks.rebuildPending();
    this.effects.update(dt);
    this.renderer.render(this.scene, this.camera);
    this.frameHandle = requestAnimationFrame(this.onFrame);
  };

  private spawnState(): PlayerState {
    const island = generateIsland(this.seed);
    return {
      position: { ...island.spawn },
      velocity: { x: 0, y: 0, z: 0 },
      yaw: 0,
      pitch: -0.35,
      grounded: false,
    };
  }

  private restoreSavedPlayer(save: SaveDataV1): PlayerState | null {
    const state: PlayerState = {
      position: { x: save.player.x, y: save.player.y, z: save.player.z },
      velocity: { x: 0, y: 0, z: 0 },
      yaw: save.player.yaw,
      pitch: save.player.pitch,
      grounded: false,
    };
    if (![state.position.x, state.position.y, state.position.z, state.yaw, state.pitch].every(Number.isFinite)) {
      return null;
    }

    const minX = Math.floor(state.position.x - 0.32);
    const maxX = Math.floor(state.position.x + 0.32);
    const minY = Math.floor(state.position.y);
    const maxY = Math.floor(state.position.y + 1.8 - 0.001);
    const minZ = Math.floor(state.position.z - 0.32);
    const maxZ = Math.floor(state.position.z + 0.32);
    for (let x = minX; x <= maxX; x += 1) {
      for (let y = minY; y <= maxY; y += 1) {
        for (let z = minZ; z <= maxZ; z += 1) {
          if (this.world.getBlock({ x, y, z }) !== BlockId.Air && playerOverlapsBlock(state, { x, y, z })) {
            return null;
          }
        }
      }
    }
    return state;
  }

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

  private queueSave(): void {
    this.saveStore.schedule(this.createSave());
  }

  private async resetWorld(): Promise<void> {
    if (!(await this.hud.confirmReset())) {
      return;
    }
    this.saveStore.reset();
    this.world = new World(generateIsland(this.seed).blocks);
    this.player.replaceWorld(this.world);
    this.player.setState(this.spawnState());
    this.inventory.select(0);
    this.chunks.replaceWorld(this.world);
    this.saveStore.schedule(this.createSave());
    this.saveStore.flush();
    this.hud.renderHotbar(this.inventory.selectedIndex);
  }
}
