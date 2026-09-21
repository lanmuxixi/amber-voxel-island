export enum BlockId {
  Air,
  Grass,
  Dirt,
  Stone,
  Sand,
  Wood,
  Leaves,
  Foundation,
}

export interface BlockDefinition {
  id: BlockId;
  label: string;
  color: string;
  opaque: boolean;
  breakable: boolean;
  atlasTile: number;
}

export const BLOCKS: Record<BlockId, BlockDefinition> = {
  [BlockId.Air]: {
    id: BlockId.Air,
    label: '空气',
    color: '#000000',
    opaque: false,
    breakable: false,
    atlasTile: 0,
  },
  [BlockId.Grass]: {
    id: BlockId.Grass,
    label: '暮草',
    color: '#8f9f54',
    opaque: true,
    breakable: true,
    atlasTile: 0,
  },
  [BlockId.Dirt]: {
    id: BlockId.Dirt,
    label: '赭土',
    color: '#8d5f43',
    opaque: true,
    breakable: true,
    atlasTile: 1,
  },
  [BlockId.Stone]: {
    id: BlockId.Stone,
    label: '暗石',
    color: '#68707b',
    opaque: true,
    breakable: true,
    atlasTile: 2,
  },
  [BlockId.Sand]: {
    id: BlockId.Sand,
    label: '霞砂',
    color: '#d5bc7c',
    opaque: true,
    breakable: true,
    atlasTile: 3,
  },
  [BlockId.Wood]: {
    id: BlockId.Wood,
    label: '暮木',
    color: '#7d5336',
    opaque: true,
    breakable: true,
    atlasTile: 4,
  },
  [BlockId.Leaves]: {
    id: BlockId.Leaves,
    label: '灰叶',
    color: '#6f8663',
    opaque: true,
    breakable: true,
    atlasTile: 5,
  },
  [BlockId.Foundation]: {
    id: BlockId.Foundation,
    label: '基岩',
    color: '#40363c',
    opaque: true,
    breakable: false,
    atlasTile: 6,
  },
};

export const HOTBAR_BLOCKS: readonly (BlockId | null)[] = [
  BlockId.Grass,
  BlockId.Dirt,
  BlockId.Stone,
  BlockId.Sand,
  BlockId.Wood,
  BlockId.Leaves,
  null,
  null,
  null,
];

export function isBlockId(value: number): value is BlockId {
  return Number.isInteger(value) && value in BLOCKS;
}
