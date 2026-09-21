import { HOTBAR_BLOCKS, type BlockId } from '../world/blocks';

export class Inventory {
  selectedIndex: number;

  constructor(initialIndex: number) {
    this.selectedIndex = HOTBAR_BLOCKS[initialIndex] === null ? 0 : initialIndex;
  }

  select(index: number): boolean {
    if (!Number.isInteger(index) || index < 0 || index >= HOTBAR_BLOCKS.length || HOTBAR_BLOCKS[index] === null) {
      return false;
    }
    this.selectedIndex = index;
    return true;
  }

  cycle(direction: number): void {
    const step = direction < 0 ? -1 : 1;
    let index = this.selectedIndex;
    for (let attempts = 0; attempts < HOTBAR_BLOCKS.length; attempts += 1) {
      index = (index + step + HOTBAR_BLOCKS.length) % HOTBAR_BLOCKS.length;
      if (HOTBAR_BLOCKS[index] !== null) {
        this.selectedIndex = index;
        return;
      }
    }
  }

  get selectedBlock(): BlockId {
    return HOTBAR_BLOCKS[this.selectedIndex]!;
  }
}
