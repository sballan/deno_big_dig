import { BlockType, Chunk, CHUNK_SIZE, Vec3, WORLD_HEIGHT } from "./types.ts";

export class World {
  private chunks: Map<string, Chunk>;
  private seed: number;

  constructor(seed: number = Date.now()) {
    this.chunks = new Map();
    this.seed = seed;
  }

  getChunk(x: number, y: number, z: number): Chunk | undefined {
    const key = this.getChunkKey(x, y, z);
    return this.chunks.get(key);
  }

  generateChunk(chunkX: number, chunkY: number, chunkZ: number): Chunk {
    const key = this.getChunkKey(chunkX, chunkY, chunkZ);
    
    if (this.chunks.has(key)) {
      return this.chunks.get(key)!;
    }

    const chunk: Chunk = {
      position: { x: chunkX, y: chunkY, z: chunkZ },
      blocks: new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_SIZE),
      isDirty: true,
    };

    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const worldX = chunkX * CHUNK_SIZE + x;
        const worldZ = chunkZ * CHUNK_SIZE + z;
        
        const height = this.getTerrainHeight(worldX, worldZ);
        
        for (let y = 0; y < CHUNK_SIZE; y++) {
          const worldY = chunkY * CHUNK_SIZE + y;
          const index = x + y * CHUNK_SIZE + z * CHUNK_SIZE * CHUNK_SIZE;
          
          if (worldY < height - 3) {
            chunk.blocks[index] = BlockType.STONE;
          } else if (worldY < height - 1) {
            chunk.blocks[index] = BlockType.DIRT;
          } else if (worldY < height) {
            chunk.blocks[index] = BlockType.GRASS;
          } else {
            chunk.blocks[index] = BlockType.AIR;
          }
        }
      }
    }

    this.generateTrees(chunk, chunkX, chunkY, chunkZ);

    this.chunks.set(key, chunk);
    return chunk;
  }

  private getTerrainHeight(x: number, z: number): number {
    const scale = 0.02;
    const amplitude = 3;
    const baseHeight = 20;
    
    const noise = this.noise2D(x * scale, z * scale);
    const octave1 = this.noise2D(x * scale * 2, z * scale * 2) * 0.3;
    
    const height = baseHeight + (noise + octave1) * amplitude;
    
    return Math.floor(height);
  }

  private noise2D(x: number, y: number): number {
    const n = Math.sin(x * 12.9898 + y * 78.233 + this.seed) * 43758.5453;
    return (n - Math.floor(n)) * 2 - 1;
  }

  private generateTrees(chunk: Chunk, chunkX: number, chunkY: number, chunkZ: number): void {
    const random = this.random(chunkX * 1000 + chunkZ);
    
    if (random < 0.02) {
      const treeX = Math.floor(this.random(chunkX * 100) * (CHUNK_SIZE - 4)) + 2;
      const treeZ = Math.floor(this.random(chunkZ * 100) * (CHUNK_SIZE - 4)) + 2;
      
      const worldX = chunkX * CHUNK_SIZE + treeX;
      const worldZ = chunkZ * CHUNK_SIZE + treeZ;
      const groundHeight = this.getTerrainHeight(worldX, worldZ);
      
      for (let y = 0; y < CHUNK_SIZE; y++) {
        const worldY = chunkY * CHUNK_SIZE + y;
        
        if (worldY >= groundHeight && worldY < groundHeight + 6) {
          const localY = y;
          const trunkIndex = treeX + localY * CHUNK_SIZE + treeZ * CHUNK_SIZE * CHUNK_SIZE;
          
          if (worldY < groundHeight + 4) {
            chunk.blocks[trunkIndex] = BlockType.WOOD;
          }
          
          if (worldY >= groundHeight + 2 && worldY < groundHeight + 6) {
            for (let dx = -2; dx <= 2; dx++) {
              for (let dz = -2; dz <= 2; dz++) {
                if (Math.abs(dx) + Math.abs(dz) <= 3) {
                  const lx = treeX + dx;
                  const lz = treeZ + dz;
                  
                  if (lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE) {
                    const leafIndex = lx + localY * CHUNK_SIZE + lz * CHUNK_SIZE * CHUNK_SIZE;
                    if (chunk.blocks[leafIndex] === BlockType.AIR) {
                      chunk.blocks[leafIndex] = BlockType.LEAVES;
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }

  private random(seed: number): number {
    const x = Math.sin(seed + this.seed) * 10000;
    return x - Math.floor(x);
  }

  getBlock(x: number, y: number, z: number): BlockType {
    const chunkX = Math.floor(x / CHUNK_SIZE);
    const chunkY = Math.floor(y / CHUNK_SIZE);
    const chunkZ = Math.floor(z / CHUNK_SIZE);
    
    const chunk = this.getChunk(chunkX, chunkY, chunkZ);
    if (!chunk) return BlockType.AIR;
    
    const localX = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const localY = ((y % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const localZ = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    
    const index = localX + localY * CHUNK_SIZE + localZ * CHUNK_SIZE * CHUNK_SIZE;
    return chunk.blocks[index];
  }

  setBlock(x: number, y: number, z: number, blockType: BlockType): void {
    const chunkX = Math.floor(x / CHUNK_SIZE);
    const chunkY = Math.floor(y / CHUNK_SIZE);
    const chunkZ = Math.floor(z / CHUNK_SIZE);
    
    let chunk = this.getChunk(chunkX, chunkY, chunkZ);
    if (!chunk) {
      chunk = this.generateChunk(chunkX, chunkY, chunkZ);
    }
    
    const localX = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const localY = ((y % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    const localZ = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
    
    const index = localX + localY * CHUNK_SIZE + localZ * CHUNK_SIZE * CHUNK_SIZE;
    chunk.blocks[index] = blockType;
    chunk.isDirty = true;
  }

  private getChunkKey(x: number, y: number, z: number): string {
    return `${x},${y},${z}`;
  }

  generateAroundPosition(position: Vec3, renderDistance: number): void {
    const chunkX = Math.floor(position.x / CHUNK_SIZE);
    const chunkY = Math.floor(position.y / CHUNK_SIZE);
    const chunkZ = Math.floor(position.z / CHUNK_SIZE);
    
    for (let dx = -renderDistance; dx <= renderDistance; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        for (let dz = -renderDistance; dz <= renderDistance; dz++) {
          const cx = chunkX + dx;
          const cy = Math.max(0, Math.min(chunkY + dy, Math.floor(WORLD_HEIGHT / CHUNK_SIZE) - 1));
          const cz = chunkZ + dz;
          
          if (!this.getChunk(cx, cy, cz)) {
            this.generateChunk(cx, cy, cz);
          }
        }
      }
    }
  }

  getChunks(): Chunk[] {
    return Array.from(this.chunks.values());
  }

  checkCollision(position: Vec3): boolean {
    const playerRadius = 0.3;
    const playerHeight = 1.8;
    
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = 0; dy <= 2; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const checkX = Math.floor(position.x + dx * playerRadius);
          const checkY = Math.floor(position.y + dy * playerHeight / 2);
          const checkZ = Math.floor(position.z + dz * playerRadius);
          
          const block = this.getBlock(checkX, checkY, checkZ);
          if (block !== BlockType.AIR && block !== BlockType.WATER) {
            return true;
          }
        }
      }
    }
    
    return false;
  }
}