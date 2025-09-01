import { Vec2, Vec3 } from "./types.ts";

export class Mat4 {
  data: Float32Array;

  constructor() {
    this.data = new Float32Array(16);
    this.identity();
  }

  identity(): Mat4 {
    this.data.fill(0);
    this.data[0] = 1;
    this.data[5] = 1;
    this.data[10] = 1;
    this.data[15] = 1;
    return this;
  }

  static perspective(fov: number, aspect: number, near: number, far: number): Mat4 {
    const mat = new Mat4();
    const f = 1.0 / Math.tan(fov / 2);
    const nf = 1 / (near - far);

    mat.data[0] = f / aspect;
    mat.data[5] = f;
    mat.data[10] = (far + near) * nf;
    mat.data[11] = -1;
    mat.data[14] = 2 * far * near * nf;
    mat.data[15] = 0;

    return mat;
  }

  static lookAt(eye: Vec3, center: Vec3, up: Vec3): Mat4 {
    const mat = new Mat4();
    
    const zAxis = normalize(subtract(eye, center));
    const xAxis = normalize(cross(up, zAxis));
    const yAxis = cross(zAxis, xAxis);

    mat.data[0] = xAxis.x;
    mat.data[1] = yAxis.x;
    mat.data[2] = zAxis.x;
    mat.data[3] = 0;
    mat.data[4] = xAxis.y;
    mat.data[5] = yAxis.y;
    mat.data[6] = zAxis.y;
    mat.data[7] = 0;
    mat.data[8] = xAxis.z;
    mat.data[9] = yAxis.z;
    mat.data[10] = zAxis.z;
    mat.data[11] = 0;
    mat.data[12] = -dot(xAxis, eye);
    mat.data[13] = -dot(yAxis, eye);
    mat.data[14] = -dot(zAxis, eye);
    mat.data[15] = 1;

    return mat;
  }

  static translate(v: Vec3): Mat4 {
    const mat = new Mat4();
    mat.data[12] = v.x;
    mat.data[13] = v.y;
    mat.data[14] = v.z;
    return mat;
  }

  static rotateY(angle: number): Mat4 {
    const mat = new Mat4();
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    
    mat.data[0] = c;
    mat.data[2] = s;
    mat.data[8] = -s;
    mat.data[10] = c;
    
    return mat;
  }

  static rotateX(angle: number): Mat4 {
    const mat = new Mat4();
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    
    mat.data[5] = c;
    mat.data[6] = -s;
    mat.data[9] = s;
    mat.data[10] = c;
    
    return mat;
  }

  multiply(other: Mat4): Mat4 {
    const result = new Mat4();
    const a = this.data;
    const b = other.data;
    const out = result.data;

    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 4; j++) {
        out[i * 4 + j] = 
          a[i * 4 + 0] * b[0 * 4 + j] +
          a[i * 4 + 1] * b[1 * 4 + j] +
          a[i * 4 + 2] * b[2 * 4 + j] +
          a[i * 4 + 3] * b[3 * 4 + j];
      }
    }

    return result;
  }
}

export function normalize(v: Vec3): Vec3 {
  const len = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
  if (len === 0) return { x: 0, y: 0, z: 0 };
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

export function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

export function dot(a: Vec3, b: Vec3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

export function subtract(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z };
}

export function add(a: Vec3, b: Vec3): Vec3 {
  return { x: a.x + b.x, y: a.y + b.y, z: a.z + b.z };
}

export function scale(v: Vec3, s: number): Vec3 {
  return { x: v.x * s, y: v.y * s, z: v.z * s };
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}