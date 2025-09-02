import { BlockType, Player, ToolType, Vec2, Vec3 } from "./types.ts";
import { Controls } from "./controls.ts";
import { add, scale } from "./math.ts";

export class PlayerController {
  public player: Player;
  private controls: Controls;
  private gravity: number = -30;
  private jumpVelocity: number = 12;
  private moveSpeed: number = 10;
  private mouseSensitivity: number = 0.002;
  private onGround: boolean = false;

  /**
   * Creates a new player controller with initial position and inventory
   */
  constructor(controls: Controls, startPosition: Vec3) {
    this.controls = controls;
    this.player = {
      position: { ...startPosition },
      rotation: { x: 0, y: 0 },
      velocity: { x: 0, y: 0, z: 0 },
      selectedTool: {
        type: ToolType.HAND,
        durability: 100,
        maxDurability: 100,
      },
      inventory: [
        { blockType: BlockType.STONE, count: 64 },
        { blockType: BlockType.DIRT, count: 64 },
        { blockType: BlockType.GRASS, count: 64 },
        { blockType: BlockType.WOOD, count: 64 },
        { blockType: BlockType.PLANKS, count: 64 },
      ],
    };
  }

  /**
   * Updates player state including rotation and movement
   * Applies physics and collision detection
   */
  update(deltaTime: number, checkCollision: (pos: Vec3) => boolean): void {
    this.updateRotation();
    this.updateMovement(deltaTime, checkCollision);
  }

  /**
   * Updates player camera rotation based on mouse movement
   * Clamps vertical rotation to prevent over-rotation
   */
  private updateRotation(): void {
    const mouseMovement = this.controls.getMouseMovement();

    this.player.rotation.y -= mouseMovement.x * this.mouseSensitivity;
    this.player.rotation.x -= mouseMovement.y * this.mouseSensitivity;

    this.player.rotation.x = Math.max(
      -Math.PI / 2,
      Math.min(Math.PI / 2, this.player.rotation.x),
    );

    while (this.player.rotation.y < 0) this.player.rotation.y += Math.PI * 2;
    while (this.player.rotation.y >= Math.PI * 2) {
      this.player.rotation.y -= Math.PI * 2;
    }
  }

  /**
   * Checks if the player should be on the ground by testing slightly below current position
   */
  private checkGroundBelow(checkCollision: (pos: Vec3) => boolean): boolean {
    const testPos: Vec3 = {
      x: this.player.position.x,
      y: this.player.position.y - 0.1, // Test slightly below current position
      z: this.player.position.z,
    };
    return checkCollision(testPos);
  }

  /**
   * Handles player movement including walking, jumping, and gravity
   * Applies collision detection for each axis separately
   */
  private updateMovement(
    deltaTime: number,
    checkCollision: (pos: Vec3) => boolean,
  ): void {
    // Check if player should still be on ground (in case blocks were destroyed)
    if (this.onGround && !this.checkGroundBelow(checkCollision)) {
      this.onGround = false;
    }

    const movement = this.controls.getMovementVector();

    const forward: Vec3 = {
      x: -Math.sin(this.player.rotation.y),
      y: 0,
      z: -Math.cos(this.player.rotation.y),
    };

    const right: Vec3 = {
      x: -Math.sin(this.player.rotation.y - Math.PI / 2),
      y: 0,
      z: -Math.cos(this.player.rotation.y - Math.PI / 2),
    };

    const moveVector = add(
      scale(forward, movement.z * this.moveSpeed),
      scale(right, movement.x * this.moveSpeed),
    );

    this.player.velocity.x = moveVector.x;
    this.player.velocity.z = moveVector.z;

    if (this.onGround && this.controls.isKeyPressed("Space")) {
      this.player.velocity.y = this.jumpVelocity;
      this.onGround = false;
    }

    if (!this.onGround) {
      this.player.velocity.y += this.gravity * deltaTime;
    }

    const newPosition: Vec3 = { ...this.player.position };

    newPosition.x = this.player.position.x + this.player.velocity.x * deltaTime;
    if (!checkCollision(newPosition)) {
      this.player.position.x = newPosition.x;
    } else {
      this.player.velocity.x = 0;
    }

    newPosition.x = this.player.position.x;
    newPosition.y = this.player.position.y + this.player.velocity.y * deltaTime;
    if (!checkCollision(newPosition)) {
      this.player.position.y = newPosition.y;
      // If we successfully moved downward, we're no longer on ground
      if (this.player.velocity.y < 0) {
        this.onGround = false;
      }
    } else {
      // We hit something - if we were moving down, we're now on ground
      if (this.player.velocity.y < 0) {
        this.onGround = true;
      }
      this.player.velocity.y = 0;
    }

    newPosition.y = this.player.position.y;
    newPosition.z = this.player.position.z + this.player.velocity.z * deltaTime;
    if (!checkCollision(newPosition)) {
      this.player.position.z = newPosition.z;
    } else {
      this.player.velocity.z = 0;
    }
  }

  /**
   * Returns camera position and rotation for rendering
   * Camera is positioned at eye height above player position
   */
  getCamera(): { position: Vec3; rotation: Vec2 } {
    const eyeHeight = 1.7;
    return {
      position: {
        x: this.player.position.x,
        y: this.player.position.y + eyeHeight,
        z: this.player.position.z,
      },
      rotation: this.player.rotation,
    };
  }

  /**
   * Changes the currently selected tool
   */
  selectTool(toolType: ToolType): void {
    this.player.selectedTool = {
      type: toolType,
      durability: 100,
      maxDurability: 100,
    };
  }

  /**
   * Returns the currently selected block type from inventory
   * Returns null if inventory is empty
   */
  getSelectedBlockType(): BlockType | null {
    if (this.player.inventory.length > 0) {
      return this.player.inventory[0].blockType;
    }
    return null;
  }

  /**
   * Sets the selected block type and moves it to front of inventory
   * Adds new block type to inventory if not present
   */
  setSelectedBlock(blockType: BlockType): void {
    const inventoryItem = this.player.inventory.find((item) =>
      item.blockType === blockType
    );
    if (inventoryItem) {
      this.player.inventory = [
        inventoryItem,
        ...this.player.inventory.filter((item) => item.blockType !== blockType),
      ];
    } else {
      this.player.inventory = [
        { blockType, count: 64 },
        ...this.player.inventory,
      ];
    }
  }
}
