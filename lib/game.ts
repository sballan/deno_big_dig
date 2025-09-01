import { Renderer } from "./webgl/renderer.ts";
import { World } from "./world.ts";
import { PlayerController } from "./player.ts";
import { Controls } from "./controls.ts";
import { Raycaster } from "./raycaster.ts";
import { BlockType, Camera, RENDER_DISTANCE, Vec3 } from "./types.ts";

export class Game {
  private canvas: HTMLCanvasElement;
  private renderer: Renderer;
  private world: World;
  private player: PlayerController;
  private controls: Controls;
  private camera: Camera;
  private lastTime: number;
  private isRunning: boolean;
  private selectedBlock: Vec3 | null = null;

  /**
   * Initializes the game engine with all required components
   * Sets up renderer, world generation, player controls, and camera
   */
  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new Renderer(canvas);
    this.world = new World();
    this.controls = new Controls(canvas);
    this.player = new PlayerController(this.controls, { x: 0, y: 25, z: 0 });

    this.camera = {
      position: { x: 0, y: 25, z: 0 },
      rotation: { x: 0, y: 0 },
      fov: Math.PI / 3,
      aspect: canvas.width / canvas.height,
      near: 0.1,
      far: 150,
    };

    this.lastTime = performance.now();
    this.isRunning = false;

    this.setupCanvas();
    this.handleInteraction();
  }

  /**
   * Sets up canvas resizing to maintain full window coverage
   * Updates camera aspect ratio when window is resized
   */
  private setupCanvas(): void {
    const resizeCanvas = () => {
      this.canvas.width = globalThis.innerWidth;
      this.canvas.height = globalThis.innerHeight;
      this.camera.aspect = this.canvas.width / this.canvas.height;
      this.renderer.resize(this.canvas.width, this.canvas.height);
    };

    resizeCanvas();
    globalThis.addEventListener("resize", resizeCanvas);
  }

  /**
   * Sets up mouse click handlers for block breaking (left click) and block placing (right click)
   * Uses raycasting to detect which block the player is looking at
   */
  private handleInteraction(): void {
    this.canvas.addEventListener("click", (e) => {
      if (!this.controls.isPointerLocked()) return;

      if (e.button === 0) {
        const playerCamera = this.player.getCamera();
        const direction: Vec3 = {
          x: -Math.sin(playerCamera.rotation.y) *
            Math.cos(playerCamera.rotation.x),
          y: Math.sin(playerCamera.rotation.x),
          z: -Math.cos(playerCamera.rotation.y) *
            Math.cos(playerCamera.rotation.x),
        };

        const hit = Raycaster.cast(
          playerCamera.position,
          direction,
          5,
          this.world,
        );

        if (hit) {
          this.world.setBlock(
            hit.position.x,
            hit.position.y,
            hit.position.z,
            BlockType.AIR,
          );
        }
      }
    });

    this.canvas.addEventListener("contextmenu", (e) => {
      e.preventDefault();

      if (!this.controls.isPointerLocked()) return;

      const playerCamera = this.player.getCamera();
      const direction: Vec3 = {
        x: -Math.sin(playerCamera.rotation.y) *
          Math.cos(playerCamera.rotation.x),
        y: Math.sin(playerCamera.rotation.x),
        z: -Math.cos(playerCamera.rotation.y) *
          Math.cos(playerCamera.rotation.x),
      };

      const hit = Raycaster.cast(
        playerCamera.position,
        direction,
        5,
        this.world,
      );

      if (hit) {
        const placePos = Raycaster.getPlacementPosition(
          hit.position,
          hit.normal,
        );
        const selectedBlock = this.player.getSelectedBlockType();

        if (selectedBlock !== null && !this.world.checkCollision(placePos)) {
          this.world.setBlock(
            placePos.x,
            placePos.y,
            placePos.z,
            selectedBlock,
          );
        }
      }
    });
  }

  /**
   * Starts the game loop and generates initial world chunks around the player
   */
  start(): void {
    this.isRunning = true;
    this.world.generateAroundPosition(
      this.player.player.position,
      RENDER_DISTANCE,
    );
    this.gameLoop();
  }

  /**
   * Stops the game loop
   */
  stop(): void {
    this.isRunning = false;
  }

  /**
   * Main game loop that runs every frame
   * Updates game state and renders the scene
   */
  private gameLoop = (): void => {
    if (!this.isRunning) return;

    const currentTime = performance.now();
    const deltaTime = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;

    this.update(deltaTime);
    this.render();

    requestAnimationFrame(this.gameLoop);
  };

  /**
   * Updates game state each frame
   * Handles player movement, world generation, and block selection highlighting
   */
  private update(deltaTime: number): void {
    this.player.update(deltaTime, (pos) => this.world.checkCollision(pos));

    const playerCamera = this.player.getCamera();
    this.camera.position = playerCamera.position;
    this.camera.rotation = playerCamera.rotation;

    this.world.generateAroundPosition(
      this.player.player.position,
      RENDER_DISTANCE,
    );

    const direction: Vec3 = {
      x: -Math.sin(playerCamera.rotation.y) * Math.cos(playerCamera.rotation.x),
      y: Math.sin(playerCamera.rotation.x),
      z: -Math.cos(playerCamera.rotation.y) * Math.cos(playerCamera.rotation.x),
    };

    const hit = Raycaster.cast(playerCamera.position, direction, 5, this.world);
    this.selectedBlock = hit ? hit.position : null;
  }

  /**
   * Renders the current game state to the canvas
   * Builds chunk meshes if needed and renders all visible chunks
   */
  private render(): void {
    this.renderer.clear();
    this.renderer.setCamera(this.camera);

    const chunks = this.world.getChunks();
    for (const chunk of chunks) {
      if (chunk.isDirty) {
        this.renderer.buildChunkMesh(chunk);
      }
    }

    this.renderer.renderChunks();
  }

  /**
   * Sets the currently selected block type for placement
   */
  setSelectedBlock(blockType: BlockType): void {
    this.player.setSelectedBlock(blockType);
  }

  /**
   * Cleans up all resources when the game is destroyed
   */
  dispose(): void {
    this.stop();
    this.controls.dispose();
    this.renderer.dispose();
  }
}
