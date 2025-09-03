import { Mat4 } from "../math.ts";

export class Stars {
  private gl: WebGL2RenderingContext;
  private vao: WebGLVertexArrayObject | null;
  private vertexBuffer: WebGLBuffer | null;
  private starCount: number;
  private shaderProgram: WebGLProgram | null;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    this.vao = null;
    this.vertexBuffer = null;
    this.starCount = 0;
    this.shaderProgram = null;

    this.initShaders();
    this.initGeometry();
  }

  private initShaders(): void {
    const vertexShaderSource = `#version 300 es
    precision highp float;
    
    layout(location = 0) in vec3 aPosition;
    layout(location = 1) in float aBrightness;
    
    uniform mat4 uProjectionMatrix;
    uniform mat4 uViewMatrix;
    
    out float vBrightness;
    
    void main() {
      // Stars are at "infinite" distance, so we ignore translation
      mat4 viewNoTranslation = uViewMatrix;
      viewNoTranslation[3][0] = 0.0;
      viewNoTranslation[3][1] = 0.0;
      viewNoTranslation[3][2] = 0.0;
      
      gl_Position = uProjectionMatrix * viewNoTranslation * vec4(aPosition, 1.0);
      gl_PointSize = 2.0;
      vBrightness = aBrightness;
    }`;

    const fragmentShaderSource = `#version 300 es
    precision highp float;
    
    in float vBrightness;
    out vec4 fragColor;
    
    uniform float uVisibility;
    
    void main() {
      // Create circular star points
      vec2 coord = gl_PointCoord - vec2(0.5);
      float dist = length(coord);
      if (dist > 0.5) discard;
      
      // Soft edges for stars
      float alpha = 1.0 - smoothstep(0.1, 0.5, dist);
      
      // Star color (slightly blue-white)
      vec3 starColor = mix(vec3(0.8, 0.9, 1.0), vec3(1.0, 1.0, 0.9), vBrightness);
      
      fragColor = vec4(starColor, alpha * vBrightness * uVisibility);
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
        `Stars shader link failed: ${
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
        `Stars shader compile failed: ${this.gl.getShaderInfoLog(shader)}`,
      );
    }

    return shader;
  }

  private initGeometry(): void {
    // Generate random stars on a sphere
    const numStars = 1000;
    const vertices: number[] = [];
    const radius = 500; // Far away

    for (let i = 0; i < numStars; i++) {
      // Random spherical coordinates
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      // Convert to Cartesian coordinates
      const x = radius * Math.sin(phi) * Math.cos(theta);
      const y = radius * Math.sin(phi) * Math.sin(theta);
      const z = radius * Math.cos(phi);

      // Position (x, y, z)
      vertices.push(x, y, z);

      // Brightness (random between 0.3 and 1.0)
      vertices.push(0.3 + Math.random() * 0.7);
    }

    this.starCount = numStars;

    this.vao = this.gl.createVertexArray();
    this.gl.bindVertexArray(this.vao);

    this.vertexBuffer = this.gl.createBuffer();
    this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.vertexBuffer);
    this.gl.bufferData(
      this.gl.ARRAY_BUFFER,
      new Float32Array(vertices),
      this.gl.STATIC_DRAW,
    );

    // Position attribute
    this.gl.enableVertexAttribArray(0);
    this.gl.vertexAttribPointer(0, 3, this.gl.FLOAT, false, 16, 0);

    // Brightness attribute
    this.gl.enableVertexAttribArray(1);
    this.gl.vertexAttribPointer(1, 1, this.gl.FLOAT, false, 16, 12);

    this.gl.bindVertexArray(null);
  }

  render(projectionMatrix: Mat4, viewMatrix: Mat4, visibility: number): void {
    if (!this.shaderProgram || !this.vao || visibility <= 0) {
      return;
    }

    this.gl.useProgram(this.shaderProgram);

    // Set uniforms
    const projLoc = this.gl.getUniformLocation(
      this.shaderProgram,
      "uProjectionMatrix",
    );
    const viewLoc = this.gl.getUniformLocation(
      this.shaderProgram,
      "uViewMatrix",
    );
    const visibilityLoc = this.gl.getUniformLocation(
      this.shaderProgram,
      "uVisibility",
    );

    this.gl.uniformMatrix4fv(projLoc, false, projectionMatrix.data);
    this.gl.uniformMatrix4fv(viewLoc, false, viewMatrix.data);
    this.gl.uniform1f(visibilityLoc, visibility);

    // Enable blending for star transparency
    this.gl.enable(this.gl.BLEND);
    this.gl.blendFunc(this.gl.SRC_ALPHA, this.gl.ONE);

    // Disable depth writing (stars are background)
    this.gl.depthMask(false);

    this.gl.bindVertexArray(this.vao);
    this.gl.drawArrays(this.gl.POINTS, 0, this.starCount);

    // Restore state
    this.gl.depthMask(true);
    this.gl.disable(this.gl.BLEND);
    this.gl.bindVertexArray(null);
  }

  dispose(): void {
    if (this.vao) this.gl.deleteVertexArray(this.vao);
    if (this.vertexBuffer) this.gl.deleteBuffer(this.vertexBuffer);
    if (this.shaderProgram) this.gl.deleteProgram(this.shaderProgram);
  }
}
