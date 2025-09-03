/**
 * Shared Types for Worker Communication
 *
 * This module defines the message types and interfaces used for communication
 * between the main thread and worker threads for chunk generation and mesh building.
 */

import type { BlockType, Chunk, GameConfig, Vec3 } from "../types.ts";

// Message types for different worker operations
export type WorkerMessageType =
  | "GENERATE_CHUNK"
  | "BUILD_MESH"
  | "CHUNK_READY"
  | "MESH_READY"
  | "ERROR";

// Base interface for all worker messages
export interface BaseWorkerMessage {
  id: string; // Unique identifier for tracking requests
  type: WorkerMessageType;
}

// Chunk generation request from main thread to worker
export interface ChunkGenerationRequest extends BaseWorkerMessage {
  type: "GENERATE_CHUNK";
  chunkX: number;
  chunkY: number;
  chunkZ: number;
  seed: number;
  config: GameConfig;
}

// Chunk generation response from worker to main thread
export interface ChunkGenerationResponse extends BaseWorkerMessage {
  type: "CHUNK_READY";
  chunk: SerializableChunk;
}

// Serializable version of chunk (for transferring between threads)
export interface SerializableChunk {
  position: Vec3;
  blocks: Uint8Array;
  isDirty: boolean;
}

// Mesh building request from main thread to worker
export interface MeshBuildingRequest extends BaseWorkerMessage {
  type: "BUILD_MESH";
  chunk: SerializableChunk;
  neighborChunks?: {
    [key: string]: SerializableChunk | null; // neighbor chunks for proper face culling
  };
}

// Mesh building response from worker to main thread
export interface MeshBuildingResponse extends BaseWorkerMessage {
  type: "MESH_READY";
  chunkKey: string;
  meshData: MeshData;
}

// Mesh data that can be transferred between threads
export interface MeshData {
  vertices: Float32Array;
  normals: Float32Array;
  uvs: Float32Array;
  indices: Uint32Array;
}

// Error message from worker to main thread
export interface WorkerErrorMessage extends BaseWorkerMessage {
  type: "ERROR";
  error: string;
  originalRequest?: BaseWorkerMessage;
}

// Union type of all possible worker messages
export type WorkerMessage =
  | ChunkGenerationRequest
  | ChunkGenerationResponse
  | MeshBuildingRequest
  | MeshBuildingResponse
  | WorkerErrorMessage;

// Worker pool configuration
export interface WorkerPoolConfig {
  maxWorkers?: number; // Maximum number of workers (defaults to navigator.hardwareConcurrency)
  chunkWorkers?: number; // Number of workers dedicated to chunk generation
  meshWorkers?: number; // Number of workers dedicated to mesh building
}

// Task priority levels for the worker pool
export enum TaskPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  URGENT = 3,
}

// Task wrapper for queuing
export interface WorkerTask {
  id: string;
  message: WorkerMessage;
  priority: TaskPriority;
  resolve: (result: any) => void;
  reject: (error: Error) => void;
  timestamp: number;
}

// Worker pool statistics for performance monitoring
export interface WorkerPoolStats {
  totalWorkers: number;
  activeWorkers: number;
  queuedTasks: number;
  completedTasks: number;
  failedTasks: number;
  averageTaskTime: number;
}
