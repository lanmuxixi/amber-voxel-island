import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { PlayerState } from '../src/player/physics';

const spies = vi.hoisted(() => ({
  hudNotice: vi.fn(),
  hudPersistentNotice: vi.fn(),
  hudSetPaused: vi.fn(),
  hudDismissOnboarding: vi.fn(),
  rendererRender: vi.fn(),
  playerLocked: false,
  playerState: null as PlayerState | null,
  hudResetAction: null as (() => void) | null,
  hudConfirmReset: false,
}));

vi.mock('three', () => {
  class WebGLRenderer {
    readonly shadowMap = { enabled: false, type: 0 };

    outputColorSpace = '';

    setPixelRatio(): void {}

    setSize(): void {}

    render = spies.rendererRender;

    dispose(): void {}
  }

  class Scene {
    fog: unknown = null;

    add(): void {}
  }

  class PerspectiveCamera {
    aspect = 1;

    updateProjectionMatrix(): void {}
  }

  class DirectionalLight {
    readonly position = { set: () => undefined };

    readonly shadow = {
      mapSize: { set: () => undefined },
      camera: { left: 0, right: 0, top: 0, bottom: 0 },
    };

    castShadow = false;
  }

  return {
    WebGLRenderer,
    Scene,
    PerspectiveCamera,
    DirectionalLight,
    HemisphereLight: class {},
    Fog: class {},
    PCFSoftShadowMap: 1,
    SRGBColorSpace: 'srgb',
  };
});

vi.mock('../src/effects/BlockEffects', () => ({
  BlockEffects: class {
    remove(): void {}

    place(): void {}

    update(): void {}

    dispose(): void {}
  },
}));

vi.mock('../src/interaction/BlockInteraction', () => ({
  BlockInteraction: class {
    update(): void {}

    getTarget(): null {
      return null;
    }

    dispose(): void {}
  },
}));

vi.mock('../src/player/PlayerController', () => ({
  PlayerController: class {
    constructor(_canvas: HTMLCanvasElement, _camera: unknown, _world: unknown, initial: PlayerState) {
      spies.playerState = structuredClone(initial);
    }

    requestLock(): void {}

    isLocked(): boolean {
      return spies.playerLocked;
    }

    update(): void {}

    getState(): PlayerState {
      return structuredClone(spies.playerState!);
    }

    setState(state: PlayerState): void {
      spies.playerState = structuredClone(state);
    }

    replaceWorld(): void {}

    dispose(): void {}
  },
}));

vi.mock('../src/ui/Hud', () => ({
  Hud: class {
    constructor(_root: HTMLElement, actions: { onReset(): void }) {
      spies.hudResetAction = actions.onReset;
    }

    notice = spies.hudNotice;

    persistentNotice = spies.hudPersistentNotice;

    renderHotbar(): void {}

    setPaused = spies.hudSetPaused;

    dismissOnboarding = spies.hudDismissOnboarding;

    async confirmReset(): Promise<boolean> {
      return spies.hudConfirmReset;
    }

    dispose(): void {}
  },
}));

vi.mock('../src/world/ChunkRenderer', () => ({
  ChunkRenderer: class {
    buildAll(): void {}

    markBlockDirty(): void {}

    getMeshes(): [] {
      return [];
    }

    rebuildPending(): void {}

    replaceWorld(): void {}

    dispose(): void {}
  },
}));

vi.mock('../src/world/terrain', () => ({
  generateIsland: () => ({
    blocks: new Map([['0,5,-1', 1]]),
    spawn: { x: 0.5, y: 6.25, z: -0.5 },
  }),
}));

import { Game } from '../src/game/Game';

type StoragePort = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function createStorage(raw: string | null = null): StoragePort & { setItem: ReturnType<typeof vi.fn> } {
  return {
    getItem: vi.fn(() => raw),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  };
}

function installBrowser(getStorage: () => StoragePort): {
  requestFrame: ReturnType<typeof vi.fn>;
  cancelFrame: ReturnType<typeof vi.fn>;
  browserDocument: Document;
  browserWindow: Window;
  addWindowListener: ReturnType<typeof vi.spyOn>;
} {
  const browserWindow = new EventTarget() as Window;
  const addWindowListener = vi.spyOn(browserWindow, 'addEventListener');
  Object.assign(browserWindow, { innerWidth: 1280, innerHeight: 720, devicePixelRatio: 1 });
  Object.defineProperty(browserWindow, 'localStorage', { configurable: true, get: getStorage });

  const browserDocument = new EventTarget() as Document;
  Object.defineProperty(browserDocument, 'hidden', { configurable: true, value: false });

  let nextFrame = 1;
  const requestFrame = vi.fn(() => nextFrame++);
  const cancelFrame = vi.fn();

  vi.stubGlobal('window', browserWindow);
  vi.stubGlobal('document', browserDocument);
  vi.stubGlobal('location', { search: '' });
  vi.stubGlobal('crypto', {
    getRandomValues(values: Uint32Array): Uint32Array {
      values[0] = 777;
      return values;
    },
  });
  vi.stubGlobal('requestAnimationFrame', requestFrame);
  vi.stubGlobal('cancelAnimationFrame', cancelFrame);
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: getStorage });

  return { requestFrame, cancelFrame, browserDocument, browserWindow, addWindowListener };
}

