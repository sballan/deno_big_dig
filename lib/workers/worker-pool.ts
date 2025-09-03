/**
 * Worker Pool Manager
 * 
 * Manages a pool of web workers for parallel chunk generation and mesh building.
 * Provides automatic load balancing, task queuing, and resource management.
 */

import type {
  WorkerMessage,
  WorkerTask,
  WorkerPoolConfig,
  WorkerPoolStats,
  TaskPriority,
  ChunkGenerationRequest,
  MeshBuildingRequest,
  SerializableChunk,
  MeshData
} from "./types.ts";

interface WorkerInfo {
  worker: Worker;
  busy: boolean;
  currentTask?: WorkerTask;
  completedTasks: number;
  totalTime: number;
}

export class WorkerPool {
  private chunkWorkers: WorkerInfo[] = [];
  private meshWorkers: WorkerInfo[] = [];
  private taskQueue: WorkerTask[] = [];
  private pendingTasks: Map<string, WorkerTask> = new Map();
  private nextTaskId = 0;
  private stats: WorkerPoolStats;

  constructor(private config: WorkerPoolConfig = {}) {
    const maxWorkers = config.maxWorkers || navigator.hardwareConcurrency || 4;
    const chunkWorkerCount = config.chunkWorkers || Math.ceil(maxWorkers * 0.6);
    const meshWorkerCount = config.meshWorkers || Math.floor(maxWorkers * 0.4);

    this.stats = {
      totalWorkers: chunkWorkerCount + meshWorkerCount,
      activeWorkers: 0,
      queuedTasks: 0,
      completedTasks: 0,
      failedTasks: 0,
      averageTaskTime: 0
    };

    this.initializeWorkers(chunkWorkerCount, meshWorkerCount);
  }

  /**
   * Initialize worker pools for chunk generation and mesh building
   */
  private initializeWorkers(chunkWorkerCount: number, meshWorkerCount: number): void {
    // Initialize chunk generation workers
    for (let i = 0; i < chunkWorkerCount; i++) {
      const worker = new Worker(
        new URL("./chunk-generator-worker.ts", import.meta.url),
        { type: "module" }
      );
      
      const workerInfo: WorkerInfo = {
        worker,
        busy: false,
        completedTasks: 0,
        totalTime: 0
      };

      worker.onmessage = (e) => this.handleWorkerMessage(workerInfo, e.data);
      worker.onerror = (e) => this.handleWorkerError(workerInfo, e);
      
      this.chunkWorkers.push(workerInfo);
    }

    // Initialize mesh building workers
    for (let i = 0; i < meshWorkerCount; i++) {
      const worker = new Worker(
        new URL("./mesh-builder-worker.ts", import.meta.url),
        { type: "module" }
      );
      
      const workerInfo: WorkerInfo = {
        worker,
        busy: false,
        completedTasks: 0,
        totalTime: 0
      };

      worker.onmessage = (e) => this.handleWorkerMessage(workerInfo, e.data);
      worker.onerror = (e) => this.handleWorkerError(workerInfo, e);
      
      this.meshWorkers.push(workerInfo);
    }
  }

  /**
   * Generate a chunk asynchronously using the worker pool
   */
  async generateChunk(
    chunkX: number,
    chunkY: number,
    chunkZ: number,
    seed: number,
    config: any,
    priority: TaskPriority = TaskPriority.NORMAL
  ): Promise<SerializableChunk> {
    const request: ChunkGenerationRequest = {
      id: this.generateTaskId(),
      type: "GENERATE_CHUNK",
      chunkX,
      chunkY,
      chunkZ,
      seed,
      config
    };

    return this.submitTask(request, priority, this.chunkWorkers);
  }

  /**
   * Build a mesh asynchronously using the worker pool
   */
  async buildMesh(
    chunk: SerializableChunk,
    neighborChunks?: { [key: string]: SerializableChunk | null },
    priority: TaskPriority = TaskPriority.NORMAL
  ): Promise<MeshData> {
    const request: MeshBuildingRequest = {
      id: this.generateTaskId(),
      type: "BUILD_MESH",
      chunk,
      neighborChunks
    };

    return this.submitTask(request, priority, this.meshWorkers);
  }

