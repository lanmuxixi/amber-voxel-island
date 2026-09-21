import { describe, expect, it } from 'vitest';

import { BlockId } from '../src/world/blocks';
import { Inventory } from '../src/inventory/Inventory';

describe('Inventory', () => {
  it('selects populated slots and keeps the previous selection for empty ones', () => {
    const inventory = new Inventory(0);

    expect(inventory.select(2)).toBe(true);
    expect(inventory.selectedBlock).toBe(BlockId.Stone);

    expect(inventory.select(8)).toBe(false);
    expect(inventory.selectedIndex).toBe(2);
    expect(inventory.selectedBlock).toBe(BlockId.Stone);
  });

  it('wraps when cycling across the hotbar', () => {
    const inventory = new Inventory(0);

    inventory.cycle(-1);
    expect(inventory.selectedBlock).toBe(BlockId.Leaves);
  });
});
