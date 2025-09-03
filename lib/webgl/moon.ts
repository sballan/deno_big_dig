import { Mat4 } from "../math.ts";
import { Vec3 } from "../types.ts";

export class Moon {
  private gl: WebGL2RenderingContext;
  private vao: WebGLVertexArrayObject | null;
  private vertexBuffer: WebGLBuffer | null;
  private indexBuffer: WebGLBuffer | null;
  private indexCount: number;
  private shaderProgram: WebGLProgram | null;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.vao = null;
    this.vertexBuffer = null;
    this.indexBuffer = null;
    this.indexCount = 0;
    this.shaderProgram = null;

    this.initShaders();
    this.initGeometry();
  }

  private initShaders(): void {
    const vertexShaderSource = `#version 300 es
    precision highp float;
    
    layout(location = 0) in vec3 aPosition;
    
    uniform mat4 uProjectionMatrix;
    uniform mat4 uViewMatrix;
    uniform mat4 uModelMatrix;
    
    void main() {
      vec4 position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(aPosition, 1.0);
      // Set depth to be at far plane for proper background rendering
      gl_Position = vec4(position.xy, position.w * 0.9999, position.w);
    }`;

    const fragmentShaderSource = `#version 300 es
    precision highp float;
    
    out vec4 fragColor;
    
    uniform vec3 uMoonColor;
    uniform float uMoonPhase;
    
    void main() {
      // Moon color with phase-based intensity
      vec3 moonColor = uMoonColor * (0.6 + 0.4 * uMoonPhase);
      fragColor = vec4(moonColor, 1.0);
    }`;

    const vertexShader = this.compileShader(
      this.gl.VERTEX_SHADER,
      vertexShaderSource,
    );
    const fragmentShader = this.compileShader(
      this.gl.FRAGMENT_SHADER,
      fragmentShaderSource,
    );

    this.shaderProgram = this.gl.createProgram()!;
    this.gl.attachShader(this.shaderProgram, vertexShader);
    this.gl.attachShader(this.shaderProgram, fragmentShader);
    this.gl.linkProgram(this.shaderProgram);

    if (!this.gl.getProgramParameter(this.shaderProgram, this.gl.LINK_STATUS)) {
      throw new Error(
        `Moon shader link failed: ${
          this.gl.getProgramInfoLog(this.shaderProgram)
        }`,
      );
    }

    this.gl.deleteShader(vertexShader);
    this.gl.deleteShader(fragmentShader);
  }

  private compileShader(type: number, source: string): WebGLShader {
    const shader = this.gl.createShader(type)!;
    this.gl.shaderSource(shader, source);
    this.gl.compileShader(shader);

    if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
      throw new Error(
        `Moon shader compile failed: ${this.gl.getShaderInfoLog(shader)}`,
      );
    }

    return shader;
  }

  private initGeometry(): void {
    // Create a sphere for the moon (smaller than sun)
    const latBands = 16;
    const longBands = 16;
    const radius = 2; // Smaller than sun

    const vertices: number[] = [];
    const indices: number[] = [];

    for (let lat = 0; lat <= latBands; lat++) {
      const theta = (lat * Math.PI) / latBands;
      const sinTheta = Math.sin(theta);
      const cosTheta = Math.cos(theta);

      for (let long = 0; long <= longBands; long++) {
        const phi = (long * 2 * Math.PI) / longBands;
        const sinPhi = Math.sin(phi);
        const cosPhi = Math.cos(phi);

        const x = cosPhi * sinTheta;
        const y = cosTheta;
        const z = sinPhi * sinTheta;

        vertices.push(radius * x, radius * y, radius * z);
      }
    }

    for (let lat = 0; lat < latBands; lat++) {
      for (let long = 0; long < longBands; long++) {
        const first = lat * (longBands + 1) + long;
        const second = first + longBands + 1;

        indices.push(first, second, first + 1);
        indices.push(second, second + 1, first + 1);
      }
    }

    this.vao = this.gl.createVertexArray();
    this.gl.bindVertexArray(this.vao);

    this.vertexBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array(vertices),
      this.gl.STATIC_DRAW,
    );

    this.gl.enableVertexAttribArray(0);
    this.gl.vertexAttribPointer(0, 3, this.gl.FLOAT, false, 0, 0);

    this.indexBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ELEMENT_ARRAY_BUFFER, this.indexBuffer);
    this.gl.bufferData(
      this.gl.ELEMENT_ARRAY_BUFFER,
      new Uint16Array(indices),
      this.gl.STATIC_DRAW,
    );

    this.indexCount = indices.length;

    this.gl.bindVertexArray(null);
  }

  render(projectionMatrix: Mat4, viewMatrix: Mat4, timeOfDay: number): void {
    if (!this.shaderProgram || !this.vao) {
      console.error("Moon shader or VAO not initialized");
      return;
    }

    // Moon orbits opposite to the sun - when sun is down, moon rises
    // Add 0.5 (12 hours) to timeOfDay to make moon opposite to sun
    const moonTimeOfDay = (timeOfDay + 0.5) % 1.0;
    const angle = moonTimeOfDay * Math.PI * 2;
    const distance = 150;

    // Moon position calculation
    const moonX = Math.cos(angle) * distance;
    const moonY = Math.sin(angle) * distance + 20;
    const moonZ = 0;

    // Don't render moon if it's below the horizon
    if (moonY < 5) {
      return;
    }

    this.gl.useProgram(this.shaderProgram);

    const modelMatrix = Mat4.translate({ x: moonX, y: moonY, z: moonZ });

    // Set uniforms
    const projLoc = this.gl.getUniformLocation(
      this.shaderProgram,
      "uProjectionMatrix",
    );
    const viewLoc = this.gl.getUniformLocation(
      this.shaderProgram,
      "uViewMatrix",
    );
    const modelLoc = this.gl.getUniformLocation(
      this.shaderProgram,
      "uModelMatrix",
    );
    const colorLoc = this.gl.getUniformLocation(
      this.shaderProgram,
      "uMoonColor",
    );
    const phaseLoc = this.gl.getUniformLocation(
      this.shaderProgram,
      "uMoonPhase",
    );

    this.gl.uniformMatrix4fv(projLoc, false, projectionMatrix.data);
    this.gl.uniformMatrix4fv(viewLoc, false, viewMatrix.data);
    this.gl.uniformMatrix4fv(modelLoc, false, modelMatrix.data);

    // Moon color - pale blue-white
    const moonColor: Vec3 = { x: 0.9, y: 0.9, z: 1.0 };
    this.gl.uniform3f(colorLoc, moonColor.x, moonColor.y, moonColor.z);

    // Simple moon phase (could be enhanced later)
    const moonPhase = 0.8; // Nearly full moon for good lighting
    this.gl.uniform1f(phaseLoc, moonPhase);

    // Render moon with depth testing enabled, but at far distance
    this.gl.enable(this.gl.DEPTH_TEST);
    this.gl.depthFunc(this.gl.LEQUAL);

    // Don't write to depth buffer - moon is a background object
    this.gl.depthMask(false);

    // Use alpha blending
    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE_MINUS_SRC_ALPHA);

    this.gl.bindVertexArray(this.vao);
    this.gl.drawElements(
      this.gl.TRIANGLES,
      this.indexCount,
      this.gl.UNSIGNED_SHORT,
      0,
    );

    // Restore state
    this.gl.depthMask(true);
    this.gl.depthFunc(this.gl.LESS);
    this.gl.disable(this.gl.BLEND);
    this.gl.bindVertexArray(null);
  }

  getMoonPosition(timeOfDay: number): Vec3 {
    // Moon orbits opposite to the sun
    const moonTimeOfDay = (timeOfDay + 0.5) % 1.0;
    const angle = moonTimeOfDay * Math.PI * 2;
    const distance = 150;

    return {
      x: Math.cos(angle) * distance,
      y: Math.sin(angle) * distance + 20,
      z: 0,
    };
  }

  // Get moon light direction and intensity for lighting calculations
  getMoonLight(timeOfDay: number): { direction: Vec3; intensity: number } {
    const moonPos = this.getMoonPosition(timeOfDay);

    // Don't provide light if moon is below horizon
    if (moonPos.y < 5) {
      return {
        direction: { x: 0, y: -1, z: 0 },
        intensity: 0,
      };
    }

    // Calculate light direction (from moon to world)
    const length = Math.sqrt(
      moonPos.x * moonPos.x + moonPos.y * moonPos.y + moonPos.z * moonPos.z,
    );
    const direction: Vec3 = {
      x: -moonPos.x / length,
      y: -moonPos.y / length,
      z: -moonPos.z / length,
    };

    // Moon provides dim lighting (about 20% of sun intensity)
    const intensity = 0.2;

    return { direction, intensity };
  }

  dispose(): void {
    if (this.vao) this.gl.deleteVertexArray(this.vao);
    if (this.vertexBuffer) this.gl.deleteBuffer(this.vertexBuffer);
    if (this.indexBuffer) this.gl.deleteBuffer(this.indexBuffer);
    if (this.shaderProgram) this.gl.deleteProgram(this.shaderProgram);
  }
}