  /**
   * Submit a task to the appropriate worker pool
   */
  private submitTask<T>(
    message: WorkerMessage,
    priority: TaskPriority,
    workers: WorkerInfo[]
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const task: WorkerTask = {
        id: message.id,
        message,
        priority,
        resolve,
        reject,
        timestamp: performance.now()
      };

      this.pendingTasks.set(task.id, task);

      // Try to assign to an available worker immediately
      const availableWorker = workers.find(w => !w.busy);
      if (availableWorker) {
        this.assignTaskToWorker(task, availableWorker);
      } else {
        // Queue the task with priority ordering
        this.queueTask(task);
      }
    });
  }

  /**
   * Add task to queue maintaining priority order
   */
  private queueTask(task: WorkerTask): void {
    // Insert task in priority order (higher priority first)
    let insertIndex = this.taskQueue.length;
    for (let i = 0; i < this.taskQueue.length; i++) {
      if (this.taskQueue[i].priority < task.priority) {
        insertIndex = i;
        break;
      }
    }
    
    this.taskQueue.splice(insertIndex, 0, task);
    this.stats.queuedTasks = this.taskQueue.length;
  }

  /**
   * Assign a task to a specific worker
   */
  private assignTaskToWorker(task: WorkerTask, workerInfo: WorkerInfo): void {
    workerInfo.busy = true;
    workerInfo.currentTask = task;
    
    task.timestamp = performance.now(); // Update start time
    workerInfo.worker.postMessage(task.message);
    
    this.stats.activeWorkers++;
  }

  /**
   * Process the next queued task when a worker becomes available
   */
  private processNextTask(workerInfo: WorkerInfo): void {
    if (this.taskQueue.length === 0) return;

    // Get the highest priority task
    const task = this.taskQueue.shift()!;
    this.stats.queuedTasks = this.taskQueue.length;
    
    this.assignTaskToWorker(task, workerInfo);
  }

  /**
   * Handle messages from workers
   */
  private handleWorkerMessage(workerInfo: WorkerInfo, message: WorkerMessage): void {
    const task = workerInfo.currentTask;
    if (!task) return;

    const completionTime = performance.now() - task.timestamp;
    
    // Update worker stats
    workerInfo.busy = false;
    workerInfo.completedTasks++;
    workerInfo.totalTime += completionTime;
    workerInfo.currentTask = undefined;
    
    // Update pool stats
    this.stats.activeWorkers--;
    this.stats.completedTasks++;
    this.updateAverageTaskTime(completionTime);

    // Remove from pending tasks
    this.pendingTasks.delete(task.id);

    if (message.type === "ERROR") {
      this.stats.failedTasks++;
      task.reject(new Error(message.error || "Worker task failed"));
    } else {
      // Success - resolve with the appropriate data
      if (message.type === "CHUNK_READY") {
        task.resolve(message.chunk);
      } else if (message.type === "MESH_READY") {
        task.resolve(message.meshData);
      }
    }

    // Process next queued task
    this.processNextTask(workerInfo);
  }

  /**
   * Handle worker errors
   */
  private handleWorkerError(workerInfo: WorkerInfo, error: ErrorEvent): void {
    const task = workerInfo.currentTask;
    if (task) {
      this.stats.failedTasks++;
      task.reject(new Error(`Worker error: ${error.message}`));
      this.pendingTasks.delete(task.id);
    }

    workerInfo.busy = false;
    workerInfo.currentTask = undefined;
    this.stats.activeWorkers--;

    // Process next queued task
    this.processNextTask(workerInfo);
  }

  /**
   * Update average task completion time
   */
  private updateAverageTaskTime(newTime: number): void {
    const totalTasks = this.stats.completedTasks;
    const currentAverage = this.stats.averageTaskTime;
    
    this.stats.averageTaskTime = ((currentAverage * (totalTasks - 1)) + newTime) / totalTasks;
  }

  /**
   * Generate unique task ID
   */
  private generateTaskId(): string {
    return `task_${++this.nextTaskId}_${performance.now()}`;
  }

  /**
   * Get current worker pool statistics
   */
  getStats(): WorkerPoolStats {
    return { ...this.stats };
  }

  /**
   * Get detailed worker information for debugging
   */
  getWorkerInfo(): { chunkWorkers: WorkerInfo[], meshWorkers: WorkerInfo[] } {
    return {
      chunkWorkers: this.chunkWorkers.map(w => ({
        worker: w.worker,
        busy: w.busy,
        completedTasks: w.completedTasks,
        totalTime: w.totalTime
      })) as WorkerInfo[],
      meshWorkers: this.meshWorkers.map(w => ({
        worker: w.worker,
        busy: w.busy,
        completedTasks: w.completedTasks,
        totalTime: w.totalTime
      })) as WorkerInfo[]
    };
  }

  /**
   * Clear all queued tasks (useful when changing world position rapidly)
   */
  clearQueue(): void {
    // Reject all queued tasks
    this.taskQueue.forEach(task => {
      task.reject(new Error("Task cancelled"));
      this.pendingTasks.delete(task.id);
    });
    
    this.taskQueue = [];
    this.stats.queuedTasks = 0;
  }

  /**
   * Terminate all workers and clean up resources
   */
  dispose(): void {
    // Clear any remaining tasks
    this.clearQueue();
    
    // Reject any pending tasks
    this.pendingTasks.forEach(task => {
      task.reject(new Error("Worker pool disposed"));
    });
    this.pendingTasks.clear();

    // Terminate all workers
    [...this.chunkWorkers, ...this.meshWorkers].forEach(workerInfo => {
      workerInfo.worker.terminate();
    });

    this.chunkWorkers = [];
    this.meshWorkers = [];
  }
}