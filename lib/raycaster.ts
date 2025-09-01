import { BlockType, Vec3 } from "./types.ts";
import { World } from "./world.ts";

export class Raycaster {
  /**
   * Casts a ray from origin in direction to detect block intersections
   * Returns hit information including position, normal, and distance
   */
  static cast(
    origin: Vec3,
    direction: Vec3,
    maxDistance: number,
    world: World,
  ): { position: Vec3; normal: Vec3; distance: number } | null {
    const step = 0.01;
    const steps = Math.floor(maxDistance / step);

    let previousPos: Vec3 = { ...origin };

    for (let i = 0; i < steps; i++) {
      const distance = i * step;
      const currentPos: Vec3 = {
        x: origin.x + direction.x * distance,
        y: origin.y + direction.y * distance,
        z: origin.z + direction.z * distance,
      };

      const blockX = Math.floor(currentPos.x);
      const blockY = Math.floor(currentPos.y);
      const blockZ = Math.floor(currentPos.z);

      const block = world.getBlock(blockX, blockY, blockZ);

      if (block !== BlockType.AIR) {
        const normal = this.calculateNormal(previousPos, currentPos);

        return {
          position: { x: blockX, y: blockY, z: blockZ },
          normal,
          distance,
        };
      }

      previousPos = { ...currentPos };
    }

    return null;
  }

  /**
   * Calculates the surface normal at the point of intersection
   * Used to determine which face of the block was hit
   */
  private static calculateNormal(previous: Vec3, current: Vec3): Vec3 {
    const blockPos = {
      x: Math.floor(current.x),
      y: Math.floor(current.y),
      z: Math.floor(current.z),
    };

    const prevBlockPos = {
      x: Math.floor(previous.x),
      y: Math.floor(previous.y),
      z: Math.floor(previous.z),
    };

    const diff = {
      x: blockPos.x - prevBlockPos.x,
      y: blockPos.y - prevBlockPos.y,
      z: blockPos.z - prevBlockPos.z,
    };

    if (diff.x !== 0) return { x: -diff.x, y: 0, z: 0 };
    if (diff.y !== 0) return { x: 0, y: -diff.y, z: 0 };
    if (diff.z !== 0) return { x: 0, y: 0, z: -diff.z };

    return { x: 0, y: 1, z: 0 };
  }

  /**
   * Calculates where to place a new block based on hit position and normal
   * Places the block adjacent to the hit face
   */
  static getPlacementPosition(
    hitPosition: Vec3,
    normal: Vec3,
  ): Vec3 {
    return {
      x: hitPosition.x + normal.x,
      y: hitPosition.y + normal.y,
      z: hitPosition.z + normal.z,
    };
  }
}
