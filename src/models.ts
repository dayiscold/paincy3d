import * as T from "three";
import type { WeaponId } from "./weapons";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
const materials = new Map<string, T.MeshStandardMaterial>();
function part(
  parent: T.Object3D,
  g: T.BufferGeometry,
  c: string,
  x: number,
  y: number,
  z: number,
) {
  if (!materials.has(c))
    materials.set(
      c,
      new T.MeshStandardMaterial({ color: c, flatShading: true, roughness: 1 }),
    );
  const m = new T.Mesh(g, materials.get(c));
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}
const cube = new T.BoxGeometry();
export function box(
  p: T.Object3D,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  c: string,
) {
  const m = part(p, cube, c, x, y, z);
  m.scale.set(w, h, d);
  return m;
}
export function cylinder(
  p: T.Object3D,
  x: number,
  y: number,
  z: number,
  top: number,
  base: number,
  h: number,
  c: string,
  n = 8,
) {
  return part(p, new T.CylinderGeometry(top, base, h, n), c, x, y, z);
}
const rock = new T.IcosahedronGeometry(1, 0);
export function blob(
  p: T.Object3D,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  c: string,
) {
  const m = part(p, rock, c, x, y, z);
  m.scale.set(w, h, d);
  return m;
}
export function beam(
  p: T.Object3D,
  a: T.Vector3,
  b: T.Vector3,
  width: number,
  c: string,
) {
  const mid = a.clone().lerp(b, 0.5),
    m = box(p, mid.x, mid.y, mid.z, width, a.distanceTo(b), width, c);
  m.quaternion.setFromUnitVectors(
    new T.Vector3(0, 1, 0),
    b.clone().sub(a).normalize(),
  );
}
// Bake rigid scenery into colour batches once. Animated characters stay independent.
export function bake(root: T.Group) {
  root.updateWorldMatrix(true, true);
  const inv = root.matrixWorld.clone().invert(),
    batches = new Map<T.Material, T.BufferGeometry[]>();
  for (const obj of root.children.slice()) {
    if (
      !(obj instanceof T.Mesh) ||
      !(obj.material instanceof T.MeshStandardMaterial)
    )
      continue;
    const geo = obj.geometry.index
      ? obj.geometry.toNonIndexed()
      : obj.geometry.clone();
    geo.applyMatrix4(inv.clone().multiply(obj.matrixWorld));
    const list = batches.get(obj.material) ?? [];
    list.push(geo);
    batches.set(obj.material, list);
    root.remove(obj);
  }
  for (const [mat, list] of batches) {
    root.add(new T.Mesh(mergeGeometries(list), mat));
    list.forEach((g) => g.dispose());
  }
}
export function cow() {
  const g = new T.Group(),
    white = "#e8e0c8",
    black = "#383735";
  box(g, 0, 1.13, 0, 1.95, 0.89, 0.84, white);
  for (const x of [-0.69, 0.67])
    for (const z of [-0.3, 0.3]) {
      box(g, x, 0.48, z, 0.22, 0.87, 0.21, white);
      box(g, x, 0.12, z, 0.24, 0.18, 0.23, black);
    }
  for (const side of [-1, 1]) {
    box(g, -0.49, 1.27, side * 0.424, 0.64, 0.59, 0.016, black);
    box(g, 0.24, 1.03, side * 0.425, 0.42, 0.42, 0.02, black);
  }
  box(g, 1.04, 1.45, 0, 0.68, 0.69, 0.62, black);
  box(g, 1.37, 1.25, 0, 0.27, 0.34, 0.57, "#cf9d92");
  for (const s of [-1, 1]) {
    box(g, 1, 1.69, s * 0.38, 0.32, 0.13, 0.29, white);
    box(g, 1.23, 1.55, s * 0.315, 0.1, 0.1, 0.02, white);
    cylinder(g, 0.92, 1.85, s * 0.2, 0.025, 0.085, 0.27, "#c2ac87");
  }
  box(g, -1.02, 0.96, 0.24, 0.08, 0.77, 0.08, black);
  bake(g);
  return g;
}
export function human(color: string, hat: boolean) {
  const g = new T.Group(),
    skin = "#c69b7f";
  const legs = [-0.19, 0.19].map((x) => {
    const l = new T.Group();
    l.position.set(x, 0.91, 0);
    box(l, 0, -0.4, 0, 0.27, 0.78, 0.31, "#414955");
    box(l, 0, -0.78, 0.05, 0.3, 0.19, 0.42, "#292d34");
    g.add(l);
    return l;
  });
  box(g, 0, 1.21, 0, 0.69, 0.74, 0.39, color);
  box(g, 0, 1.81, 0, 0.43, 0.46, 0.42, skin);
  box(g, 0, 2.04, -0.02, 0.47, 0.12, 0.46, hat ? "#393944" : "#675044");
  const arms = [-1, 1].map((s) => {
    const arm = new T.Group();
    arm.position.set(s * 0.42, 1.49, 0);
    box(arm, 0, -0.27, 0, 0.21, 0.54, 0.25, color);
    box(arm, 0, -0.6, 0, 0.18, 0.18, 0.2, skin);
    g.add(arm);
    box(g, s * 0.1, 1.84, 0.216, 0.065, 0.04, 0.015, "#3e342f");
    return arm;
  });
  box(g, 0, 1.78, 0.23, 0.12, 0.1, 0.09, "#b97864");
  return { g, legs, arms };
}
export function villager(name: string, color: string, hat: boolean) {
  const person = human(color, hat),
    g = person.g;
  switch (name) {
    case "Баба Зина":
      blob(g, 0, 1.94, 0, 0.35, 0.31, 0.33, "#913d52");
      box(g, 0, 1.68, 0.22, 0.17, 0.25, 0.08, "#913d52");
      cylinder(g, 0, 0.77, 0, 0.3, 0.45, 0.72, "#52465b");
      break;
    case "Коля":
      box(g, 0, 1.08, 0.21, 0.55, 0.86, 0.05, "#e3ddbf");
      box(g, 0.12, 1.14, 0.245, 0.18, 0.15, 0.03, "#bfb59c");
      break;
    case "Директор":
      box(g, 0, 1.39, 0.22, 0.11, 0.43, 0.06, "#685246");
      box(person.arms[0], 0, -0.6, 0.12, 0.46, 0.36, 0.08, "#8a633b");
      break;
    case "Петрович":
      box(g, 0, 0.92, 0, 0.76, 0.13, 0.44, "#625448");
      for (const x of [-0.22, 0.2])
        box(g, x, 0.92, 0.26, 0.08, 0.3, 0.06, "#a8aaa2");
      break;
    case "Валера":
      for (const x of [-0.12, 0.12])
        box(g, x, 2, 0.2, 0.19, 0.12, 0.09, "#7bafad");
      box(g, 0, 2, -0.04, 0.49, 0.08, 0.42, "#494b45");
      break;
    case "Саныч":
      box(g, 0, 1.53, 0.2, 0.78, 0.22, 0.18, "#59473d");
      cylinder(g, 0, 2.08, 0, 0.3, 0.32, 0.17, "#554640");
      break;
    case "Витёк":
      box(g, 0, 1.43, 0.2, 0.62, 0.1, 0.05, "#dfd2ab");
      g.scale.set(1.17, 1.1, 1.13);
      break;
    case "Гена":
      box(g, 0, 2.02, 0.22, 0.5, 0.06, 0.22, "#626858");
      break;
  }
  return person;
}
export function weapon(id: WeaponId) {
  const g = new T.Group();
  function fist(x: number, y: number, z: number) {
    box(g, x, y - 0.15, z + 0.12, 0.21, 0.26, 0.36, "#465e56");
    box(g, x, y, z, 0.21, 0.21, 0.24, "#c09878");
  }
  if (id === "fists") {
    fist(-0.38, -0.07, 0);
    fist(0.16, -0.01, -0.06);
  } else {
    fist(0.1, -0.13, 0);
    cylinder(
      g,
      0.1,
      0.04,
      0,
      0.035,
      0.04,
      id === "pin" ? 0.54 : 0.96,
      "#a87948",
    );
    if (id === "pin") {
      cylinder(g, 0.1, 0.22, 0, 0.09, 0.09, 0.39, "#d4aa70");
      cylinder(g, 0.1, 0.46, 0, 0.035, 0.035, 0.1, "#a87948");
    } else if (id === "fork") {
      box(g, 0.1, 0.53, 0, 0.32, 0.06, 0.05, "#687775");
      for (const x of [-0.04, 0.1, 0.24])
        cylinder(g, x, 0.68, 0, 0.006, 0.021, 0.29, "#acbab6");
    } else {
      box(g, 0.1, 0.65, 0, 0.3, 0.32, 0.05, "#8d9c9a");
      blob(g, 0.1, 0.82, 0, 0.19, 0.14, 0.038, "#8d9c9a");
    }
  }
  return g;
}

export function sign(
  label: string,
  color: string,
  bg: string,
  w: number,
  h: number,
) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = Math.round((1024 * h) / w);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = color;
  ctx.lineWidth = 8;
  ctx.strokeRect(10, 10, 1004, canvas.height - 20);
  ctx.fillStyle = color;
  ctx.font = "bold " + Math.round(canvas.height * 0.62) + "px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(label, 512, canvas.height * 0.53, 960);
  const tex = new T.CanvasTexture(canvas);
  tex.colorSpace = T.SRGBColorSpace;
  return new T.Mesh(
    new T.PlaneGeometry(w, h),
    new T.MeshStandardMaterial({ map: tex, roughness: 1 }),
  );
}
