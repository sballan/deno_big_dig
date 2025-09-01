import { Vec2, Vec3 } from "./types.ts";

export class Controls {
  private keys: Set<string>;
  private mouseMovement: Vec2;
  private mouseDown: boolean;
  private pointerLocked: boolean;
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.keys = new Set();
    this.mouseMovement = { x: 0, y: 0 };
    this.mouseDown = false;
    this.pointerLocked = false;
    this.canvas = canvas;
    
    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    document.addEventListener("keydown", (e) => {
      this.keys.add(e.code);
      
      if (e.code === "Tab") {
        e.preventDefault();
      }
    });

    document.addEventListener("keyup", (e) => {
      this.keys.delete(e.code);
    });

    this.canvas.addEventListener("click", () => {
      if (!this.pointerLocked) {
        this.canvas.requestPointerLock();
      }
    });

    document.addEventListener("pointerlockchange", () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
    });

    document.addEventListener("mousemove", (e) => {
      if (this.pointerLocked) {
        this.mouseMovement.x += e.movementX;
        this.mouseMovement.y += e.movementY;
      }
    });

    this.canvas.addEventListener("mousedown", (e) => {
      if (e.button === 0) {
        this.mouseDown = true;
      }
    });

    this.canvas.addEventListener("mouseup", (e) => {
      if (e.button === 0) {
        this.mouseDown = false;
      }
    });

    window.addEventListener("blur", () => {
      this.keys.clear();
      this.mouseDown = false;
    });
  }

  isKeyPressed(key: string): boolean {
    return this.keys.has(key);
  }

  getMovementVector(): Vec3 {
    const movement: Vec3 = { x: 0, y: 0, z: 0 };
    
    if (this.isKeyPressed("KeyW")) movement.z += 1;
    if (this.isKeyPressed("KeyS")) movement.z -= 1;
    if (this.isKeyPressed("KeyA")) movement.x -= 1;
    if (this.isKeyPressed("KeyD")) movement.x += 1;
    if (this.isKeyPressed("Space")) movement.y += 1;
    if (this.isKeyPressed("ShiftLeft")) movement.y -= 1;
    
    const length = Math.sqrt(movement.x * movement.x + movement.z * movement.z);
    if (length > 0) {
      movement.x /= length;
      movement.z /= length;
    }
    
    return movement;
  }

  getMouseMovement(): Vec2 {
    const movement = { ...this.mouseMovement };
    this.mouseMovement = { x: 0, y: 0 };
    return movement;
  }

  isMouseDown(): boolean {
    return this.mouseDown;
  }

  isPointerLocked(): boolean {
    return this.pointerLocked;
  }

  dispose(): void {
    this.keys.clear();
    if (this.pointerLocked) {
      document.exitPointerLock();
    }
  }
}