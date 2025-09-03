/**
 * Chunk Generation Worker
 * 
 * This worker runs in a separate thread to generate chunk data using terrain algorithms.
 * It handles the CPU-intensive work of noise generation and terrain height calculations
 * without blocking the main thread.
 */

import type { 
  WorkerMessage,
  ChunkGenerationRequest,
  ChunkGenerationResponse,
  SerializableChunk,
  WorkerErrorMessage
} from "./types.ts";
import type { BlockType, GameConfig } from "../types.ts";

// Constants for chunk generation (duplicated from types.ts for worker isolation)
const CHUNK_SIZE = 16;
const WORLD_HEIGHT = 256;

// Block type enumeration (duplicated for worker)
const BlockTypeEnum = {
  AIR: 0,
  GRASS: 1,
  DIRT: 2,
  STONE: 3,
  WOOD: 4,
  LEAVES: 5,
  SAND: 6,
  COBBLESTONE: 7,
  PLANKS: 8,
  WATER: 9
} as const;

/**
 * Chunk generation class containing all terrain generation logic
 */
class ChunkGenerator {
  private seed: number;
  private config: GameConfig;

  constructor(seed: number, config: GameConfig) {
    this.seed = seed;
    this.config = config;
  }

  /**
   * Generate a complete chunk with terrain and trees
   */
  generateChunk(chunkX: number, chunkY: number, chunkZ: number): SerializableChunk {
    const chunk: SerializableChunk = {
      position: { x: chunkX, y: chunkY, z: chunkZ },
      blocks: new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * CHUNK_SIZE),
      isDirty: true
    };

    // Fill the chunk with terrain
    this.generateTerrain(chunk, chunkX, chunkY, chunkZ);
    
    // Add trees if this is a surface chunk
    if (chunkY * CHUNK_SIZE <= 30 && (chunkY + 1) * CHUNK_SIZE >= 15) {
      this.generateTrees(chunk, chunkX, chunkY, chunkZ);
    }

