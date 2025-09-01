import { Player, Vec3, Vec2, ToolType, BlockType } from "./types.ts";
import { Controls } from "./controls.ts";
import { add, scale } from "./math.ts";

export class PlayerController {
  public player: Player;
  private controls: Controls;
  private gravity: number = -30;
  private jumpVelocity: number = 10;
  private moveSpeed: number = 5;
  private mouseSensitivity: number = 0.002;
  private onGround: boolean = false;

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

  update(deltaTime: number, checkCollision: (pos: Vec3) => boolean): void {
    this.updateRotation();
    this.updateMovement(deltaTime, checkCollision);
  }

  private updateRotation(): void {
    const mouseMovement = this.controls.getMouseMovement();
    
    this.player.rotation.y -= mouseMovement.x * this.mouseSensitivity;
    this.player.rotation.x -= mouseMovement.y * this.mouseSensitivity;
    
    this.player.rotation.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, this.player.rotation.x));
    
    while (this.player.rotation.y < 0) this.player.rotation.y += Math.PI * 2;
    while (this.player.rotation.y >= Math.PI * 2) this.player.rotation.y -= Math.PI * 2;
  }

  private updateMovement(deltaTime: number, checkCollision: (pos: Vec3) => boolean): void {
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
      scale(right, movement.x * this.moveSpeed)
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
    
    const newPosition = { ...this.player.position };
    
    newPosition.x += this.player.velocity.x * deltaTime;
    if (!checkCollision(newPosition)) {
      this.player.position.x = newPosition.x;
    }
    
    newPosition.y += this.player.velocity.y * deltaTime;
    if (!checkCollision(newPosition)) {
      this.player.position.y = newPosition.y;
    } else {
      if (this.player.velocity.y < 0) {
        this.onGround = true;
      }
      this.player.velocity.y = 0;
    }
    
    newPosition.z += this.player.velocity.z * deltaTime;
    if (!checkCollision(newPosition)) {
      this.player.position.z = newPosition.z;
    }
  }

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

  selectTool(toolType: ToolType): void {
    this.player.selectedTool = {
      type: toolType,
      durability: 100,
      maxDurability: 100,
    };
  }

  getSelectedBlockType(): BlockType | null {
    if (this.player.inventory.length > 0) {
      return this.player.inventory[0].blockType;
    }
    return null;
  }
}