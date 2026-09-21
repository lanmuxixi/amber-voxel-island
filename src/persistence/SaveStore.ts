import { BLOCKS, BlockId } from '../world/blocks';
import { isEditableBlockPosition } from '../world/coords';
import type { BlockDeltaEntry } from '../world/World';

export interface SaveDataV1 {
  version: 1;
  seed: number;
  player: { x: number; y: number; z: number; yaw: number; pitch: number };
  selectedSlot: number;
  changes: BlockDeltaEntry[];
}

type StoragePort = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export interface StorageResolution {
  storage: StoragePort;
  unavailable: boolean;
}

export interface SaveLoadResult {
  data: SaveDataV1 | null;
  issue: 'invalid' | 'unavailable' | null;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function normalizeSave(snapshot: SaveDataV1): SaveDataV1 {
  return {
    version: snapshot.version,
    seed: snapshot.seed,
    player: {
      x: snapshot.player.x,
      y: snapshot.player.y,
      z: snapshot.player.z,
      yaw: snapshot.player.yaw,
      pitch: snapshot.player.pitch,
    },
    selectedSlot: snapshot.selectedSlot,
    changes: snapshot.changes.map(([x, y, z, block]) => [x, y, z, block]),
  };
}

export function resolveStorage(getStorage: () => StoragePort): StorageResolution {
  try {
    return { storage: getStorage(), unavailable: false };
  } catch {
    const values = new Map<string, string>();
    return {
      storage: {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => {
          values.set(key, value);
        },
        removeItem: (key) => {
          values.delete(key);
        },
      },
      unavailable: true,
    };
  }
}

export function decodeSave(raw: string | null): SaveDataV1 | null {
  if (!raw) {
    return null;
  }

  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object') {
      return null;
    }

    const save = value as Record<string, unknown>;
    const player = save.player as Record<string, unknown> | undefined;
    if (save.version !== 1 || !Number.isInteger(save.seed) || !player) {
      return null;
    }

    if (![player.x, player.y, player.z, player.yaw, player.pitch].every(isFiniteNumber)) {
      return null;
    }

    if (!Number.isInteger(save.selectedSlot) || Number(save.selectedSlot) < 0 || Number(save.selectedSlot) > 8) {
      return null;
    }

    if (!Array.isArray(save.changes)) {
      return null;
    }

    const changes: BlockDeltaEntry[] = [];
    for (const entry of save.changes) {
      if (!Array.isArray(entry) || entry.length !== 4 || !entry.every((item) => Number.isInteger(item))) {
        return null;
      }
      const [x, y, z, block] = entry;
      if (
        !isEditableBlockPosition({ x: Number(x), y: Number(y), z: Number(z) }) ||
        !(Number(block) in BLOCKS) ||
        block === BlockId.Foundation
      ) {
        return null;
      }
      changes.push([Number(x), Number(y), Number(z), Number(block) as BlockId]);
    }

    return {
      version: 1,
      seed: Number(save.seed),
      player: {
        x: Number(player.x),
        y: Number(player.y),
        z: Number(player.z),
        yaw: Number(player.yaw),
        pitch: Number(player.pitch),
      },
      selectedSlot: Number(save.selectedSlot),
      changes,
    };
  } catch {
    return null;
  }
}

export class SaveStore {
  private pending: SaveDataV1 | null = null;

  private timer: ReturnType<typeof setTimeout> | null = null;

  private writeFailureReported = false;

  constructor(
    private readonly storage: StoragePort,
    private readonly key = 'amber-voxel-island:v1',
    private readonly delayMs = 250,
    private readonly onWriteFailure: () => void = () => undefined,
  ) {}

  load(): SaveLoadResult {
    try {
      const raw = this.storage.getItem(this.key);
      const data = decodeSave(raw);
      return { data, issue: raw !== null && data === null ? 'invalid' : null };
    } catch {
      return { data: null, issue: 'unavailable' };
    }
  }

  schedule(snapshot: SaveDataV1): void {
    this.pending = normalizeSave(snapshot);
    if (this.timer) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      this.flush();
    }, this.delayMs);
  }

  flush(): boolean {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (!this.pending) {
      return true;
    }

    try {
      this.storage.setItem(this.key, JSON.stringify(this.pending));
      this.pending = null;
      return true;
    } catch {
      if (!this.writeFailureReported) {
        this.onWriteFailure();
        this.writeFailureReported = true;
      }
      return false;
    }
  }

  reset(): boolean {
    this.pending = null;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    try {
      this.storage.removeItem(this.key);
      return true;
    } catch {
      return false;
    }
  }
}
