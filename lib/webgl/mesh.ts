export class BlockMesh {
  private gl: WebGL2RenderingContext;
  private program: WebGLProgram;

  /**
   * Initializes block mesh system (currently unused placeholder)
   */
  constructor(gl: WebGL2RenderingContext, program: WebGLProgram) {
    this.gl = gl;
    this.program = program;
  }

  /**
   * Cleanup method (currently empty as no resources are allocated)
   */
  dispose(): void {
  }
}