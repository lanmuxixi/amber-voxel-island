import { afterEach, describe, expect, it, vi } from 'vitest';

import { BlockId } from '../src/world/blocks';
import { decodeSave, type SaveDataV1, SaveStore } from '../src/persistence/SaveStore';

const validSave: SaveDataV1 = {
  version: 1,
  seed: 42,
  player: { x: 1, y: 8, z: 2, yaw: 0.4, pitch: -0.1 },
  selectedSlot: 2,
  changes: [[1, 2, 3, BlockId.Stone]],
};

afterEach(() => {
  vi.useRealTimers();
});

describe('decodeSave', () => {
  it('round-trips a valid save payload', () => {
    expect(decodeSave(JSON.stringify(validSave))).toEqual(validSave);
  });

  it('rejects malformed save payloads', () => {
    const invalidPayloads = [
      'not json',
      '{}',
      JSON.stringify({ ...validSave, version: 2 }),
      JSON.stringify({ ...validSave, player: { ...validSave.player, x: Number.NaN } }),
      JSON.stringify({ ...validSave, selectedSlot: 9 }),
      JSON.stringify({ ...validSave, changes: [[1, 2, 3, 999]] }),
      JSON.stringify({ ...validSave, changes: [[1, 2, 3, BlockId.Foundation]] }),
    ];

    for (const payload of invalidPayloads) {
      expect(decodeSave(payload)).toBeNull();
    }
  });
});

describe('SaveStore', () => {
  it('reports invalid data and unavailable storage on load', () => {
    const invalidStore = new SaveStore({
      getItem: () => '{broken',
      setItem: () => undefined,
      removeItem: () => undefined,
    });
    expect(invalidStore.load()).toEqual({ data: null, issue: 'invalid' });

    const unavailableStore = new SaveStore({
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => undefined,
      removeItem: () => undefined,
    });
    expect(unavailableStore.load()).toEqual({ data: null, issue: 'unavailable' });
  });

  it('coalesces scheduled writes and keeps the newest snapshot', () => {
    vi.useFakeTimers();
    const setItem = vi.fn();
    const store = new SaveStore(
      {
        getItem: () => null,
        setItem,
        removeItem: () => undefined,
      },
      'test-save',
      100,
    );

    store.schedule(validSave);
    store.schedule({ ...validSave, seed: 43 });
    vi.advanceTimersByTime(100);

    expect(setItem).toHaveBeenCalledTimes(1);
    expect(JSON.parse(setItem.mock.calls[0][1] as string)).toMatchObject({ seed: 43 });
  });

  it('reports a write failure only once across repeated flush attempts', () => {
    const onWriteFailure = vi.fn();
    const store = new SaveStore(
      {
        getItem: () => null,
        setItem: () => {
          throw new Error('quota');
        },
        removeItem: () => undefined,
      },
      'test-save',
      100,
      onWriteFailure,
    );

    store.schedule(validSave);
    expect(store.flush()).toBe(false);
    expect(store.flush()).toBe(false);
    expect(onWriteFailure).toHaveBeenCalledTimes(1);
  });
});
