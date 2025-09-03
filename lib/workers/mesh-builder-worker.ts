/**
 * Mesh Building Worker
 * 
 * This worker runs in a separate thread to build optimized meshes from chunk data.
 * It handles the CPU-intensive work of face culling, vertex generation, and mesh
 * optimization without blocking the main thread.
 */

import type {
  WorkerMessage,
  MeshBuildingRequest,
  MeshBuildingResponse,
  SerializableChunk,
  MeshData,
  WorkerErrorMessage
} from "./types.ts";

// Constants (duplicated from types.ts for worker isolation)
const CHUNK_SIZE = 16;

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
 * Mesh building class containing all mesh generation logic
 */
class MeshBuilder {
  /**
   * Build an optimized mesh from chunk data
   */
  buildMesh(chunk: SerializableChunk, neighborChunks?: { [key: string]: SerializableChunk | null }): MeshData {
    const vertices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    // Process each block in the chunk
    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let y = 0; y < CHUNK_SIZE; y++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
          const index = x + y * CHUNK_SIZE + z * CHUNK_SIZE * CHUNK_SIZE;
          const blockType = chunk.blocks[index];

          if (blockType === BlockTypeEnum.AIR) continue;

          const worldPos = {
            x: chunk.position.x * CHUNK_SIZE + x,
            y: chunk.position.y * CHUNK_SIZE + y,
            z: chunk.position.z * CHUNK_SIZE + z
          };

          this.addBlockToMesh(
            blockType,
            worldPos,
            chunk,
            { x, y, z },
            neighborChunks,
            vertices,
            normals,
            uvs,
            indices
          );
        }
      }
    }

    // Convert to typed arrays for efficient transfer
    return {
      vertices: new Float32Array(vertices),
      normals: new Float32Array(normals),
      uvs: new Float32Array(uvs),
      indices: new Uint32Array(indices)
    };
  }

  /**
   * Add a single block's visible faces to the mesh
   */
  private addBlockToMesh(
    blockType: number,
    worldPos: { x: number; y: number; z: number },
    chunk: SerializableChunk,
    localPos: { x: number; y: number; z: number },
    neighborChunks: { [key: string]: SerializableChunk | null } | undefined,
    vertices: number[],
    normals: number[],
    uvs: number[],
    indices: number[]
  ): void {
    // Define the 6 faces of a cube with proper winding order
    const faces = [
      {
        normal: [0, 1, 0],
        vertices: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]]
      }, // top - counter-clockwise when viewed from above
      {
        normal: [0, -1, 0],
        vertices: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]]
      }, // bottom - counter-clockwise when viewed from below
      {
        normal: [0, 0, 1],
        vertices: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]]
      }, // front - counter-clockwise when viewed from front
      {
        normal: [0, 0, -1],
        vertices: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]]
      }, // back - counter-clockwise when viewed from back
      {
        normal: [1, 0, 0],
        vertices: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]]
      }, // right - counter-clockwise when viewed from right
      {
        normal: [-1, 0, 0],
        vertices: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]]
      } // left - counter-clockwise when viewed from left
    ];

    const textureCoords = this.getTextureCoords(blockType);

    faces.forEach((face, faceIndex) => {
      if (this.shouldRenderFace(chunk, localPos, face.normal, neighborChunks)) {
        const faceBaseIndex = vertices.length / 3;

        // Add vertices for this face
        face.vertices.forEach((vertex) => {
          vertices.push(
            worldPos.x + vertex[0],
            worldPos.y + vertex[1],
            worldPos.z + vertex[2]
          );
          normals.push(...face.normal);
        });

        // Add texture coordinates
        uvs.push(...textureCoords[faceIndex]);

        // Add indices for two triangles
        indices.push(
          faceBaseIndex,
          faceBaseIndex + 1,
          faceBaseIndex + 2,
          faceBaseIndex,
          faceBaseIndex + 2,
          faceBaseIndex + 3
        );
      }
    });
  }

  /**
   * Determine if a face should be rendered based on adjacent blocks
   */
  private shouldRenderFace(
    chunk: SerializableChunk,
    pos: { x: number; y: number; z: number },
    normal: number[],
    neighborChunks?: { [key: string]: SerializableChunk | null }
  ): boolean {
    const nx = pos.x + normal[0];
    const ny = pos.y + normal[1];
    const nz = pos.z + normal[2];

    // Check if the adjacent position is within this chunk
    if (nx >= 0 && nx < CHUNK_SIZE && ny >= 0 && ny < CHUNK_SIZE && nz >= 0 && nz < CHUNK_SIZE) {
      const index = nx + ny * CHUNK_SIZE + nz * CHUNK_SIZE * CHUNK_SIZE;
      const adjacentBlock = chunk.blocks[index];
      return adjacentBlock === BlockTypeEnum.AIR || this.isTransparentBlock(adjacentBlock);
    }

    // Face is at chunk boundary - check neighbor chunks if available
    if (neighborChunks) {
      const neighborChunk = this.getNeighborBlock(chunk, pos, normal, neighborChunks);
      if (neighborChunk !== null) {
        return neighborChunk === BlockTypeEnum.AIR || this.isTransparentBlock(neighborChunk);
      }
    }

    // Default to rendering faces at chunk boundaries
    return true;
  }

  /**
   * Get block from neighbor chunk for cross-chunk face culling
   */
  private getNeighborBlock(
    chunk: SerializableChunk,
    pos: { x: number; y: number; z: number },
    normal: number[],
    neighborChunks: { [key: string]: SerializableChunk | null }
  ): number | null {
    const nx = pos.x + normal[0];
    const ny = pos.y + normal[1];
    const nz = pos.z + normal[2];

    // Calculate which neighbor chunk we need
    let neighborChunkX = chunk.position.x;
    let neighborChunkY = chunk.position.y;
    let neighborChunkZ = chunk.position.z;
    let localX = nx;
    let localY = ny;
    let localZ = nz;

    if (nx < 0) {
      neighborChunkX--;
      localX = CHUNK_SIZE - 1;
    } else if (nx >= CHUNK_SIZE) {
      neighborChunkX++;
      localX = 0;
    }

    if (ny < 0) {
      neighborChunkY--;
      localY = CHUNK_SIZE - 1;
    } else if (ny >= CHUNK_SIZE) {
      neighborChunkY++;
      localY = 0;
    }

    if (nz < 0) {
      neighborChunkZ--;
      localZ = CHUNK_SIZE - 1;
    } else if (nz >= CHUNK_SIZE) {
      neighborChunkZ++;
      localZ = 0;
    }

    // Get the neighbor chunk
    const neighborKey = `${neighborChunkX},${neighborChunkY},${neighborChunkZ}`;
    const neighborChunk = neighborChunks[neighborKey];

    if (!neighborChunk) {
      return null; // Neighbor chunk not available
    }

    // Get block from neighbor chunk
    const index = localX + localY * CHUNK_SIZE + localZ * CHUNK_SIZE * CHUNK_SIZE;
    return neighborChunk.blocks[index];
  }

  /**
   * Check if a block type is transparent
   */
  private isTransparentBlock(blockType: number): boolean {
    return blockType === BlockTypeEnum.AIR || 
           blockType === BlockTypeEnum.WATER || 
           blockType === BlockTypeEnum.LEAVES;
  }

  /**
   * Get texture coordinates for different block types
   */
  private getTextureCoords(blockType: number): number[][] {
    const textureSize = 0.25; // 4x4 atlas = 0.25 per texture

    // Get base texture coordinates for a texture index
    const getTextureUV = (textureIndex: number): number[] => {
      const u = (textureIndex % 4) * textureSize;
      const v = Math.floor(textureIndex / 4) * textureSize;
      return [
        u, v + textureSize,           // bottom-left
        u + textureSize, v + textureSize, // bottom-right
        u + textureSize, v,           // top-right
        u, v                          // top-left
      ];
    };

    switch (blockType) {
      case BlockTypeEnum.GRASS:
        return [
          getTextureUV(0), // top - grass texture
          getTextureUV(2), // bottom - dirt texture
          getTextureUV(1), // front - grass side
          getTextureUV(1), // back - grass side
          getTextureUV(1), // right - grass side
          getTextureUV(1)  // left - grass side
        ];

      case BlockTypeEnum.DIRT: {
        const dirtUV = getTextureUV(2);
        return [dirtUV, dirtUV, dirtUV, dirtUV, dirtUV, dirtUV];
      }

      case BlockTypeEnum.STONE: {
        const stoneUV = getTextureUV(3);
        return [stoneUV, stoneUV, stoneUV, stoneUV, stoneUV, stoneUV];
      }

      case BlockTypeEnum.WOOD:
        return [
          getTextureUV(5), // top - wood rings
          getTextureUV(5), // bottom - wood rings
          getTextureUV(4), // front - wood bark
          getTextureUV(4), // back - wood bark
          getTextureUV(4), // right - wood bark
          getTextureUV(4)  // left - wood bark
        ];

      case BlockTypeEnum.LEAVES: {
        const leavesUV = getTextureUV(6);
        return [leavesUV, leavesUV, leavesUV, leavesUV, leavesUV, leavesUV];
      }

      case BlockTypeEnum.SAND: {
        const sandUV = getTextureUV(7);
        return [sandUV, sandUV, sandUV, sandUV, sandUV, sandUV];
      }

      case BlockTypeEnum.COBBLESTONE: {
        const cobbleUV = getTextureUV(8);
        return [cobbleUV, cobbleUV, cobbleUV, cobbleUV, cobbleUV, cobbleUV];
      }

      case BlockTypeEnum.PLANKS: {
        const planksUV = getTextureUV(9);
        return [planksUV, planksUV, planksUV, planksUV, planksUV, planksUV];
      }

      default: {
        // Default texture
        const defaultUV = getTextureUV(10);
        return [defaultUV, defaultUV, defaultUV, defaultUV, defaultUV, defaultUV];
      }
    }
  }
}

/**
 * Handle messages from the main thread
 */
self.onmessage = (event: MessageEvent<WorkerMessage>) => {
  const message = event.data;

  try {
    if (message.type === "BUILD_MESH") {
      const request = message as MeshBuildingRequest;
      
      // Create mesh builder
      const builder = new MeshBuilder();
      
      // Build the mesh
      const meshData = builder.buildMesh(request.chunk, request.neighborChunks);
      
      // Create chunk key for identification
      const chunkKey = `${request.chunk.position.x},${request.chunk.position.y},${request.chunk.position.z}`;
      
      // Send the result back to main thread
      const response: MeshBuildingResponse = {
        id: request.id,
        type: "MESH_READY",
        chunkKey,
        meshData
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
    // Handle any errors during mesh building
    const errorResponse: WorkerErrorMessage = {
      id: message.id,
      type: "ERROR",
      error: error instanceof Error ? error.message : "Unknown error during mesh building",
      originalRequest: message
    };
    
    self.postMessage(errorResponse);
  }
};

// Send a ready message to indicate worker is initialized
self.postMessage({ type: "READY" });