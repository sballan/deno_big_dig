/**
 * Simple texture atlas system for block textures
 * Creates a procedural 4x4 texture atlas with basic Minecraft-style block textures
 */

export class TextureAtlas {
  private gl: WebGL2RenderingContext;
  private texture: WebGLTexture | null = null;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.canvas = document.createElement("canvas");
    this.canvas.width = 256; // 4x4 grid, 64px per texture
    this.canvas.height = 256;
    const ctx = this.canvas.getContext("2d");
    if (!ctx) throw new Error("Could not create 2D context");
    this.ctx = ctx;

    this.generateTextures();
    this.createGLTexture();
  }

  /**
   * Generates procedural block textures in a 4x4 grid
   * Index mapping:
   * 0: Grass top   1: Grass side   2: Dirt        3: Stone
   * 4: Wood bark   5: Wood rings   6: Leaves      7: Sand
   * 8: Cobblestone 9: Planks      10: Default    11: Water
   * 12-15: Reserved for future textures
   */
  private generateTextures(): void {
    const tileSize = 64;

    // Helper function to draw a tile with noise
    const drawTile = (
      x: number,
      _y: number,
      baseColor: [number, number, number],
      variation: number = 20,
    ) => {
      const startX = (x % 4) * tileSize;
      const startY = Math.floor(x / 4) * tileSize;

      for (let px = 0; px < tileSize; px++) {
        for (let py = 0; py < tileSize; py++) {
          const noise = (Math.random() - 0.5) * variation;
          const r = Math.max(0, Math.min(255, baseColor[0] + noise));
          const g = Math.max(0, Math.min(255, baseColor[1] + noise));
          const b = Math.max(0, Math.min(255, baseColor[2] + noise));

          this.ctx.fillStyle = `rgb(${r},${g},${b})`;
          this.ctx.fillRect(startX + px, startY + py, 1, 1);
        }
      }
    };

    // 0: Grass top - bright green
    drawTile(0, 0, [76, 164, 76]);

    // 1: Grass side - brown/green mix
    this.drawGrassSide(1);

    // 2: Dirt - brown
    drawTile(2, 0, [134, 96, 67]);

    // 3: Stone - gray
    drawTile(3, 0, [128, 128, 128]);

    // 4: Wood bark - dark brown with vertical lines
    this.drawWoodBark(4);

    // 5: Wood rings - light brown with rings
    this.drawWoodRings(5);

    // 6: Leaves - dark green with transparency effect
    drawTile(6, 0, [48, 128, 48], 30);

    // 7: Sand - tan/yellow
    drawTile(7, 0, [194, 178, 128]);

    // 8: Cobblestone - varied gray stones
    this.drawCobblestone(8);

    // 9: Planks - light brown with horizontal lines
    this.drawPlanks(9);

    // 10: Default - magenta for debugging
    drawTile(10, 0, [255, 0, 255]);

    // 11: Water - blue with wave pattern
    this.drawWater(11);
  }

  private drawGrassSide(index: number): void {
    const tileSize = 64;
    const startX = (index % 4) * tileSize;
    const startY = Math.floor(index / 4) * tileSize;

    for (let px = 0; px < tileSize; px++) {
      for (let py = 0; py < tileSize; py++) {
        const grassHeight = 8; // Top 8 pixels are grass
        const noise = (Math.random() - 0.5) * 15;

        if (py < grassHeight) {
          // Grass part
          const r = Math.max(0, Math.min(255, 76 + noise));
          const g = Math.max(0, Math.min(255, 164 + noise));
          const b = Math.max(0, Math.min(255, 76 + noise));
          this.ctx.fillStyle = `rgb(${r},${g},${b})`;
        } else {
          // Dirt part
          const r = Math.max(0, Math.min(255, 134 + noise));
          const g = Math.max(0, Math.min(255, 96 + noise));
          const b = Math.max(0, Math.min(255, 67 + noise));
          this.ctx.fillStyle = `rgb(${r},${g},${b})`;
        }

        this.ctx.fillRect(startX + px, startY + py, 1, 1);
      }
    }
  }

  private drawWoodBark(index: number): void {
    const tileSize = 64;
    const startX = (index % 4) * tileSize;
    const startY = Math.floor(index / 4) * tileSize;

    for (let px = 0; px < tileSize; px++) {
      for (let py = 0; py < tileSize; py++) {
        const verticalPattern = Math.sin(px * 0.3) * 10;
        const noise = (Math.random() - 0.5) * 15;

        const r = Math.max(0, Math.min(255, 101 + verticalPattern + noise));
        const g = Math.max(0, Math.min(255, 67 + verticalPattern + noise));
        const b = Math.max(0, Math.min(255, 33 + verticalPattern + noise));

        this.ctx.fillStyle = `rgb(${r},${g},${b})`;
        this.ctx.fillRect(startX + px, startY + py, 1, 1);
      }
    }
  }

  private drawWoodRings(index: number): void {
    const tileSize = 64;
    const startX = (index % 4) * tileSize;
    const startY = Math.floor(index / 4) * tileSize;
    const centerX = tileSize / 2;
    const centerY = tileSize / 2;

    for (let px = 0; px < tileSize; px++) {
      for (let py = 0; py < tileSize; py++) {
        const distance = Math.sqrt((px - centerX) ** 2 + (py - centerY) ** 2);
        const ringPattern = Math.sin(distance * 0.4) * 20;
        const noise = (Math.random() - 0.5) * 10;

        const r = Math.max(0, Math.min(255, 160 + ringPattern + noise));
        const g = Math.max(0, Math.min(255, 120 + ringPattern + noise));
        const b = Math.max(0, Math.min(255, 80 + ringPattern + noise));

        this.ctx.fillStyle = `rgb(${r},${g},${b})`;
        this.ctx.fillRect(startX + px, startY + py, 1, 1);
      }
    }
  }

  private drawCobblestone(index: number): void {
    const tileSize = 64;
    const startX = (index % 4) * tileSize;
    const startY = Math.floor(index / 4) * tileSize;

    // Draw base gray
    for (let px = 0; px < tileSize; px++) {
      for (let py = 0; py < tileSize; py++) {
        const noise = (Math.random() - 0.5) * 40;
        const r = Math.max(0, Math.min(255, 100 + noise));
        const g = Math.max(0, Math.min(255, 100 + noise));
        const b = Math.max(0, Math.min(255, 100 + noise));

        this.ctx.fillStyle = `rgb(${r},${g},${b})`;
        this.ctx.fillRect(startX + px, startY + py, 1, 1);
      }
    }

    // Add some darker "stones"
    for (let i = 0; i < 12; i++) {
      const stoneX = Math.floor(Math.random() * (tileSize - 8));
      const stoneY = Math.floor(Math.random() * (tileSize - 8));
      const stoneSize = 4 + Math.floor(Math.random() * 4);

      this.ctx.fillStyle = `rgb(70,70,70)`;
      this.ctx.fillRect(startX + stoneX, startY + stoneY, stoneSize, stoneSize);
    }
  }

  private drawPlanks(index: number): void {
    const tileSize = 64;
    const startX = (index % 4) * tileSize;
    const startY = Math.floor(index / 4) * tileSize;

    for (let px = 0; px < tileSize; px++) {
      for (let py = 0; py < tileSize; py++) {
        const horizontalPattern = Math.sin(py * 0.2) * 5;
        const noise = (Math.random() - 0.5) * 10;

        const r = Math.max(0, Math.min(255, 180 + horizontalPattern + noise));
        const g = Math.max(0, Math.min(255, 140 + horizontalPattern + noise));
        const b = Math.max(0, Math.min(255, 100 + horizontalPattern + noise));

        this.ctx.fillStyle = `rgb(${r},${g},${b})`;
        this.ctx.fillRect(startX + px, startY + py, 1, 1);
      }
    }

    // Add plank separation lines
    for (let i = 1; i < 4; i++) {
      const y = (i * tileSize) / 4;
      this.ctx.fillStyle = "rgb(120,90,60)";
      this.ctx.fillRect(startX, startY + y, tileSize, 1);
    }
  }

  private drawWater(index: number): void {
    const tileSize = 64;
    const startX = (index % 4) * tileSize;
    const startY = Math.floor(index / 4) * tileSize;

    for (let px = 0; px < tileSize; px++) {
      for (let py = 0; py < tileSize; py++) {
        const wave = Math.sin(px * 0.1 + py * 0.1) * 10;
        const noise = (Math.random() - 0.5) * 8;

        const r = Math.max(0, Math.min(255, 50 + wave + noise));
        const g = Math.max(0, Math.min(255, 100 + wave + noise));
        const b = Math.max(0, Math.min(255, 200 + wave + noise));

        this.ctx.fillStyle = `rgb(${r},${g},${b})`;
        this.ctx.fillRect(startX + px, startY + py, 1, 1);
      }
    }
  }

  private createGLTexture(): void {
    const gl = this.gl;

    this.texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, this.texture);

    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      this.canvas,
    );

    // Use nearest filtering for pixelated look
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
  }

  /**
   * Binds the texture atlas for rendering
   */
  bind(): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
  }

  /**
   * Cleanup WebGL resources
   */
  dispose(): void {
    if (this.texture) {
      this.gl.deleteTexture(this.texture);
      this.texture = null;
    }
  }
}
