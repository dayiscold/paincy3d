import * as T from "three";
import { box, beam, cylinder, sign } from "./models";
import type { Physics } from "./physics";

type Kind = "home" | "club" | "shop" | "barn" | "cottage" | "garage";
interface Building {
  kind: Kind;
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  rise: number;
  paint: string;
  trim: string;
  roof: string;
}
const buildings: Building[] = [
  {
    kind: "home",
    x: -9,
    z: 35,
    w: 7.2,
    d: 6.3,
    h: 2.9,
    rise: 2,
    paint: "#779794",
    trim: "#eedfbb",
    roof: "#725651",
  },
  {
    kind: "club",
    x: -26,
    z: 1,
    w: 7.1,
    d: 6.4,
    h: 3.7,
    rise: 1.65,
    paint: "#849682",
    trim: "#e5cf9c",
    roof: "#585e64",
  },
  {
    kind: "shop",
    x: -12,
    z: -7.5,
    w: 8.2,
    d: 6.2,
    h: 3.05,
    rise: 1.35,
    paint: "#c59270",
    trim: "#f3dfb9",
    roof: "#685e57",
  },
  {
    kind: "barn",
    x: 14,
    z: -15,
    w: 11.2,
    d: 10,
    h: 3.85,
    rise: 2.65,
    paint: "#a06750",
    trim: "#d6b58c",
    roof: "#616c70",
  },
  {
    kind: "garage",
    x: -16,
    z: -26.6,
    w: 6.2,
    d: 6.4,
    h: 2.8,
    rise: 1.25,
    paint: "#788378",
    trim: "#a99d7f",
    roof: "#66696b",
  },
  {
    kind: "cottage",
    x: 15,
    z: -39.4,
    w: 7,
    d: 6.4,
    h: 2.75,
    rise: 2.15,
    paint: "#9a8065",
    trim: "#c8d8ba",
    roof: "#62656c",
  },
  {
    kind: "cottage",
    x: -17,
    z: 17.7,
    w: 6.55,
    d: 6,
    h: 2.85,
    rise: 1.9,
    paint: "#849077",
    trim: "#efdab9",
    roof: "#77605a",
  },
];
const timber = "#765c47",
  endGrain = "#aa8663",
  iron = "#485451",
  plaster = "#d8cbb0";
const glass = new T.MeshStandardMaterial({
  color: 0xb5d3ce,
  roughness: 0.45,
  transparent: true,
  opacity: 0.17,
  depthWrite: false,
  side: T.DoubleSide,
});
const pane = new T.PlaneGeometry();
const gable = new T.Shape();
gable.moveTo(-0.5, 0);
gable.lineTo(0.5, 0);
gable.lineTo(0, 1);
gable.closePath();
const triangle = new T.ExtrudeGeometry(gable, {
  depth: 1,
  bevelEnabled: false,
});
const atticMaterial = new T.MeshStandardMaterial({
  color: endGrain,
  roughness: 1,
});

export function buildingFootprint(x: number, z: number) {
  return buildings.some(
    (b) =>
      Math.abs(x - b.x) < b.w / 2 + 0.45 &&
      z > b.z - b.d / 2 - 0.5 &&
      z < b.z + b.d / 2 + 1.5,
  );
}

