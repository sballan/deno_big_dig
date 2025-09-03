/**
 * WebGL Shader Module for 3D Voxel Rendering
 *
 * This module contains the GLSL shader programs that run on the GPU to render the voxel world.
 * It includes vertex and fragment shaders, plus utilities for compiling and linking them.
 *
 * SHADER PIPELINE OVERVIEW:
 * 1. Vertex Shader: Transforms 3D vertices to screen coordinates, calculates fog
 * 2. Rasterization: GPU converts triangles to pixels (automatic)
 * 3. Fragment Shader: Calculates final color for each pixel with lighting and fog
 *
 * The shaders use WebGL 2.0 / OpenGL ES 3.0 for modern GPU features.
 */

/**
 * VERTEX SHADER
 *
 * Transforms 3D vertices from model space to screen space and prepares data for fragment shader.
 * This shader runs once per vertex of each triangle in the mesh.
 *
 * The transformation pipeline:
 * 1. Model Space: Original vertex positions relative to the chunk's origin
 * 2. World Space: Vertices positioned in the game world (via uModelMatrix)
 * 3. View Space: Vertices relative to the camera position (via uViewMatrix)
 * 4. Clip Space: Vertices in normalized device coordinates (via uProjectionMatrix)
 *
 * Additionally calculates per-vertex fog and passes interpolated data to fragment shader.
 */
export const vertexShaderSource = `#version 300 es
precision highp float;  // Use high precision for vertex positions to avoid artifacts

// INPUT ATTRIBUTES (per-vertex data from mesh buffers)
layout(location = 0) in vec3 aPosition;  // Vertex position in model space (x, y, z)
layout(location = 1) in vec3 aNormal;    // Surface normal vector for lighting calculations
layout(location = 2) in vec2 aTexCoord;  // Texture coordinates (u, v) for texture mapping

// TRANSFORMATION MATRICES (set once per frame or per chunk)
uniform mat4 uProjectionMatrix;  // Perspective projection (3D to 2D with depth)
uniform mat4 uViewMatrix;        // Camera transformation (position and rotation)
uniform mat4 uModelMatrix;       // Chunk position in world space

// OUTPUT VARIABLES (interpolated across triangle surface for fragment shader)
out vec3 vNormal;        // Transformed normal vector for per-pixel lighting
out vec2 vTexCoord;      // Pass-through texture coordinates for texture sampling
out vec3 vPosition;      // World space position for advanced lighting effects
out float vFogFactor;    // Fog density (0 = full fog, 1 = no fog)

void main() {
    // STEP 1: Transform vertex from model space to world space
    // Multiplies 3D position by 4x4 matrix (w=1.0 for positions)
    vec4 worldPosition = uModelMatrix * vec4(aPosition, 1.0);
    
    // STEP 2: Transform from world space to view/camera space
    // Applies camera position and rotation to vertex
    vec4 viewPosition = uViewMatrix * worldPosition;
    
    // STEP 3: Apply perspective projection to get final screen position
    // gl_Position is a built-in output that GPU uses for rasterization
    gl_Position = uProjectionMatrix * viewPosition;
    
    // STEP 4: Transform normal vector to world space for lighting
    // Uses 3x3 matrix (rotation only, no translation) to preserve direction
    vNormal = mat3(uModelMatrix) * aNormal;
    
    // STEP 5: Pass texture coordinates unchanged to fragment shader
    vTexCoord = aTexCoord;
    
    // STEP 6: Store world position for fragment shader (used in advanced effects)
    vPosition = worldPosition.xyz;
    
    // STEP 7: Calculate linear fog based on distance from camera
    float fogStart = 50.0;   // Distance where fog begins (in world units)
    float fogEnd = 100.0;    // Distance where fog completely obscures
    float fogDistance = length(viewPosition.xyz);  // Distance from camera to vertex
    // Interpolate fog factor: 1.0 at fogStart, 0.0 at fogEnd
    vFogFactor = clamp((fogEnd - fogDistance) / (fogEnd - fogStart), 0.0, 1.0);
}`;

/**
 * FRAGMENT SHADER
 *
 * Calculates the final color for each pixel (fragment) on screen.
 * This shader runs once per pixel that's covered by a triangle.
 *
 * The fragment shader performs:
 * 1. Texture sampling to get base color from block textures
 * 2. Directional lighting calculations (ambient + diffuse)
 * 3. Distance-based fog blending for atmospheric depth
 *
 * All input values are interpolated from the three vertices of the triangle
 * that covers this pixel, providing smooth gradients across surfaces.
 */
