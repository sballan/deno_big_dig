import { Mat4 } from "../math.ts";
import { BlockType, Camera, Chunk, CHUNK_SIZE, Vec3 } from "../types.ts";
import { createShaderProgram } from "./shaders.ts";
import { BlockMesh } from "./mesh.ts";
import { TextureAtlas } from "./texture.ts";
import { Sun } from "./sun.ts";
import { Stars } from "./stars.ts";

export class Renderer {
  private gl: WebGL2RenderingContext;
  private shaderProgram: WebGLProgram;
  private projectionMatrix: Mat4;
  private viewMatrix: Mat4;
  private blockMesh: BlockMesh;
  private chunkMeshes: Map<
    string,
    { vao: WebGLVertexArrayObject; vertexCount: number }
  >;
  private textureAtlas: TextureAtlas;
  private sun: Sun;
  private stars: Stars;

  /**
   * Initializes WebGL2 renderer with shader programs and mesh systems
   */
  constructor(canvas: HTMLCanvasElement) {
    const gl = canvas.getContext("webgl2");
    if (!gl) {
      throw new Error("WebGL2 not supported");
    }
    this.gl = gl;

    this.shaderProgram = createShaderProgram(gl);
    this.projectionMatrix = new Mat4();
    this.viewMatrix = new Mat4();
    this.blockMesh = new BlockMesh(gl, this.shaderProgram);
    this.chunkMeshes = new Map();
    this.textureAtlas = new TextureAtlas(gl);
    this.sun = new Sun(gl);
    this.stars = new Stars(gl);

    this.setupGL();
  }

  /**
   * Configures WebGL state for 3D rendering
   * Enables depth testing and back-face culling
   */
  private setupGL(): void {
    const gl = this.gl;

    gl.enable(gl.DEPTH_TEST);
    // Re-enable face culling with corrected vertex winding
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);