function createGame(): Game {
  return new Game(
    { clientWidth: 1280, clientHeight: 720 } as HTMLCanvasElement,
    {} as HTMLElement,
  );
}

beforeEach(() => {
  spies.hudNotice.mockClear();
  spies.hudPersistentNotice.mockClear();
  spies.hudSetPaused.mockClear();
  spies.hudDismissOnboarding.mockClear();
  spies.rendererRender.mockClear();
  spies.playerLocked = false;
  spies.playerState = null;
  spies.hudResetAction = null;
  spies.hudConfirmReset = false;
});

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'localStorage');
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('Game runtime boundaries', () => {
  it('starts with a fallback and reports unavailable storage when the localStorage accessor throws', () => {
    installBrowser(() => {
      throw new Error('storage access denied');
    });

    expect(() => createGame()).not.toThrow();
    expect(spies.hudPersistentNotice).toHaveBeenCalledWith('浏览器存储不可用，本次进度可能无法保留。');
  });

  it('immediately persists the generated initial snapshot when no valid save exists', () => {
    const storage = createStorage();
    installBrowser(() => storage);

    createGame();

    expect(storage.setItem).toHaveBeenCalledTimes(1);
    expect(JSON.parse(storage.setItem.mock.calls[0]?.[1] as string)).toEqual({
      version: 1,
      seed: 777,
      player: { x: 0.5, y: 6.25, z: -0.5, yaw: 0, pitch: -0.35 },
      selectedSlot: 0,
      changes: [],
    });
  });

  it('restores reachable off-island coordinates but falls back from unsafe numeric bounds', () => {
    const save = (x: number) => JSON.stringify({
      version: 1,
      seed: 777,
      player: { x, y: 8, z: -40, yaw: 0.5, pitch: -0.2 },
      selectedSlot: 0,
      changes: [],
    });
    const reachableStorage = createStorage(save(40));
    installBrowser(() => reachableStorage);
    const reachableGame = createGame();
    expect(spies.playerState?.position).toEqual({ x: 40, y: 8, z: -40 });
    reachableGame.dispose();

    vi.unstubAllGlobals();
    const unsafeStorage = createStorage(save(1e308));
    installBrowser(() => unsafeStorage);
    const unsafeGame = createGame();
    expect(spies.playerState?.position).toEqual({ x: 0.5, y: 6.25, z: -0.5 });
    unsafeGame.dispose();
  });

  it('resolves a safe fallback after saved edits obstruct the generated spawn', () => {
    const storage = createStorage(JSON.stringify({
      version: 1,
      seed: 777,
      player: { x: 0.5, y: 6.25, z: -0.5, yaw: 0, pitch: 0 },
      selectedSlot: 0,
      changes: [
        [0, 6, -1, 3],
        [0, 7, -1, 3],
      ],
    }));
    installBrowser(() => storage);

    createGame();

    expect(spies.playerState?.position.x).toBe(0.5);
    expect(spies.playerState?.position.z).toBe(-0.5);
    expect(spies.playerState?.position.y).toBeGreaterThan(8);
  });

  it('uses the current edited world when respawning after a void fall', () => {
    const storage = createStorage(JSON.stringify({
      version: 1,
      seed: 777,
      player: { x: 2.5, y: 8, z: 2.5, yaw: 0, pitch: 0 },
      selectedSlot: 0,
      changes: [
        [0, 6, -1, 3],
        [0, 7, -1, 3],
      ],
    }));
    const { requestFrame } = installBrowser(() => storage);
    const game = createGame();
    spies.playerState!.position.y = -11;
    spies.playerLocked = true;
    game.start();

    const frame = requestFrame.mock.calls[0]?.[0] as FrameRequestCallback;
    frame(performance.now() + 16);

    expect(spies.playerState?.position.x).toBe(0.5);
    expect(spies.playerState?.position.z).toBe(-0.5);
    expect(spies.playerState?.position.y).toBeGreaterThan(8);
  });

  it('exposes only read-only snapshots through the browser test contract', () => {
    const storage = createStorage();
    installBrowser(() => storage);
    vi.stubGlobal('location', { search: '?e2e=1' });

    createGame();

    expect(Object.keys(window.__VOXEL_TEST__ ?? {})).toEqual(['snapshot']);
  });

  it('starts only one animation loop', () => {
    const storage = createStorage();
    const { requestFrame } = installBrowser(() => storage);
    const game = createGame();

    game.start();
    game.start();

    expect(requestFrame).toHaveBeenCalledTimes(1);
  });

  it('does not register beforeunload and preserves browser BFCache eligibility', () => {
    const storage = createStorage();
    const { addWindowListener } = installBrowser(() => storage);

    createGame();

    expect(addWindowListener).not.toHaveBeenCalledWith('beforeunload', expect.any(Function));
  });

  it('does not schedule another frame when a queued callback runs after disposal', () => {
    const storage = createStorage();
    const { requestFrame, cancelFrame } = installBrowser(() => storage);
    const game = createGame();
    game.start();
    const queuedFrame = requestFrame.mock.calls[0]?.[0] as FrameRequestCallback;

    game.dispose();
    queuedFrame(performance.now() + 16);
    game.start();

    expect(cancelFrame).toHaveBeenCalledTimes(1);
    expect(requestFrame).toHaveBeenCalledTimes(1);
  });

  it('queues the latest player snapshot before flushing on visibility loss', () => {
    const storage = createStorage();
    const { browserDocument } = installBrowser(() => storage);
    createGame();
    spies.playerState!.position = { x: 9.25, y: 12.5, z: -4.75 };
    Object.defineProperty(browserDocument, 'hidden', { configurable: true, value: true });

    browserDocument.dispatchEvent(new Event('visibilitychange'));

    const lastWrite = storage.setItem.mock.calls.at(-1);
    expect(JSON.parse(lastWrite?.[1] as string).player).toMatchObject({ x: 9.25, y: 12.5, z: -4.75 });
  });

  it('dismisses onboarding on first pointer lock so immediate Escape opens pause', () => {
    const storage = createStorage();
    const { browserDocument } = installBrowser(() => storage);
    createGame();
    spies.hudSetPaused.mockClear();

    spies.playerLocked = true;
    browserDocument.dispatchEvent(new Event('pointerlockchange'));
    spies.playerLocked = false;
    browserDocument.dispatchEvent(new Event('pointerlockchange'));

    expect(spies.hudDismissOnboarding).toHaveBeenCalledTimes(1);
    expect(spies.hudSetPaused).toHaveBeenLastCalledWith(true, false);
  });

  it('renders one paused frame without scheduling static shadow work forever', () => {
    const storage = createStorage();
    const { requestFrame } = installBrowser(() => storage);
    const game = createGame();
    game.start();
    const pausedFrame = requestFrame.mock.calls[0]?.[0] as FrameRequestCallback;

    pausedFrame(performance.now() + 16);

    expect(spies.rendererRender).toHaveBeenCalledTimes(1);
    expect(requestFrame).toHaveBeenCalledTimes(1);
  });

  it('requests exactly one fresh frame when a paused viewport changes', () => {
    const storage = createStorage();
    const { requestFrame, browserWindow } = installBrowser(() => storage);
    const game = createGame();
    game.start();
    const initialFrame = requestFrame.mock.calls[0]?.[0] as FrameRequestCallback;
    initialFrame(performance.now() + 16);

    browserWindow.dispatchEvent(new Event('resize'));
    const resizeFrame = requestFrame.mock.calls[1]?.[0] as FrameRequestCallback;
    resizeFrame(performance.now() + 32);

    expect(spies.rendererRender).toHaveBeenCalledTimes(2);
    expect(requestFrame).toHaveBeenCalledTimes(2);
  });

  it('requests exactly one fresh frame after a paused world reset', async () => {
    const storage = createStorage();
    const { requestFrame } = installBrowser(() => storage);
    const game = createGame();
    game.start();
    const initialFrame = requestFrame.mock.calls[0]?.[0] as FrameRequestCallback;
    initialFrame(performance.now() + 16);
    spies.hudConfirmReset = true;

    spies.hudResetAction?.();
    await vi.waitFor(() => expect(requestFrame).toHaveBeenCalledTimes(2));
    const resetFrame = requestFrame.mock.calls[1]?.[0] as FrameRequestCallback;
    resetFrame(performance.now() + 32);

    expect(spies.rendererRender).toHaveBeenCalledTimes(2);
    expect(requestFrame).toHaveBeenCalledTimes(2);
  });
});
