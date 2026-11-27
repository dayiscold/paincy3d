import * as T from "three";
import { scene } from "./scene";
import { Physics } from "./physics";
import { box, blob, cylinder, beam, bake, sign } from "./models";
import { buildVillageBuildings, buildingFootprint } from "./buildings";
const v = (x: number, y: number, z: number) => new T.Vector3(x, y, z);
let seed = 27111;
function random() {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
}
export function buildWorld(p: Physics) {
  const land = new T.Group();
  scene.add(land);
  const solid = (
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    c: string,
  ) => {
    box(land, x, y, z, w, h, d, c);
    p.box(x, y, z, w, h, d);
  };
  box(land, 0, -0.19, 0, 440, 0.36, 440, "#727948");
  p.box(0, -0.25, 0, 180, 0.5, 180);
  for (const s of [-1, 1]) {
    p.box(s * 65, 5, 0, 1, 10, 130);
    p.box(0, 5, s * 65, 130, 10, 1);
  }
  function road(x: number, z: number, w: number, d: number) {
    box(land, x, 0.006, z, w, 0.02, d, "#aa8969");
  }
  road(0, 0, 8, 150);
  road(0, 4, 100, 5);
  for (const x of [-2.7, 2.7])
    box(land, x, 0.022, 0, 0.74, 0.01, 134, "#977c64");
  buildVillageBuildings(land, p);
  // The dairy plant keeps its two loading doors.
  {
    const [x, z, w, d] = [34, -15, 11, 10];
    solid(x - w / 2, 1.5, z, 0.3, 3, d, "#788475");
    solid(x + w / 2, 1.5, z, 0.3, 3, d, "#788475");
    solid(x, 3.15, z, w + 0.5, 0.3, d + 0.5, "#56595a");
    for (const side of [-1, 1])
      for (const end of [-1, 1])
        solid(
          x + (side * (w + 2.8)) / 4,
          1.5,
          z + (end * d) / 2,
          (w - 2.8) / 2,
          3,
          0.3,
          "#788475",
        );
  }
  road(-7, -21, 16, 4);
  solid(-1.8, 0.45, -13, 2, 0.9, 1.1, "#867463");
  solid(2.1, 0.34, -18, 1.3, 0.68, 1.6, "#75624c");
  function fence(x: number, z: number, n: number, alongX: boolean) {
    const dx = alongX ? 2.4 : 0,
      dz = alongX ? 0 : 2.4;
    for (let i = 0; i <= n; i++)
      box(land, x + dx * i, 0.68, z + dz * i, 0.22, 1.36, 0.22, "#6b5e4a");
    for (const y of [0.47, 1])
      box(
        land,
        x + (dx * n) / 2,
        y,
        z + (dz * n) / 2,
        alongX ? dx * n : 0.14,
        0.17,
        alongX ? 0.14 : dz * n,
        "#8d795c",
      );
    p.box(
      x + (dx * n) / 2,
      0.66,
      z + (dz * n) / 2,
      alongX ? dx * n : 0.22,
      1.32,
      alongX ? 0.22 : dz * n,
    );
  }
  fence(7, -8, 4, false);
  fence(7, 1.6, 3, true);
  fence(20, 1.6, 4, true);
  fence(-21, -3.5, 3, true);
  fence(-7, 12, 5, false);
  // Water tower and power line along the main street.
  cylinder(land, 29, 5.1, -25, 1.24, 1.5, 10.2, "#665e5a");
  cylinder(land, 29, 10.8, -25, 2.58, 1.26, 1.6, "#896f61", 12);
  cylinder(land, 29, 12.8, -25, 2.58, 2.58, 2.5, "#98796b", 12);
  cylinder(land, 29, 14.45, -25, 0.13, 2.84, 0.84, "#626068", 12);
  p.box(29, 5, -25, 3, 10, 3);
  for (let z = -57; z <= 45; z += 17) {
    cylinder(land, -4.8, 3.9, z, 0.11, 0.22, 7.8, "#605249");
    box(land, -4.8, 7.35, z, 2.4, 0.14, 0.19, "#594e49");
    p.box(-4.8, 3.9, z, 0.4, 7.8, 0.4);
    for (const x of [-5.7, -3.9]) {
      cylinder(land, x, 7.57, z, 0.095, 0.09, 0.31, "#a7b0a7");
      if (z < 45) {
        for (let j = 0; j < 8; j++) {
          const y = (k: number) => 7.72 - Math.sin((k / 8) * Math.PI) * 0.67;
          beam(
            land,
            v(x, y(j), z + (17 * j) / 8),
            v(x, y(j + 1), z + (17 * (j + 1)) / 8),
            0.033,
            "#443f46",
          );
        }
      }
    }
  }
  // Roadside village marker.
  const marker = sign("ПАИНЦЫ", "#242a2c", "#d6d7c5", 4.8, 1.17);
  marker.position.set(7, 2.64, 12);
  scene.add(marker);
  for (const x of [5.35, 8.65]) solid(x, 1.18, 12, 0.13, 2.36, 0.13, "#6e736c");
  const stall = sign("ПРИЁМ МОЛОКА", "#eee7cb", "#4c685c", 3.3, 0.63);
  stall.position.set(-7.5, 2.65, 1.02);
  scene.add(stall);
  solid(-7.5, 0.52, 0.2, 3.4, 1.04, 1.5, "#86705b");
  for (const x of [-9, -6])
    box(land, x, 1.83, 0.55, 0.15, 1.72, 0.15, "#645747");
  box(land, -7.5, 2.96, 0.2, 3.8, 0.18, 2.1, "#536964");
  for (const x of [-8.4, -7.8]) {
    cylinder(land, x, 1.36, 0.17, 0.2, 0.24, 0.62, "#b4bbb0");
    cylinder(land, x, 1.73, 0.17, 0.14, 0.2, 0.13, "#ced0bc");
  }
  // Countertop cream separator.
  cylinder(land, -6.7, 1.28, 0.22, 0.18, 0.24, 0.44, "#59746d");
  cylinder(land, -6.7, 1.6, 0.22, 0.31, 0.12, 0.24, "#b4bbb0");
  box(land, -6.48, 1.38, 0.22, 0.34, 0.06, 0.08, "#b4bbb0");
  function pine(x: number, z: number, h: number, far: boolean) {
    cylinder(land, x, h * 0.23, z, 0.16, 0.28, h * 0.46, "#605849", 5);
    for (let k = 0; k < 3; k++)
      cylinder(
        land,
        x,
        h * (0.46 + 0.185 * k),
        z,
        0,
        h * (0.27 - 0.054 * k),
        h * (0.54 - 0.05 * k),
        ["#445d53", "#4e6959", "#60755e"][k],
        6,
      );
    if (!far) p.box(x, h * 0.23, z, 0.5, h * 0.46, 0.5);
  }
  for (let i = 0; i < 235; i++) {
    const a = random() * Math.PI * 2,
      r = 46 + random() * 65;
    pine(Math.cos(a) * r, Math.sin(a) * r, 4 + random() * 9, r > 63);
  }
  for (const [x, z] of [
    [-21, -11],
    [-26, -19],
    [23, -17],
    [35, 2],
    [-11, 28],
    [21, 21],
    [24, 24],
    [-27, 15],
    [8, -32],
  ])
    pine(x, z, 7 + random() * 5, false);
  for (let i = 0; i < 32; i++) {
    const a = (i / 32) * 6.283;
    blob(
      land,
      Math.cos(a) * 128,
      1,
      Math.sin(a) * 128,
      22 + random() * 26,
      8 + random() * 13,
      27,
      "#777e88",
    );
  }
  for (let i = 0; i < 1000; i++) {
    const x = random() * 94 - 47,
      z = random() * 100 - 50;
    if (Math.abs(x) < 4.2 || Math.abs(z - 4) < 2.6 || buildingFootprint(x, z))
      continue;
    const h = 0.16 + random() * 0.37;
    for (let j = 0; j < 3; j++)
      cylinder(
        land,
        x + j * 0.13,
        h * 0.5,
        z + j * 0.08,
        0,
        0.085,
        h,
        ["#899053", "#999452", "#687548"][i % 3],
        3,
      ).rotation.z = (j - 1) * 0.3;
  }
  for (let i = 0; i < 150; i++) {
    const x = random() * 7 - 3.5,
      z = random() * 100 - 50;
    blob(land, x, 0.026, z, 0.06 + random() * 0.16, 0.03, 0.1, "#8e7a64");
  }
  bake(land);
  const sky = new T.Mesh(
    new T.SphereGeometry(260, 40, 24),
    new T.ShaderMaterial({
      side: T.BackSide,
      depthWrite: false,
      uniforms: {
        dusk: { value: 0 },
        sunDir: { value: v(-0.48, 0.16, -1).normalize() },
      },
      vertexShader: `varying vec3 dir;void main(){dir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `varying vec3 dir;uniform vec3 sunDir;uniform float dusk;void main(){vec3 n=normalize(dir);float y=max(n.y,0.);vec3 col=mix(vec3(.94,.67,.51),vec3(.58,.50,.62),smoothstep(.0,.46,y));col=mix(col,vec3(.27,.35,.50),smoothstep(.40,.9,y));float d=distance(n,sunDir);col+=vec3(.12,.075,.015)*exp(-d*6.);col=mix(col,vec3(1.,.88,.63),1.-smoothstep(.064,.067,d));gl_FragColor=vec4(mix(col,col*vec3(.16,.19,.32),dusk),1.);}`,
    }),
  );
  sky.name = "Небо";
  scene.add(sky);
}