    return chunk;
  }

  /**
   * Generate base terrain for the chunk
   */
  private generateTerrain(chunk: SerializableChunk, chunkX: number, chunkY: number, chunkZ: number): void {
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const worldX = chunkX * CHUNK_SIZE + x;
        const worldZ = chunkZ * CHUNK_SIZE + z;

        const height = this.getTerrainHeight(worldX, worldZ);

        for (let y = 0; y < CHUNK_SIZE; y++) {
          const worldY = chunkY * CHUNK_SIZE + y;
          const index = x + y * CHUNK_SIZE + z * CHUNK_SIZE * CHUNK_SIZE;

          if (worldY < height - 3) {
            chunk.blocks[index] = BlockTypeEnum.STONE;
          } else if (worldY < height - 1) {
            chunk.blocks[index] = BlockTypeEnum.DIRT;
          } else if (worldY < height) {
            chunk.blocks[index] = BlockTypeEnum.GRASS;
          } else {
            chunk.blocks[index] = BlockTypeEnum.AIR;
          }
        }
      }
    }
  }

  /**
   * Calculate terrain height using noise functions
   */
  private getTerrainHeight(x: number, z: number): number {
    const baseHeight = 20;

    // If perfectly flat, return constant height
    if (this.config.flatness >= 1) {
      return baseHeight;
    }

    const scale = 0.02;
    // Reduce amplitude based on flatness (1 = no variation, 0 = full variation)
    const amplitude = 3 * (1 - this.config.flatness);

    const noise = this.noise2D(x * scale, z * scale);
    const octave1 = this.noise2D(x * scale * 2, z * scale * 2) * 0.3;

    const height = baseHeight + (noise + octave1) * amplitude;

    return Math.floor(height);
  }

  /**
   * Generate trees within the chunk
   */
  private generateTrees(chunk: SerializableChunk, chunkX: number, chunkY: number, chunkZ: number): void {
    // Generate trees with some randomness
    for (let x = 2; x < CHUNK_SIZE - 2; x += 3) {
      for (let z = 2; z < CHUNK_SIZE - 2; z += 3) {
        const worldX = chunkX * CHUNK_SIZE + x;
        const worldZ = chunkZ * CHUNK_SIZE + z;

        // Use noise to determine if a tree should be placed
        const treeNoise = this.noise2D(worldX * 0.1, worldZ * 0.1);
        if (treeNoise > (1 - this.config.treeFrequency * 2)) {
          const groundHeight = this.getTerrainHeight(worldX, worldZ);
          this.placeTree(chunk, x, groundHeight - chunkY * CHUNK_SIZE, z, chunkX, chunkY, chunkZ);
        }
      }
    }
  }

  /**
   * Place a single tree at the specified position
   */
  private placeTree(
    chunk: SerializableChunk,
    localX: number,
    localY: number,
    localZ: number,
    chunkX: number,
    chunkY: number,
    chunkZ: number
  ): void {
    const treeHeight = 4 + Math.floor(this.random(localX + localZ + chunkX + chunkZ) * 3);

    // Place trunk
    for (let y = 0; y < treeHeight; y++) {
      const trunkY = localY + y;
      if (trunkY >= 0 && trunkY < CHUNK_SIZE) {
        const index = localX + trunkY * CHUNK_SIZE + localZ * CHUNK_SIZE * CHUNK_SIZE;
        chunk.blocks[index] = BlockTypeEnum.WOOD;
      }
    }

    // Place leaves
    const leavesRadius = 2;
    const leavesHeight = 3;
    const leavesStartY = localY + treeHeight - 1;

    for (let dy = 0; dy < leavesHeight; dy++) {
      const y = leavesStartY + dy;
      if (y < 0 || y >= CHUNK_SIZE) continue;

      const currentRadius = dy === leavesHeight - 1 ? 1 : leavesRadius;

      for (let dx = -currentRadius; dx <= currentRadius; dx++) {
        for (let dz = -currentRadius; dz <= currentRadius; dz++) {
          if (dx === 0 && dz === 0) continue; // Skip center (trunk)

          const leafX = localX + dx;
          const leafZ = localZ + dz;

          if (leafX >= 0 && leafX < CHUNK_SIZE && leafZ >= 0 && leafZ < CHUNK_SIZE) {
            const distance = Math.sqrt(dx * dx + dz * dz);
            if (distance <= currentRadius) {
              const index = leafX + y * CHUNK_SIZE + leafZ * CHUNK_SIZE * CHUNK_SIZE;
              if (chunk.blocks[index] === BlockTypeEnum.AIR) {
                chunk.blocks[index] = BlockTypeEnum.LEAVES;
              }
            }
          }
        }
      }
    }
  }

  /**
   * Simple 2D noise function for terrain generation
   */
  private noise2D(x: number, y: number): number {
    const n = Math.sin(x * 12.9898 + y * 78.233 + this.seed * 37.719) * 43758.5453;
    return (n - Math.floor(n)) * 2 - 1; // Returns value between -1 and 1
  }

  /**
   * Simple pseudo-random function
   */
  private random(seed: number): number {
    const n = Math.sin(seed * 12.9898 + this.seed * 78.233) * 43758.5453;
    return n - Math.floor(n); // Returns value between 0 and 1
  }
}

/**
 * Handle messages from the main thread
 */
self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;

  try {
    if (message.type === "GENERATE_CHUNK") {
      const request = message as ChunkGenerationRequest;
      
      // Create generator with the provided configuration
      const generator = new ChunkGenerator(request.seed, request.config);
      
      // Generate the chunk
      const chunk = generator.generateChunk(request.chunkX, request.chunkY, request.chunkZ);
      
      // Send the result back to main thread
      const response: ChunkGenerationResponse = {
        id: request.id,
        type: "CHUNK_READY",
        chunk
      };
      
      self.postMessage(response);
    } else {
      // Unknown message type
      const errorResponse: WorkerErrorMessage = {
        id: message.id,
        type: "ERROR",
        error: `Unknown message type: ${message.type}`,
        originalRequest: message
      };
      
      self.postMessage(errorResponse);
    }
  } catch (error) {
    // Handle any errors during chunk generation
    const errorResponse: WorkerErrorMessage = {
      id: message.id,
      type: "ERROR",
      error: error instanceof Error ? error.message : "Unknown error during chunk generation",
      originalRequest: message
    };
    
    self.postMessage(errorResponse);
  }
};

// Send a ready message to indicate worker is initialized
self.postMessage({ type: "READY" });