    gl.clearColor(0.4, 0.6, 0.8, 1.0);
  }

  /**
   * Updates viewport dimensions when canvas is resized
   */
  resize(width: number, height: number): void {
    this.gl.viewport(0, 0, width, height);
  }

  /**
   * Clears the color and depth buffers for new frame
   */
  clear(): void {
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
  }

  /**
   * Updates projection and view matrices from camera settings
   * Creates perspective projection and look-at view matrix
   */
  setCamera(camera: Camera): void {
    this.projectionMatrix = Mat4.perspective(
      camera.fov,
      camera.aspect,
      camera.near,
      camera.far,
    );

    const target: Vec3 = {
      x: camera.position.x -
        Math.sin(camera.rotation.y) * Math.cos(camera.rotation.x),
      y: camera.position.y + Math.sin(camera.rotation.x),
      z: camera.position.z -
        Math.cos(camera.rotation.y) * Math.cos(camera.rotation.x),
    };

    this.viewMatrix = Mat4.lookAt(
      camera.position,
      target,
      { x: 0, y: 1, z: 0 },
    );
  }

  /**
   * Builds optimized mesh for a chunk by combining visible block faces
   * Only renders faces that are exposed to air
   */
  buildChunkMesh(chunk: Chunk): void {
    const chunkKey =
      `${chunk.position.x},${chunk.position.y},${chunk.position.z}`;

    const vertices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let y = 0; y < CHUNK_SIZE; y++) {
        for (let z = 0; z < CHUNK_SIZE; z++) {
          const index = x + y * CHUNK_SIZE + z * CHUNK_SIZE * CHUNK_SIZE;
          const blockType = chunk.blocks[index];

          if (blockType === BlockType.AIR) continue;

          const worldPos: Vec3 = {
            x: chunk.position.x * CHUNK_SIZE + x,
            y: chunk.position.y * CHUNK_SIZE + y,
            z: chunk.position.z * CHUNK_SIZE + z,
          };

          this.addBlockToMesh(
            blockType,
            worldPos,
            chunk,
            { x, y, z },
            vertices,
            normals,
            uvs,
            indices,
          );
        }
      }
    }

    if (vertices.length === 0) return;

    const gl = this.gl;
    const vao = gl.createVertexArray();
    if (!vao) return;

    gl.bindVertexArray(vao);

    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
    gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(0);

    const nbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, nbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(normals), gl.STATIC_DRAW);
    gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(1);

    const tbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, tbo);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uvs), gl.STATIC_DRAW);
    gl.vertexAttribPointer(2, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(2);

    const ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
    gl.bufferData(
      gl.ELEMENT_ARRAY_BUFFER,
      new Uint32Array(indices),
      gl.STATIC_DRAW,
    );

    gl.bindVertexArray(null);

    const existingMesh = this.chunkMeshes.get(chunkKey);
    if (existingMesh) {
      gl.deleteVertexArray(existingMesh.vao);
    }

    this.chunkMeshes.set(chunkKey, { vao, vertexCount: indices.length });
    chunk.isDirty = false;
  }

  /**
   * Adds a single block's visible faces to the chunk mesh
   * Culls faces that are hidden by adjacent blocks
   */
  private addBlockToMesh(
    blockType: BlockType,
    worldPos: Vec3,
    chunk: Chunk,
    localPos: Vec3,
    vertices: number[],
    normals: number[],
    uvs: number[],
    indices: number[],
  ): void {
    const _baseIndex = vertices.length / 3;

    const faces = [
      {
        normal: [0, 1, 0],
        vertices: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]],
      }, // top - counter-clockwise when viewed from above
      {
        normal: [0, -1, 0],
        vertices: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]],
      }, // bottom - counter-clockwise when viewed from below
      {
        normal: [0, 0, 1],
        vertices: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]],
      }, // front - counter-clockwise when viewed from front
      {
        normal: [0, 0, -1],
        vertices: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]],
      }, // back - counter-clockwise when viewed from back
      {
        normal: [1, 0, 0],
        vertices: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]],
      }, // right - counter-clockwise when viewed from right
      {
        normal: [-1, 0, 0],
        vertices: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]],
      }, // left - counter-clockwise when viewed from left
    ];

    const textureCoords = this.getTextureCoords(blockType);

    faces.forEach((face, faceIndex) => {
      if (this.shouldRenderFace(chunk, localPos, face.normal)) {
        const faceBaseIndex = vertices.length / 3;

        face.vertices.forEach((vertex) => {
          vertices.push(
            worldPos.x + vertex[0],
            worldPos.y + vertex[1],
            worldPos.z + vertex[2],
          );
          normals.push(...face.normal);
        });

        uvs.push(...textureCoords[faceIndex]);

        indices.push(
          faceBaseIndex,
          faceBaseIndex + 1,
          faceBaseIndex + 2,
          faceBaseIndex,
          faceBaseIndex + 2,
          faceBaseIndex + 3,
        );
      }
    });
  }

  /**
   * Determines if a block face should be rendered
   * Face is visible if adjacent block is air or transparent
   */
  private shouldRenderFace(chunk: Chunk, pos: Vec3, normal: number[]): boolean {
    const nx = pos.x + normal[0];
    const ny = pos.y + normal[1];
    const nz = pos.z + normal[2];

    // For faces at chunk boundaries, we need to check adjacent chunks
    // For now, assume chunk boundaries have air and render all boundary faces
    if (
      nx < 0 || nx >= CHUNK_SIZE || ny < 0 || ny >= CHUNK_SIZE || nz < 0 ||
      nz >= CHUNK_SIZE
    ) {
      // Render all faces at chunk boundaries for now
      // TODO: Implement proper inter-chunk face culling
      return true;
    }

    const index = nx + ny * CHUNK_SIZE + nz * CHUNK_SIZE * CHUNK_SIZE;
    const adjacentBlock = chunk.blocks[index];

    // Render face if adjacent block is air or transparent
    return adjacentBlock === BlockType.AIR ||
      this.isTransparentBlock(adjacentBlock);
  }

  /**
   * Checks if a block type is transparent (doesn't occlude faces)
   */
  private isTransparentBlock(blockType: BlockType): boolean {
    return blockType === BlockType.AIR || blockType === BlockType.WATER ||
      blockType === BlockType.LEAVES;
  }

  /**
   * Returns UV coordinates for block textures
   * Uses a texture atlas with 4x4 grid (16 textures)
   * Each face can have different texture coords for variety
   */
  private getTextureCoords(blockType: BlockType): number[][] {
    const textureSize = 0.25; // 4x4 atlas = 0.25 per texture

    // Get base texture coordinates for this block type
    const getTextureUV = (textureIndex: number): number[] => {
      const u = (textureIndex % 4) * textureSize;
      const v = Math.floor(textureIndex / 4) * textureSize;
      return [
        u,
        v + textureSize,
        u + textureSize,
        v + textureSize,
        u + textureSize,
        v,
        u,
        v,
      ];
    };

    switch (blockType) {
      case BlockType.GRASS:
        return [
          getTextureUV(0), // top - grass texture
          getTextureUV(2), // bottom - dirt texture
          getTextureUV(1), // front - grass side
          getTextureUV(1), // back - grass side
          getTextureUV(1), // right - grass side
          getTextureUV(1), // left - grass side
        ];

      case BlockType.DIRT: {
        const dirtUV = getTextureUV(2);
        return [dirtUV, dirtUV, dirtUV, dirtUV, dirtUV, dirtUV];
      }

      case BlockType.STONE: {
        const stoneUV = getTextureUV(3);
        return [stoneUV, stoneUV, stoneUV, stoneUV, stoneUV, stoneUV];
      }

      case BlockType.WOOD:
        return [
          getTextureUV(5), // top - wood rings
          getTextureUV(5), // bottom - wood rings
          getTextureUV(4), // front - wood bark
          getTextureUV(4), // back - wood bark
          getTextureUV(4), // right - wood bark
          getTextureUV(4), // left - wood bark
        ];

      case BlockType.LEAVES: {
        const leavesUV = getTextureUV(6);
        return [leavesUV, leavesUV, leavesUV, leavesUV, leavesUV, leavesUV];
      }

      case BlockType.SAND: {
        const sandUV = getTextureUV(7);
        return [sandUV, sandUV, sandUV, sandUV, sandUV, sandUV];
      }

      case BlockType.COBBLESTONE: {
        const cobbleUV = getTextureUV(8);
        return [cobbleUV, cobbleUV, cobbleUV, cobbleUV, cobbleUV, cobbleUV];
      }

      case BlockType.PLANKS: {
        const planksUV = getTextureUV(9);
        return [planksUV, planksUV, planksUV, planksUV, planksUV, planksUV];
      }

      default: {
        // Default texture
        const defaultUV = getTextureUV(10);
        return [
          defaultUV,
          defaultUV,
          defaultUV,
          defaultUV,
          defaultUV,
          defaultUV,
        ];
      }
    }
  }

  /**
   * Renders all chunk meshes with current camera settings
   * Applies projection, view, and model matrices to shader
   */
  renderChunks(): void {
    const gl = this.gl;

    gl.useProgram(this.shaderProgram);

    // Bind texture atlas
    this.textureAtlas.bind();

    // Set texture uniform
    const textureLoc = gl.getUniformLocation(this.shaderProgram, "uTexture");
    gl.uniform1i(textureLoc, 0);

    const projLoc = gl.getUniformLocation(
      this.shaderProgram,
      "uProjectionMatrix",
    );
    const viewLoc = gl.getUniformLocation(this.shaderProgram, "uViewMatrix");
    const modelLoc = gl.getUniformLocation(this.shaderProgram, "uModelMatrix");

    gl.uniformMatrix4fv(projLoc, false, this.projectionMatrix.data);
    gl.uniformMatrix4fv(viewLoc, false, this.viewMatrix.data);

    const modelMatrix = new Mat4();
    gl.uniformMatrix4fv(modelLoc, false, modelMatrix.data);

    for (const [_, mesh] of this.chunkMeshes) {
      gl.bindVertexArray(mesh.vao);
      gl.drawElements(gl.TRIANGLES, mesh.vertexCount, gl.UNSIGNED_INT, 0);
    }

    gl.bindVertexArray(null);
  }

  /**
   * Renders the sun in the sky
   */
  renderSun(timeOfDay: number): void {
    // Update lighting direction based on sun position
    const sunPos = this.sun.getSunPosition(timeOfDay);
    const sunDir = {
      x: -sunPos.x,
      y: -sunPos.y,
      z: -sunPos.z,
    };
    const length = Math.sqrt(
      sunDir.x * sunDir.x + sunDir.y * sunDir.y + sunDir.z * sunDir.z,
    );
    sunDir.x /= length;
    sunDir.y /= length;
    sunDir.z /= length;

    // Calculate sun's vertical position for smooth transitions
    const sunAngle = timeOfDay * Math.PI * 2;
    const sunHeight = Math.sin(sunAngle); // -1 (midnight) to 1 (noon)

    // Calculate ambient light and sky color with smooth transitions
    let ambientIntensity: number;
    let skyColor: { r: number; g: number; b: number };
    let diffuseIntensity: number;

    if (sunHeight < -0.2) {
      // Full night (sun well below horizon)
      ambientIntensity = 0.05;
      diffuseIntensity = 0.0;
      skyColor = { r: 0.02, g: 0.02, b: 0.08 }; // Very dark blue night sky
    } else if (sunHeight < 0.0) {
      // Sunset/sunrise transition (sun just below horizon)
      const t = (sunHeight + 0.2) / 0.2; // 0 to 1 as sun approaches horizon
      ambientIntensity = 0.05 + t * 0.15;
      diffuseIntensity = t * 0.3;
      // Gradient from night to sunset colors
      skyColor = {
        r: 0.02 + t * 0.48,
        g: 0.02 + t * 0.28,
        b: 0.08 + t * 0.22,
      };
    } else if (sunHeight < 0.2) {
      // Dawn/dusk (sun near horizon)
      const t = sunHeight / 0.2; // 0 to 1 as sun rises
      ambientIntensity = 0.2 + t * 0.1;
      diffuseIntensity = 0.3 + t * 0.3;
      // Gradient from sunset to morning colors
      skyColor = {
        r: 0.5 - t * 0.2,
        g: 0.3 + t * 0.2,
        b: 0.3 + t * 0.4,
      };
    } else {
      // Full day (sun well above horizon)
      ambientIntensity = 0.3;
      diffuseIntensity = 0.6 + sunHeight * 0.2; // Brightest at noon
      skyColor = { r: 0.3, g: 0.5, b: 0.7 }; // Blue day sky
    }

    // Update sky/fog color
    this.gl.clearColor(skyColor.r, skyColor.g, skyColor.b, 1.0);

    // Update the light direction, ambient, and fog uniforms in the main shader
    this.gl.useProgram(this.shaderProgram);
    const lightDirLoc = this.gl.getUniformLocation(
      this.shaderProgram,
      "uLightDirection",
    );
    const ambientLoc = this.gl.getUniformLocation(
      this.shaderProgram,
      "uAmbientLight",
    );
    const fogColorLoc = this.gl.getUniformLocation(
      this.shaderProgram,
      "uFogColor",
    );
    const diffuseLoc = this.gl.getUniformLocation(
      this.shaderProgram,
      "uDiffuseIntensity",
    );

    this.gl.uniform3f(lightDirLoc, sunDir.x, sunDir.y, sunDir.z);
    this.gl.uniform3f(
      ambientLoc,
      ambientIntensity,
      ambientIntensity,
      ambientIntensity * 1.1,
    );
    this.gl.uniform3f(fogColorLoc, skyColor.r, skyColor.g, skyColor.b);
    this.gl.uniform1f(diffuseLoc, diffuseIntensity);

    // Calculate star visibility based on sun height
    let starVisibility = 0.0;
    if (sunHeight < -0.1) {
      // Stars fully visible when sun is well below horizon
      starVisibility = 1.0;
    } else if (sunHeight < 0.1) {
      // Stars fade in/out near horizon
      starVisibility = 1.0 - ((sunHeight + 0.1) / 0.2);
    }

    // Render stars first (behind everything)
    if (starVisibility > 0) {
      this.stars.render(this.projectionMatrix, this.viewMatrix, starVisibility);
    }

    // Render the sun itself
    this.sun.render(this.projectionMatrix, this.viewMatrix, timeOfDay);
  }

  /**
   * Cleans up all WebGL resources
   */
  dispose(): void {
    const gl = this.gl;

    for (const [_, mesh] of this.chunkMeshes) {
      gl.deleteVertexArray(mesh.vao);
    }

    this.chunkMeshes.clear();
    this.blockMesh.dispose();
    this.textureAtlas.dispose();
    this.sun.dispose();
    this.stars.dispose();
    gl.deleteProgram(this.shaderProgram);
  }
}
