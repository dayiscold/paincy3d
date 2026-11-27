import * as T from "three";
import { box, cylinder, cow, human, bake } from "./models";
import { scene } from "./scene";
import { places, type Place } from "./storyData";
import type { StoryManager, EventManager } from "./storyState";
import { incidents, errands } from "./villageJobs";

function prop(type: string) {
  const g = new T.Group();
  switch (type) {
    case "car":
      box(g, 0, 0.68, 0, 1.7, 0.7, 3.3, "#56694a");
      box(g, 0, 1.23, 0.18, 1.52, 0.65, 1.9, "#77929a");
      box(g, 0, 1.62, 0.18, 1.64, 0.13, 2, "#56694a");
      for (const x of [-0.82, 0.82])
        for (const z of [-1.05, 1.05])
          cylinder(g, x, 0.42, z, 0.41, 0.41, 0.23, "#322e2a", 10).rotation.z =
            Math.PI / 2;
      break;
    case "cow":
      return cow();
    case "dog":
      box(g, 0, 0.45, 0, 0.77, 0.41, 0.34, "#9c7151");
      box(g, 0.36, 0.74, 0, 0.35, 0.34, 0.34, "#a77c55");
      for (const x of [-0.24, 0.26])
        for (const z of [-0.12, 0.12])
          box(g, x, 0.17, z, 0.12, 0.31, 0.12, "#785f49");
      break;
    case "paper":
      box(g, 0, 0.65, 0, 0.8, 0.1, 0.52, "#e1d4aa");
      box(g, 0, 0.3, 0, 0.6, 0.6, 0.45, "#79674d");
      break;
    case "fence":
      for (const x of [-0.8, 0.8])
        box(g, x, 0.6, 0, 0.13, 1.2, 0.13, "#83664d");
      box(g, 0, 0.8, 0, 1.8, 0.16, 0.12, "#a88d6a");
      break;
    case "lamp":
      cylinder(g, 0, 0.4, 0, 0.1, 0.13, 0.8, "#58655a");
      box(g, 0, 0.94, 0, 0.39, 0.34, 0.33, "#f5cb81");
      break;
    case "pipe":
      cylinder(g, 0, 0.5, 0, 0.24, 0.26, 1, "#a47756");
      cylinder(g, 0, 1.05, 0, 0.35, 0.35, 0.12, "#8e5950");
      break;
    default:
      box(g, 0, 0.25, 0, 0.84, 0.5, 0.58, "#937351");
      for (const x of [-0.25, 0.25])
        cylinder(g, x, 0.63, 0, 0.12, 0.13, 0.4, "#90a296");
  }
  bake(g);
  return g;
}
const models = [
  "car",
  "pipe",
  "cow",
  "lamp",
  "crate",
  "fence",
  "paper",
  "lamp",
  "paper",
  "pipe",
  "paper",
  "crate",
  "paper",
  "lamp",
  "paper",
];
export class VillageWork {
  private items = models.map(prop);
  private visitors = [
    human("#875842", true).g,
    cow(),
    prop("pipe"),
    prop("crate"),
    human("#73618b", false).g,
    human("#4c595b", true).g,
    human("#698083", true).g,
    prop("car"),
    prop("lamp"),
    prop("dog"),
  ];
  private works = new T.Group();
  private lamp = new T.PointLight(0xffc082, 8, 8);
  private pump = prop("pipe");
  private niva = prop("car");
  private evidence = prop("paper");
  private neighbours = [human("#838e67", false), human("#775d72", true)];
  private alarm = 0;
  private allies = [human("#a28655", true), human("#854f71", false)];
  constructor() {
    this.neighbours.forEach((n, i) => {
      scene.add(n.g);
      if (i === 0) cylinder(n.arms[0], 0, -0.85, 0, 0.23, 0.19, 0.4, "#a9aba1");
      else box(n.arms[1], 0, -0.48, 0.15, 0.5, 0.35, 0.4, "#887551");
    });
    for (const obj of [...this.items, ...this.visitors]) {
      obj.visible = false;
      scene.add(obj);
    }
    scene.add(this.works, this.lamp, ...this.allies.map((a) => a.g));
    const fence = prop("fence");
    this.works.add(fence);
    fence.position.set(17, 0.01, -8);
    scene.add(this.niva, this.evidence);
    this.niva.position.set(-10.5, 0, -20);
    this.pump.position.set(15.6, 0, -8);
    scene.add(this.pump);
    this.lamp.position.set(-26, 2.4, 1);
  }
  react() {
    this.alarm = 2.5;
  }
  alliesCover(x: number, z: number) {
    return this.allies.some(
      (n) =>
        n.g.visible && Math.hypot(n.g.position.x - x, n.g.position.z - z) < 3.5,
    );
  }
  visitorPosition(i: number) {
    return this.visitors[i].position;
  }
  private place(obj: T.Object3D, at: Place) {
    const [x, z] = places[at];
    obj.position.set(x + 0.8, 0, z + 0.4);
  }
  update(
    s: StoryManager,
    e: EventManager,
    time: number,
    hero: { x: number; z: number },
    dt: number,
  ) {
    this.alarm = Math.max(0, this.alarm - dt);
    this.neighbours.forEach((n, i) => {
      const start = i ? [-28, 5] : [8, 6],
        end = i ? [-13, 5] : [19, 6];
      const walk = (1 + Math.sin(time * 0.19 + i * 2)) / 2;
      const p = n.g.position;
      p.x = start[0] + (end[0] - start[0]) * walk;
      p.z = start[1];
      const near = Math.hypot(p.x - hero.x, p.z - hero.z) < 4;
      n.g.rotation.y = near
        ? Math.atan2(hero.x - p.x, hero.z - p.z)
        : (Math.sign(Math.cos(time * 0.19 + i * 2)) * Math.PI) / 2;
      if (near && (this.alarm > 0 || s.rep.locals < 0)) {
        p.z -= 1.5;
        n.g.rotation.y += Math.PI;
      }
      n.legs.forEach(
        (leg, k) => (leg.rotation.x = Math.sin(time * 4 + k * Math.PI) * 0.35),
      );
      n.arms[1].rotation.x =
        near && s.rep.locals > 2 ? -0.9 + Math.sin(time * 6) * 0.3 : 0;
    });
    this.niva.visible = s.beat.chapter >= 6 || s.completed.includes(0);
    this.evidence.visible = ["deed", "papers", "pay", "ransom"].includes(s.id);
    if (this.evidence.visible) this.place(this.evidence, s.beat.at);
    this.works.visible = s.completed.includes(5);
    this.lamp.visible = s.completed.includes(3);
    this.items.forEach((obj, i) => {
      const on = i === s.side && !s.carrying;
      if (on && !obj.visible) this.place(obj, errands[i].site);
      obj.visible = on;
    });
    this.visitors.forEach((obj, i) => {
      const on = e.active === i;
      if (on && !obj.visible) this.place(obj, incidents[i][1]);
      obj.visible = on;
      if (on && [0, 1, 4, 5, 6, 9].includes(i)) {
        if (e.following) {
          const dx = hero.x - obj.position.x,
            dz = hero.z - obj.position.z,
            d = Math.hypot(dx, dz);
          if (d > 1.5) {
            obj.position.x += (dx / d) * dt * 3.8;
            obj.position.z += (dz / d) * dt * 3.8;
          }
          obj.rotation.y = Math.atan2(dx, dz);
          return;
        }
        const [x, z] = places[incidents[i][1]];
        obj.position.x = x + Math.sin(time * 0.6) * 1.5;
        obj.position.z = z + Math.cos(time * 0.6) * 0.7;
        obj.rotation.y = Math.atan2(
          hero.x - obj.position.x,
          hero.z - obj.position.z,
        );
      }
    });
    this.allies.forEach((a, i) => {
      a.g.visible =
        (s.beat.chapter === 6 && ["post", "warehouse"].includes(s.id)) ||
        s.beat.chapter === 8;
      if (!a.g.visible) return;
      const [x, z] = places[s.beat.chapter === 8 ? "mill" : "store"];
      a.g.position.set(x - 1 - i * 1.4, 0, z + 3);
      a.g.rotation.y = Math.atan2(
        hero.x - a.g.position.x,
        hero.z - a.g.position.z,
      );
      a.arms[0].rotation.x = -0.4 + Math.sin(time * 2 + i) * 0.4;
    });
    if (s.beat.chapter >= 3) this.pump.rotation.y += dt * 0.15;
  }
}
