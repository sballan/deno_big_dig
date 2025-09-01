export const vertexShaderSource = `#version 300 es
precision highp float;

layout(location = 0) in vec3 aPosition;
layout(location = 1) in vec3 aNormal;
layout(location = 2) in vec2 aTexCoord;

uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uModelMatrix;

out vec3 vNormal;
out vec2 vTexCoord;
out vec3 vPosition;
out float vFogFactor;

void main() {
    vec4 worldPosition = uModelMatrix * vec4(aPosition, 1.0);
    vec4 viewPosition = uViewMatrix * worldPosition;
    gl_Position = uProjectionMatrix * viewPosition;
    
    vNormal = mat3(uModelMatrix) * aNormal;
    vTexCoord = aTexCoord;
    vPosition = worldPosition.xyz;
    
    float fogStart = 50.0;
    float fogEnd = 100.0;
    float fogDistance = length(viewPosition.xyz);
    vFogFactor = clamp((fogEnd - fogDistance) / (fogEnd - fogStart), 0.0, 1.0);
}`;

export const fragmentShaderSource = `#version 300 es
precision highp float;

in vec3 vNormal;
in vec2 vTexCoord;
in vec3 vPosition;
in float vFogFactor;

out vec4 fragColor;

uniform vec3 uLightDirection;
uniform vec3 uAmbientLight;
uniform vec3 uFogColor;

void main() {
    vec3 normal = normalize(vNormal);
    
    vec3 lightDir = normalize(uLightDirection);
    float diffuse = max(dot(normal, lightDir), 0.0);
    
    vec3 lighting = uAmbientLight + diffuse * vec3(0.8);
    
    vec3 baseColor = vec3(0.5, 0.5, 0.5);
    
    if (vPosition.y < 1.0) {
        baseColor = vec3(0.3, 0.3, 0.3);
    } else if (vPosition.y < 3.0) {
        baseColor = vec3(0.4, 0.3, 0.2);
    } else if (vPosition.y < 5.0) {
        baseColor = vec3(0.2, 0.6, 0.2);
    } else {
        baseColor = vec3(0.5, 0.5, 0.5);
    }
    
    vec3 color = baseColor * lighting;
    
    color = mix(uFogColor, color, vFogFactor);
    
    fragColor = vec4(color, 1.0);
}`;

export function createShaderProgram(gl: WebGL2RenderingContext): WebGLProgram {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
  
  const program = gl.createProgram();
  if (!program) {
    throw new Error("Failed to create shader program");
  }
  
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const info = gl.getProgramInfoLog(program);
    throw new Error(`Failed to link shader program: ${info}`);
  }
  
  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);
  
  gl.useProgram(program);
  
  const lightDirLoc = gl.getUniformLocation(program, "uLightDirection");
  const ambientLoc = gl.getUniformLocation(program, "uAmbientLight");
  const fogColorLoc = gl.getUniformLocation(program, "uFogColor");
  
  gl.uniform3f(lightDirLoc, 0.5, -1.0, 0.3);
  gl.uniform3f(ambientLoc, 0.3, 0.3, 0.3);
  gl.uniform3f(fogColorLoc, 0.53, 0.81, 0.98);
  
  return program;
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const shader = gl.createShader(type);
  if (!shader) {
    throw new Error("Failed to create shader");
  }
  
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const info = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(`Failed to compile shader: ${info}`);
  }
  
  return shader;
}