export const fragmentShaderSource = `#version 300 es
precision highp float;  // High precision for accurate color calculations

// INPUT VARIABLES (interpolated from vertex shader)
in vec3 vNormal;        // Surface normal at this pixel (interpolated from vertices)
in vec2 vTexCoord;      // Texture coordinates for sampling the texture atlas
in vec3 vPosition;      // World position of this fragment (for future effects)
in float vFogFactor;    // Fog intensity (0 = full fog, 1 = no fog)

// OUTPUT VARIABLE
out vec4 fragColor;     // Final RGBA color output to the framebuffer

// TEXTURE SAMPLER
uniform sampler2D uTexture;      // 2D texture atlas containing all block textures

// LIGHTING UNIFORMS
uniform vec3 uLightDirection;    // Direction of the sun/main light source
uniform vec3 uAmbientLight;      // Minimum light level (prevents pure black shadows)
uniform vec3 uFogColor;          // Sky/fog color for distance blending
uniform float uDiffuseIntensity; // Intensity multiplier for directional light

void main() {
    // STEP 1: Normalize the interpolated normal vector
    // Interpolation can denormalize vectors, so we ensure unit length
    vec3 normal = normalize(vNormal);
    
    // STEP 2: Sample the texture atlas at the current texture coordinates
    // Returns RGBA color from the block's texture
    vec4 texColor = texture(uTexture, vTexCoord);
    
    // STEP 3: Calculate diffuse lighting using Lambert's cosine law
    // Normalize light direction to ensure it's a unit vector
    vec3 lightDir = normalize(uLightDirection);
    // Dot product gives cosine of angle between normal and light
    // max() ensures we don't get negative light (surfaces facing away)
    // Multiply by intensity uniform for adjustable brightness
    float diffuse = max(dot(normal, lightDir), 0.0) * uDiffuseIntensity;
    
    // STEP 4: Combine ambient and diffuse lighting
    // Ambient: constant minimum light everywhere (simulates indirect lighting)
    // Diffuse: directional light contribution
    vec3 lighting = uAmbientLight + diffuse * vec3(1.0);
    
    // STEP 5: Apply lighting to the texture color
    // Component-wise multiplication modulates the texture by light intensity
    vec3 color = texColor.rgb * lighting;
    
    // STEP 6: Apply distance fog for atmospheric perspective
    // mix() linearly interpolates between fog color and lit color
    // vFogFactor controls the blend (0 = all fog, 1 = no fog)
    color = mix(uFogColor, color, vFogFactor);
    
    // STEP 7: Output final color with original alpha from texture
    // Alpha channel preserved for transparency (if needed for certain blocks)
    fragColor = vec4(color, texColor.a);
}`;

/**
 * Creates and links the main shader program for rendering.
 *
 * This function:
 * 1. Compiles the vertex and fragment shaders from source
 * 2. Creates a shader program and links the shaders together
 * 3. Sets up default uniform values for lighting and fog
 * 4. Returns the compiled program ready for rendering
 *
 * The shader program is the complete GPU pipeline for rendering voxels.
 *
 * @param gl - The WebGL2 rendering context
 * @returns The compiled and linked shader program
 * @throws Error if shader compilation or linking fails
 */
export function createShaderProgram(gl: WebGL2RenderingContext): WebGLProgram {
  // STEP 1: Compile the vertex shader from GLSL source code
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);

  // STEP 2: Compile the fragment shader from GLSL source code
  const fragmentShader = compileShader(
    gl,
    gl.FRAGMENT_SHADER,
    fragmentShaderSource,
  );

  // STEP 3: Create an empty shader program object
  const program = gl.createProgram();
  if (!program) {
    throw new Error("Failed to create shader program");
  }

  // STEP 4: Attach both shaders to the program
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);

  // STEP 5: Link the shaders together into a complete pipeline
  // This validates that vertex shader outputs match fragment shader inputs
  gl.linkProgram(program);

  // STEP 6: Check if linking was successful
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    throw new Error(`Failed to link shader program: ${info}`);
  }

  // STEP 7: Clean up individual shaders (they're now part of the program)
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  // STEP 8: Activate this shader program for use
  gl.useProgram(program);

  // STEP 9: Get locations of uniform variables for setting values
  const lightDirLoc = gl.getUniformLocation(program, "uLightDirection");
  const ambientLoc = gl.getUniformLocation(program, "uAmbientLight");
  const fogColorLoc = gl.getUniformLocation(program, "uFogColor");
  const diffuseLoc = gl.getUniformLocation(program, "uDiffuseIntensity");

  // STEP 10: Set default uniform values for lighting and atmosphere
  // Light direction: pointing down-right (simulates sun angle)
  gl.uniform3f(lightDirLoc, 0.5, -1.0, 0.3);
  // Ambient light: 30% gray (prevents complete darkness)
  gl.uniform3f(ambientLoc, 0.3, 0.3, 0.3);
  // Fog color: light blue (sky color for distance blending)
  gl.uniform3f(fogColorLoc, 0.4, 0.6, 0.8);
  // Diffuse intensity: 80% strength for directional light
  gl.uniform1f(diffuseLoc, 0.8);

  return program;
}

/**
 * Compiles a single shader (vertex or fragment) from GLSL source code.
 *
 * This is a utility function that:
 * 1. Creates a shader object of the specified type
 * 2. Uploads the GLSL source code to the GPU
 * 3. Compiles the shader on the GPU
 * 4. Checks for compilation errors and provides helpful error messages
 *
 * @param gl - The WebGL2 rendering context
 * @param type - Either gl.VERTEX_SHADER or gl.FRAGMENT_SHADER
 * @param source - The GLSL source code as a string
 * @returns The compiled shader object
 * @throws Error with compilation details if the shader fails to compile
 */
function compileShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string,
): WebGLShader {
  // STEP 1: Create a new shader object of the specified type
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("Failed to create shader");
  }

  // STEP 2: Upload the GLSL source code to the shader object
  gl.shaderSource(shader, source);

  // STEP 3: Compile the shader on the GPU
  // The GPU driver compiles GLSL to machine code for the graphics card
  gl.compileShader(shader);

  // STEP 4: Check if compilation was successful
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    // Get the error message from the GPU driver
    const info = gl.getShaderInfoLog(shader);
    // Clean up the failed shader
    gl.deleteShader(shader);
    // Throw with detailed error for debugging
    throw new Error(`Failed to compile shader: ${info}`);
  }

  return shader;
}
