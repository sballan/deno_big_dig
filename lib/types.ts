export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface Vec2 {
  x: number;
  y: number;
}

export enum BlockType {
  AIR = 0,
  STONE = 1,
  DIRT = 2,
  GRASS = 3,
  WOOD = 4,
  LEAVES = 5,
  WATER = 6,
  SAND = 7,
  COBBLESTONE = 8,
  PLANKS = 9,
}

export interface Block {
  type: BlockType;
  position: Vec3;
}

export interface Chunk {
  position: Vec3;
  blocks: Uint8Array;
  isDirty: boolean;
}

export interface Player {
  position: Vec3;
  rotation: Vec2;
  velocity: Vec3;
  selectedTool: Tool;
  inventory: InventoryItem[];
}

export enum ToolType {
  HAND = 0,
  PICKAXE = 1,
  AXE = 2,
  SHOVEL = 3,
  SWORD = 4,
}

export interface Tool {
  type: ToolType;
  durability: number;
  maxDurability: number;
}

export interface InventoryItem {
  blockType: BlockType;
  count: number;
}

export interface Camera {
  position: Vec3;
  rotation: Vec2;
  fov: number;
  aspect: number;
  near: number;
  far: number;
}

export const CHUNK_SIZE = 16;
export const WORLD_HEIGHT = 128;
export const RENDER_DISTANCE = 8;