export function buildVillageBuildings(land: T.Group, p: Physics) {
  for (const b of buildings) build(land, p, b);
}
function build(land: T.Group, p: Physics, b: Building) {
  const { x, z, w, d, h, rise, paint, trim, roof, kind } = b,
    front = d / 2;
  const barn = kind === "barn",
    club = kind === "club",
    shop = kind === "shop",
    garage = kind === "garage";
  const open = barn || club || shop || kind === "home";
  const opening = barn ? 3.15 : club ? 2.25 : garage ? 3.0 : 1.48;
  const doorX = shop ? 1.42 : kind === "cottage" ? 1.48 : 0;
  const doorH = barn ? 3.02 : club ? 2.68 : 2.25;
  const board = (
    u: number,
    y: number,
    v: number,
    width: number,
    height: number,
    depth: number,
    color: string,
  ) => box(land, x + u, y, z + v, width, height, depth, color);
  const solid = (
    u: number,
    y: number,
    v: number,
    width: number,
    height: number,
    depth: number,
    color: string,
  ) => {
    const m = board(u, y, v, width, height, depth, color);
    p.box(x + u, y, z + v, width, height, depth);
    return m;
  };
  const stick = (a: number[], c: number[], thickness: number, color: string) =>
    beam(
      land,
      new T.Vector3(x + a[0], a[1], z + a[2]),
      new T.Vector3(x + c[0], c[1], z + c[2]),
      thickness,
      color,
    );
  const round = (
    u: number,
    y: number,
    v: number,
    r1: number,
    r2: number,
    height: number,
    color: string,
  ) => cylinder(land, x + u, y, z + v, r1, r2, height, color, 10);
  function plaque(
    label: string,
    u: number,
    y: number,
    v: number,
    width: number,
    height: number,
    ink: string,
    bg: string,
  ) {
    const m = sign(label, ink, bg, width, height);
    m.position.set(x + u, y, z + v);
    land.add(m);
  }

  // Each wall is divided at its openings. Siding and collision share the same intervals.
  function wall(side: boolean, face: number, door: boolean, windows: number[]) {
    const length = side ? d : w,
      plane = (face * (side ? w : d)) / 2;
    function strip(
      along: number,
      y: number,
      out: number,
      length: number,
      height: number,
      thick: number,
      color: string,
      collide = false,
    ) {
      const make = collide ? solid : board;
      return side
        ? make(plane + face * out, y, along, thick, height, length, color)
        : make(along, y, plane + face * out, length, height, thick, color);
    }
    const wallSegment = (
      left: number,
      right: number,
      bottom: number,
      top: number,
    ) => {
      if (right - left < 0.001 || top - bottom < 0.001) return;
      const mid = (left + right) / 2,
        span = right - left;
      strip(mid, (top + bottom) / 2, 0, span, top - bottom, 0.19, paint, true);
      for (let row = 0.22; row < top - 0.025; row += barn ? 0.42 : 0.26) {
        if (row <= bottom + 0.025) continue;
        strip(mid, row, 0.104, span, 0.025, 0.028, barn ? timber : paint);
      }
      if (bottom === 0) strip(mid, 0.16, 0.105, span, 0.26, 0.055, "#838079");
      if (bottom === 0 && !barn && open) {
        strip(mid, 0.39, -0.1, span, 0.7, 0.035, shop ? "#a48468" : "#8d886f");
        strip(mid, 0.76, -0.12, span, 0.055, 0.045, timber);
      }
    };
    const winW = shop && !side ? 2.6 : barn ? 1.5 : 1.22;
    const sill = barn ? 1.55 : 0.91,
      top = barn ? 2.53 : 2.23;
    const cuts = windows.map((at) => ({
      at,
      size: winW,
      low: sill,
      high: top,
    }));
    if (door)
      cuts.push({
        at: face === 1 ? doorX : 0,
        size: opening,
        low: 0,
        high: doorH,
      });
    let cursor = -length / 2;
    for (const cut of cuts.sort((a, b) => a.at - b.at)) {
      const { at, size, low, high } = cut,
        l = at - size / 2,
        r = at + size / 2;
      wallSegment(cursor, l, 0, h);
      wallSegment(l, r, 0, low);
      wallSegment(l, r, high, h);
      cursor = r;
      for (const jamb of [l, r])
        strip(jamb, (low + high) / 2, 0.035, 0.105, high - low, 0.29, trim);
      strip(at, high + 0.075, 0.055, size + 0.23, 0.15, 0.32, trim);
      if (!low) continue;
      strip(at, low - 0.025, 0.08, size + 0.3, 0.105, 0.38, trim);
      strip(at, (low + high) / 2, 0, 0.05, high - low, 0.075, trim);
      strip(at, high - 0.34, 0, size, 0.052, 0.075, trim);
      const sheet = new T.Mesh(pane, glass);
      sheet.position.set(
        x + (side ? plane : at),
        (low + high) / 2,
        z + (side ? at : plane),
      );
      sheet.rotation.y = side ? Math.PI / 2 : 0;
      sheet.scale.set(size, high - low, 1);
      land.add(sheet);
      p.box(
        sheet.position.x,
        sheet.position.y,
        sheet.position.z,
        side ? 0.06 : size,
        high - low,
        side ? size : 0.06,
      );
      if (!side && !barn && !shop) {
        strip(at, high + 0.19, 0.15, size + 0.39, 0.09, 0.18, trim);
        for (const edge of [l - 0.14, r + 0.14])
          strip(
            edge,
            (low + high) / 2,
            0.135,
            0.16,
            high - low + 0.24,
            0.055,
            trim,
          );
      }
    }
    wallSegment(cursor, length / 2, 0, h);
  }
  const frontWindows = garage
    ? []
    : shop
      ? [-1.72]
      : kind === "cottage"
        ? [-1.45]
        : [-w * 0.325, w * 0.325];
  wall(false, 1, true, frontWindows);
  wall(false, -1, club, barn ? [-2.9, 2.9] : [-w * 0.28, w * 0.28]);
  for (const face of [-1, 1])
    wall(true, face, false, barn ? [-2.9, 0, 2.9] : [-d * 0.25, d * 0.25]);

  // Floor and porch meet at the same low threshold.
  solid(
    0,
    0.004,
    0,
    w - 0.15,
    0.072,
    d - 0.15,
    open && !barn ? "#aa8c6b" : "#8b8270",
  );
  for (let u = -w / 2 + 0.38; u < w / 2 - 0.12; u += 0.36)
    board(u, 0.041, 0, 0.013, 0.006, d - 0.19, timber);
  if (!barn) solid(0, h - 0.045, 0, w, 0.12, d, open ? plaster : timber);
  for (const edge of [-1, 1]) {
    for (const end of [-1, 1])
      board(edge * (w / 2 - 0.03), h / 2, end * front, 0.19, h, 0.26, trim);
    board((edge * w) / 2, h - 0.12, 0, 0.26, 0.18, d + 0.3, trim);
  }
  for (const end of [-1, 1]) {
    const gableEnd = new T.Mesh(triangle, atticMaterial);
    gableEnd.scale.set(w, rise, 0.15);
    gableEnd.position.set(x, h, z + end * (front - 0.075) - 0.075);
    land.add(gableEnd);
  }
  for (let u = -w / 2 + 0.17; u < w / 2; u += 0.34) {
    const plankH = rise * (1 - (Math.abs(u) + 0.16) / (w / 2));
    if (plankH <= 0) continue;
    for (const end of [-1, 1])
      board(
        u,
        h + plankH / 2,
        end * (front + 0.02),
        0.315,
        plankH,
        0.05,
        barn ? "#99674c" : paint,
      );
  }
  const slope = rise / (w / 2),
    angle = Math.atan(slope),
    run = w / 2 + 0.44,
    roofLength = run / Math.cos(angle);
  for (const side of [-1, 1]) {
    const cx = (side * run) / 2,
      cy = h + rise - (run * slope) / 2 + 0.08;
    const panel = board(cx, cy, 0, roofLength, 0.14, d + 0.88, roof);
    panel.rotation.z = -side * angle;
    p.box(x + cx, cy, z, roofLength, 0.14, d + 0.88).setRotation(
      panel.quaternion,
    );
    for (let v = -front - 0.36; v < front + 0.4; v += 0.8)
      board(cx, cy + 0.087, v, roofLength, 0.045, 0.045, roof).rotation.z =
        -side * angle;
    for (const end of [-1, 1])
      board(
        cx,
        cy - 0.055,
        end * (front + 0.43),
        roofLength,
        0.18,
        0.11,
        trim,
      ).rotation.z = -side * angle;
  }
  board(0, h + rise + 0.18, 0, 0.2, 0.12, d + 0.94, iron);
  if (barn) {
    const ridge = h + rise;
    board(0, ridge + 0.38, -1.52, 1.4, 0.74, 1.62, timber);
    for (let level = 0; level < 3; level++)
      board(0, ridge + 0.19 + level * 0.19, -1.52, 1.48, 0.09, 1.7, endGrain);
    for (const side of [-1, 1])
      board(
        side * 0.4,
        ridge + 0.81,
        -1.52,
        0.92,
        0.12,
        1.95,
        roof,
      ).rotation.z = -side * 0.36;
  }
  if (!barn && !club && !shop && !garage) {
    const chimneyX = -w * 0.24,
      base = h + rise - Math.abs(chimneyX) * slope;
    board(chimneyX, base + 0.54, -0.83, 0.52, 1.4, 0.59, "#996a56");
    for (let j = 0; j < 4; j++)
      board(chimneyX, base + j * 0.26, -0.83, 0.535, 0.035, 0.6, "#b08d77");
    board(chimneyX, base + 1.22, -0.83, 0.66, 0.13, 0.73, iron);
    board(0, h + 0.62, front + 0.04, 0.66, 0.67, 0.08, trim);
    for (let j = 0; j < 4; j++)
      board(0, h + 0.4 + j * 0.14, front + 0.091, 0.49, 0.065, 0.05, iron);
  }

  const residential = kind === "home" || kind === "cottage";
  const porchW = barn ? 4 : shop ? 5.6 : club ? 3.65 : residential ? 3.45 : 2.6,
    porchX = shop ? 0.4 : residential ? doorX - 0.4 : doorX;
  solid(porchX, 0.003, front + 0.69, porchW, 0.074, 1.4, endGrain);
  for (let v = 0.16; v < 1.4; v += 0.27)
    board(porchX, 0.041, front + v, porchW, 0.005, 0.015, timber);
  const canopyY = barn ? 3.37 : club ? 3.06 : 2.54;
  const canopy = board(
    porchX,
    canopyY + 0.075,
    front + 0.65,
    porchW + 0.34,
    0.13,
    1.74,
    shop ? "#477765" : roof,
  );
  canopy.rotation.x = 0.105;
  p.box(
    x + porchX,
    canopy.position.y,
    z + front + 0.65,
    porchW + 0.34,
    0.13,
    1.74,
  ).setRotation(canopy.quaternion);
  board(
    porchX,
    canopyY - 0.06,
    front + 1.46,
    porchW + 0.34,
    0.17,
    0.11,
    shop ? trim : timber,
  );
  for (const side of [-1, 1]) {
    const u = porchX + side * (porchW / 2 - 0.1);
    solid(u, canopyY / 2, front + 1.26, 0.14, canopyY, 0.14, trim);
    stick(
      [u, canopyY - 0.56, front + 1.26],
      [u - side * 0.4, canopyY - 0.1, front + 1.26],
      0.09,
      trim,
    );
  }
  if (shop) {
    for (let u = -porchW / 2; u < porchW / 2; u += 0.6) {
      board(
        porchX + u + 0.15,
        canopyY + 0.15,
        front + 0.65,
        0.28,
        0.025,
        1.72,
        trim,
      ).rotation.x = 0.105;
    }
  }
  if (club) {
    const pediment = new T.Mesh(triangle, atticMaterial);
    pediment.scale.set(porchW + 0.34, 0.61, 1.58);
    pediment.position.set(x, canopyY + 0.13, z + front);
    land.add(pediment);
    for (const side of [-1, 1]) {
      stick(
        [0, canopyY + 0.77, front + 1.6],
        [side * (porchW / 2 + 0.27), canopyY + 0.12, front + 1.6],
        0.14,
        trim,
      );
      board(
        side * (porchW / 2 - 0.1),
        2.8,
        front + 1.26,
        0.28,
        0.13,
        0.28,
        trim,
      );
    }
  }
  if (residential) {
    // Leave the approach to the door clear between the two end rails.
    for (const side of [-1, 1]) {
      const u = porchX + side * (porchW / 2 - 0.1);
      solid(u, 0.87, front + 0.7, 0.11, 0.12, 1.19, trim);
      for (const v of [0.32, 0.62, 0.92])
        board(u, 0.46, front + v, 0.075, 0.78, 0.075, paint);
    }
    for (const u of frontWindows) {
      for (const side of [-1, 1]) {
        board(u + side * 0.91, 1.56, front + 0.18, 0.32, 1.37, 0.07, "#567873");
        for (const y of [1.08, 2.04])
          board(u + side * 0.91, y, front + 0.22, 0.33, 0.075, 0.04, trim);
      }
      board(u, 0.78, front + 0.24, 1.27, 0.21, 0.38, timber);
      for (let i = 0; i < 6; i++) {
        const flowerX = u - 0.48 + i * 0.19;
        round(
          flowerX,
          0.95 + (i % 2) * 0.04,
          front + 0.28,
          0.07,
          0.035,
          0.19,
          "#677a54",
        );
        round(
          flowerX,
          1.04 + (i % 2) * 0.04,
          front + 0.28,
          0.083,
          0.065,
          0.065,
          i % 3 ? "#bb796a" : "#d3ad72",
        );
      }
    }
  }
  // Summer doors stay open. Folded leaves sit outside the walkable opening.
  const leafW = barn || club ? opening / 2 : opening - 0.12;
  for (const hinge of barn || club ? [-1, 1] : [-1]) {
    if (open && !barn) {
      const u = doorX + hinge * (opening / 2 + 0.1),
        v = front - leafW / 2 + 0.09;
      solid(u, doorH / 2, v, 0.105, doorH - 0.1, leafW, "#54756a");
      for (const y of [0.6, 1.62])
        board(u - hinge * 0.058, y, v, 0.025, 0.61, leafW * 0.63, "#74897b");
      board(u - hinge * 0.1, 1.02, v - leafW * 0.32, 0.1, 0.045, 0.14, iron);
      continue;
    }
    const u = open ? doorX + hinge * (opening / 2 + leafW / 2 + 0.07) : doorX;
    const width = open ? leafW : opening - 0.06;
    solid(
      u,
      doorH / 2,
      front + 0.165,
      width,
      doorH - 0.1,
      0.12,
      barn ? "#80523c" : "#597367",
    );
    for (const y of [0.38, doorH - 0.38])
      board(u, y, front + 0.24, width - 0.08, 0.095, 0.035, trim);
    if (barn)
      stick(
        [u - width * 0.42, 0.43, front + 0.26],
        [u + width * 0.42, doorH - 0.43, front + 0.26],
        0.09,
        trim,
      );
    else board(u + 0.27 * width, 1.02, front + 0.265, 0.1, 0.04, 0.07, iron);
  }
  if (!open) return;
  if (barn)
    plaque(
      "МОЛОЧНАЯ ФЕРМА",
      0,
      h + 0.54,
      front + 0.14,
      5.2,
      0.75,
      "#eee2c6",
      "#546656",
    );
  if (club)
    plaque(
      "СЕЛЬСКИЙ КЛУБ",
      0,
      h + 0.4,
      front + 0.14,
      4,
      0.62,
      "#f4dfad",
      "#645145",
    );
  if (club) {
    const u = -w / 2 + 0.65, v = front + 1.26;
    for (const offset of [-0.46, 0.46])
      solid(u + offset, 0.59, v, 0.1, 1.18, 0.11, trim);
    solid(u, 1.62, v, 1.22, 0.97, 0.11, timber);
    plaque("АФИША", u, 1.91, v + 0.062, 1.03, 0.24, trim, iron);
    plaque("КИНО", u - 0.23, 1.48, v + 0.062, 0.46, 0.42, iron, "#d8ab76");
    plaque("ТАНЦЫ", u + 0.25, 1.51, v + 0.062, 0.43, 0.37, iron, plaster);
    solid(-opening / 2 - 0.07, doorH / 2, -front - opening / 2, 0.11, doorH, opening, "#54756a");
  }
  if (shop)
    plaque(
      "СЕЛЬПО",
      -0.9,
      h + 0.42,
      front + 0.14,
      2.8,
      0.6,
      "#fae8bd",
      "#446357",
    );
  if (kind === "home")
    plaque(
      "ДОМ ДОЯРА",
      2.1,
      2.62,
      front + 0.16,
      1.35,
      0.29,
      "#f4e6c9",
      "#4e6264",
    );

  const lampY = h - 0.52;
  round(0, h - 0.22, 0.35, 0.024, 0.024, 0.39, iron);
  round(0, lampY, 0.35, 0.1, 0.32, 0.17, "#7e8975");
  round(0, lampY - 0.1, 0.35, 0.12, 0.1, 0.12, "#ffdc95");
  const light = new T.PointLight(0xffdcaa, barn ? 16 : 9, Math.max(w, d), 2);
  light.position.set(x, lampY - 0.42, z + 0.35);
  land.add(light);

  function bench(u: number, v: number, width: number) {
    solid(u, 0.47, v, width, 0.13, 0.42, endGrain);
    for (const side of [-1, 1])
      solid(u + side * (width / 2 - 0.16), 0.24, v, 0.13, 0.43, 0.36, timber);
  }
  if (kind === "home") {
    const bedX = -w / 2 + 0.92;
    solid(bedX, 0.34, -1.48, 1.4, 0.59, 2.25, timber);
    board(bedX, 0.67, -1.48, 1.36, 0.13, 2.18, "#dccfb2");
    board(bedX, 0.77, -0.99, 1.39, 0.08, 1.15, "#957167");
    board(bedX, 0.8, -2.18, 0.86, 0.15, 0.47, "#efdfbe");
    solid(w / 2 - 0.77, 1.0, -2, 1.15, 1.92, 1.4, "#d6c5a6");
    board(w / 2 - 0.77, 0.76, -1.27, 0.63, 0.55, 0.08, iron);
    round(w / 2 - 0.77, 2.42, -2, 0.16, 0.18, 0.98, iron);
    round(w / 2 - 1.03, 2.06, -1.66, 0.14, 0.19, 0.24, "#627573");
    board(w / 2 - 1.03, 2.25, -1.66, 0.18, 0.075, 0.04, iron);
    for (const u of [-w * 0.28, w * 0.28]) {
      board(u, 2.3, -front + 0.19, 1.53, 0.045, 0.06, timber);
      for (const edge of [-1, 1])
        board(
          u + edge * 0.49,
          1.77,
          -front + 0.2,
          0.27,
          0.94,
          0.047,
          "#dfd6b6",
        );
    }
    bench(2, 0.6, 1.7);
    board(0.13, 0.048, 0.13, 1.25, 0.014, 2.22, "#a56958");
    for (const v of [-0.84, -0.64, 0.9, 1.11])
      board(0.13, 0.059, v, 1.24, 0.01, 0.07, "#d9b792");
  } else if (shop) {
    // Display the goods just behind the street-facing glass.
    solid(-1.72, 0.53, front - 0.43, 2.58, 1.0, 0.57, timber);
    for (let i = 0; i < 5; i++) {
      const u = -2.67 + i * 0.46;
      round(u, 1.2, front - 0.43, 0.145, 0.16, 0.32, i % 2 ? "#bf9b50" : "#975b4c");
      round(u, 1.38, front - 0.43, 0.15, 0.15, 0.045, iron);
    }
    solid(-1.65, 0.5, -0.82, 3.75, 0.94, 0.83, "#648276");
    board(-1.65, 1, -0.82, 3.9, 0.1, 0.94, endGrain);
    solid(-1.6, 1.05, -front + 0.45, 4.2, 2.03, 0.63, timber);
    for (let tier = 0; tier < 3; tier++) {
      const y = 0.52 + tier * 0.56;
      board(-1.6, y, -front + 0.83, 4.25, 0.09, 0.65, endGrain);
      for (let i = 0; i < 9; i++) {
        const u = -3.4 + i * 0.41;
        if (tier === 1)
          board(
            u,
            y + 0.23,
            -front + 0.9,
            0.29,
            0.38,
            0.26,
            i % 2 ? trim : "#98815f",
          );
        else {
          round(
            u,
            y + 0.19,
            -front + 0.92,
            0.115,
            0.135,
            0.29,
            i % 3 ? "#74947e" : "#aa715a",
          );
          round(u, y + 0.35, -front + 0.92, 0.12, 0.12, 0.035, iron);
        }
      }
    }
    board(-0.4, 1.18, -0.8, 0.53, 0.28, 0.43, iron);
    plaque("ХЛЕБ", -2.8, 1.68, -front + 1.15, 0.6, 0.16, iron, trim);
    plaque("КРУПА", -1.0, 1.68, -front + 1.15, 0.64, 0.16, iron, trim);
  } else if (club) {
    const stageX = -w / 2 + 0.82;
    solid(stageX, 0.18, -0.14, 1.42, 0.36, d - 1.2, timber);
    for (const end of [-1, 1])
      for (let i = 0; i < 4; i++) {
        const v = end * (front - 0.75 - i * 0.15);
        board(
          -w / 2 + 0.27 + (i % 2) * 0.08,
          1.86,
          v,
          0.26,
          2.92,
          0.18,
          i % 2 ? "#885451" : "#9e6158",
        );
      }
    board(-w / 2 + 0.23, 3.18, 0, 0.29, 0.36, d - 0.74, "#8b5752");
    solid(stageX, 0.85, -1.44, 0.62, 1.02, 0.62, iron);
    // An upright piano faces the audience across the central aisle.
    solid(stageX - 0.2, 1.03, 0.65, 0.61, 1.31, 1.48, "#684d40");
    board(stageX + 0.18, 1.13, 0.65, 0.2, 0.12, 1.43, endGrain);
    for (let i = 0; i < 18; i++) {
      const keyZ = 0.02 + i * 0.073;
      board(stageX + 0.2, 1.21, keyZ, 0.19, 0.04, 0.068, "#e7d9b8");
      if (i % 7 !== 2 && i % 7 !== 6)
        board(stageX + 0.16, 1.24, keyZ + 0.036, 0.12, 0.039, 0.034, iron);
    }
    for (const y of [0.72, 1.05])
      round(stageX + 0.32, y, -1.44, 0.17, 0.17, 0.04, "#303b39").rotation.z =
        Math.PI / 2;
    for (const v of [-1.64, 0.23, 1.99]) bench(w / 2 - 0.98, v, 1.19);
  } else {
    for (const side of [-1, 1]) {
      const u = side * (w / 2 - 1.1);
      solid(u, 0.3, -0.32, 1.52, 0.52, d - 2.7, timber);
      board(u, 0.59, -0.32, 1.47, 0.09, d - 2.75, "#b99c60");
      for (const v of [-3, -1, 1, 3])
        solid(u - side * 0.76, 0.8, v, 0.12, 1.55, 0.14, endGrain);
      solid(u - side * 0.76, 1.35, 0, 0.12, 0.13, 6.45, endGrain);
      for (const v of [-2.8, -1.75]) {
        solid(u, 0.87, v, 1.14, 0.52, 0.91, "#bc9c60");
        for (const band of [-0.3, 0.3])
          board(u + band, 1.139, v, 0.035, 0.02, 0.92, "#88744c");
      }
    }
    for (const u of [-1.35, 0, 1.35]) {
      round(u, 0.56, -front + 0.89, 0.39, 0.44, 1.04, "#94a09b");
      round(u, 1.12, -front + 0.89, 0.23, 0.38, 0.15, "#b8bdb0");
      p.box(x + u, 0.58, z - front + 0.89, 0.78, 1.17, 0.78);
    }
    for (const v of [-2.8, 0, 2.8]) {
      solid(0, h - 0.12, v, w - 0.18, 0.24, 0.18, timber);
      board(0, h + rise / 2 - 0.1, v, 0.16, rise, 0.16, endGrain);
      for (const side of [-1, 1]) {
        stick([side * (w / 2 - 0.1), h, v], [0, h + rise - 0.1, v], 0.19, timber);
        stick([side * w / 4, h - 0.1, v], [0, h + rise * 0.62, v], 0.13, endGrain);
      }
    }
  }
}
