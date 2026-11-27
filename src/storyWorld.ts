import * as T from "three";
import { human, villager, box, cylinder, bake, cow, sign } from "./models";
import { scene, camera } from "./scene";
import { places, type Place, type Beat } from "./storyData";
import type { Physics } from "./physics";

function vehicle(tractor: boolean) {
  const g = new T.Group();
  const c = tractor ? "#498280" : "#c6a65f";
  box(g, 0, 0.85, 0, tractor ? 1.45 : 2.3, 0.65, tractor ? 3 : 6, c);
  box(
    g,
    0,
    1.5,
    tractor ? 0.65 : 0,
    tractor ? 1.35 : 2.22,
    1.1,
    tractor ? 1.25 : 5.85,
    "#709098",
  );
  box(
    g,
    0,
    2.12,
    tractor ? 0.65 : 0,
    tractor ? 1.65 : 2.35,
    0.16,
    tractor ? 1.6 : 6,
    c,
  );
  for (const s of [-1, 1])
    for (const end of [-1, 1]) {
      const r = tractor && end === 1 ? 0.75 : 0.48;
      cylinder(
        g,
        s * (tractor ? 0.8 : 1.12),
        r,
        end * (tractor ? 1 : 2),
        r,
        r,
        0.35,
        "#383835",
        12,
      ).rotation.z = Math.PI / 2;
    }
  if (tractor) cylinder(g, 0.42, 1.65, -0.9, 0.09, 0.1, 1.4, "#484442");
  bake(g);
  scene.add(g);
  return g;
}
const residents = [
  ["Валера", "farm", "#698083"],
  ["Баба Зина", "zina", "#854f71"],
  ["Коля", "kolya", "#a28655"],
  ["Петрович", "garage", "#566b82"],
  ["Директор", "forest", "#66574e"],
  ["Гена", "stop", "#846b52"],
  ["Сторож", "club", "#526846"],
  ["Работница", "workers", "#8c5c50"],
] as const;
export class NPCInteraction {
  tractor = vehicle(true);
  quarry = vehicle(true);
  bus = vehicle(false);
  boris = cow();
  marker = new T.Group();
  actors = residents.map(([name, at, c], i) => {
    const actor = villager(name, c, i % 2 === 0);
    const [x, z] = places[at];
    actor.g.position.set(x, 0, z);
    actor.g.scale.setScalar(name === "Баба Зина" ? 0.85 : 1);
    scene.add(actor.g);
    return { name, at, actor, x, z };
  });
  passenger = villager("Валера", "#698083", true);
  driver = human("#695846", true);
  trail: T.Vector3[] = [];
  private guests = [
    villager("Саныч", "#793c38", true),
    villager("Витёк", "#665740", false),
    human("#57594e", true),
  ];
  private busCollider: ReturnType<Physics["box"]>;
  readonly tractorCollider: ReturnType<Physics["box"]>;
  private door: T.Group;
  private doorCollider: ReturnType<Physics["box"]>;
  private visitors = new Map<string, ReturnType<typeof human>>();
  constructor(p: Physics) {
    scene.add(this.boris, this.marker, ...this.guests.map((v) => v.g));
    this.tractor.add(this.passenger.g);
    this.passenger.g.position.set(0.87, 0.55, 0.72);
    this.passenger.g.rotation.y = Math.PI;
    this.quarry.add(this.driver.g);
    this.driver.g.position.set(0, 0.6, 0);
    this.driver.g.rotation.y = Math.PI;
    this.boris.scale.set(1.24, 1.12, 1.2);
    this.bus.position.set(9, 0, 18);
    this.busCollider = p.box(9, 1.05, 18, 2.3, 2.1, 6);
    this.quarry.position.set(-11, 0, -20);
    this.tractor.position.set(17, 0, 4);
    cylinder(this.marker, 0, 0, 0, 0.3, 0, 0.55, "#ffc464");
    this.tractorCollider = p.box(17, 0.92, 4, 1.65, 1.84, 3);
    this.door = new T.Group();
    box(this.door, 0, 1.1, 0, 1.9, 2.2, 0.14, "#66594f");
    scene.add(this.door);
    this.door.position.set(31, 0, -18.7);
    this.doorCollider = p.box(31, 1.1, -18.7, 1.9, 2.2, 0.16);
    for (const [name, color] of [
      ["Коля", "#a28655"],
      ["Валера", "#698083"],
      ["Баба Зина", "#854f71"],
      ["Директор", "#66574e"],
    ]) {
      const n = villager(name, color, true);
      n.g.visible = false;
      this.visitors.set(name, n);
      scene.add(n.g);
    }
    for (const at of ["mill", "garage", "forest", "stop", "store"] as const) {
      const [x, z, label] = places[at];
      const board = sign(label.toUpperCase(), "#f5e6bc", "#46594e", 2.8, 0.56);
      board.position.set(x, 2.7, z - 0.7);
      scene.add(board);
    }
  }
  update(
    b: Beat,
    hero: { x: number; z: number },
    yaw: number,
    dt: number,
    time: number,
    driving: boolean,
  ) {
    const [x, z] = places[b.at];
    for (const r of this.actors) {
      const near = Math.hypot(hero.x - r.x, hero.z - r.z) < 5;
      r.actor.g.position.x =
        r.x + (near ? 0 : Math.sin(time * 0.5 + r.x) * 0.65);
      r.actor.g.rotation.y = near
        ? Math.atan2(hero.x - r.x, hero.z - r.z)
        : Math.cos(time * 0.45);
      r.actor.arms[1].rotation.x =
        Math.sin(time * (near ? 2 : 3)) * 0.38 - 0.28;
      r.actor.g.visible =
        !(r.name === "Директор" && b.chapter < 7) &&
        !(r.name === "Валера" && driving);
    }
    for (const [name, n] of this.visitors) {
      n.g.visible =
        name === b.who &&
        ["talk", "ending", "mount"].includes(b.kind) &&
        !this.actors.some((r) => r.name === name && r.at === b.at);
      if (n.g.visible) {
        const anchor = this.actors.find((r) => r.name === name);
        if (anchor) anchor.actor.g.visible = false;
        n.g.position.set(x, 0, z);
        n.g.rotation.y = Math.atan2(hero.x - x, hero.z - z);
        n.arms[1].rotation.x = -0.3 + Math.sin(time * 1.7) * 0.25;
      }
    }
    this.bus.visible = time < 12;
    if (this.bus.visible) {
      this.bus.position.z = 18 + Math.max(0, time - 3) * 3.5;
      this.busCollider.setTranslation({
        x: 9,
        y: 1.05,
        z: this.bus.position.z,
      });
    }
    this.busCollider.setEnabled(this.bus.visible);
    const locked =
      b.chapter < 7 || (b.chapter === 7 && !["vitek", "prep"].includes(b.id));
    this.door.visible = locked;
    this.doorCollider.setEnabled(locked);
    this.guests.forEach((n, i) => {
      const overheard = b.id === "listen" && i < 2;
      n.g.visible =
        overheard ||
        (["Саныч", "Витёк", "Сторож"][i] === b.who && b.kind === "talk");
      n.g.position.set(x + (overheard ? i * 1.2 - 0.6 : 0), 0, z);
      n.g.rotation.y = overheard
        ? ((i ? -1 : 1) * Math.PI) / 2
        : Math.atan2(hero.x - x, hero.z - z);
    });
    this.marker.position.set(x, 3.4 + 0.15 * Math.sin(time * 3), z);
    this.passenger.g.visible = driving;
    if (driving) {
      this.tractor.position.set(hero.x, 0, hero.z);
      this.tractor.rotation.y = yaw;
    }
    if (b.id === "mount") this.tractor.position.set(17, 0, 4);
    if (b.id === "board") this.tractor.position.set(-14, 0, -21);
    this.tractorCollider.setEnabled(!driving);
    if (!driving)
      this.tractorCollider.setTranslation({
        x: this.tractor.position.x,
        y: 0.92,
        z: this.tractor.position.z,
      });
    this.quarry.visible = ["chase", "catch", "garageFight"].includes(b.id);
    if (b.id === "chase" || b.id === "catch") {
      const tx = b.id === "chase" ? 0 : -14,
        tz = b.id === "chase" ? -22 : -21;
      const pos = this.quarry.position;
      const dist = Math.hypot(tx - pos.x, tz - pos.z);
      if (dist > 0.2) {
        pos.x += ((tx - pos.x) / dist) * dt * 5;
        pos.z += ((tz - pos.z) / dist) * dt * 5;
        this.quarry.rotation.y = Math.atan2(pos.x - tx, pos.z - tz);
      }
    }
    const target =
      b.id === "escort"
        ? hero
        : b.chapter === 5
          ? { x: -22, z: -24 }
          : { x: 23, z: -6 };
    if (b.id !== "escort") {
      this.trail.length = 0;
      this.boris.position.set(target.x, 0, target.z);
    } else {
      const last = this.trail.at(-1);
      if (!last || Math.hypot(last.x - hero.x, last.z - hero.z) > 0.55)
        this.trail.push(new T.Vector3(hero.x, 0, hero.z));
      const point = this.trail[0],
        p = this.boris.position;
      const d = Math.hypot(point.x - p.x, point.z - p.z);
      if (d < 0.22 && this.trail.length > 1) this.trail.shift();
      else if (this.trail.length > 2 || d > 2) {
        const step = Math.min(1, (dt * 4) / Math.max(0.01, d));
        this.boris.rotation.y = Math.atan2(p.z - point.z, point.x - p.x);
        p.lerp(point, step);
      }
    }
  }
}
export class CutsceneManager {
  elapsed = 0;
  private car = vehicle(false);
  private cast = [
    human("#79513e", true),
    human("#697e7c", true),
    human("#854f71", false),
  ];
  constructor() {
    this.car.scale.set(0.74, 0.65, 0.62);
    this.cast.forEach((n) => scene.add(n.g));
    this.clear();
  }
  clear() {
    this.car.visible = false;
    this.cast.forEach((n) => (n.g.visible = false));
  }
  show(at: Place, dt: number, ending: string) {
    this.elapsed += dt;
    const t = Math.min(this.elapsed, 12),
      [x, z] = places[at];
    this.car.visible =
      ending === "Да ну его нахуй" || ending === "Молочный король";
    if (this.car.visible) {
      this.cast.forEach((n) => (n.g.visible = false));
      const leaving = ending === "Да ну его нахуй";
      this.car.position.set(
        leaving ? 1 : x - 1.7,
        0,
        leaving ? z + t * 1.9 : z + 8 - t * 0.6,
      );
      camera.position.set(
        leaving ? 6 : x + 4,
        leaving ? 2.4 : 3,
        z + (leaving ? 9 : 8),
      );
      camera.lookAt(this.car.position.x, 1.25, this.car.position.z);
      return;
    }
    this.cast.forEach((n, i) => {
      n.g.visible = true;
      const meeting = ending === "Деревня будущего";
      n.g.position.set(
        x + (i - 1) * (meeting ? 1.25 : 1.8),
        0,
        z + (i === 1 ? 1 : 2.2),
      );
      n.g.rotation.y = (1 - i) * (meeting ? 0.7 : 0.3);
      n.arms[1].rotation.x =
        (i === 0 && ending === "Новый Саныч" ? -1.2 : -0.5) +
        Math.sin(t * 2 + i) * 0.22;
    });
    camera.position.set(
      x + Math.sin(t * 0.16) * 4,
      ending === "Новый Саныч" ? 1.2 : 3.4,
      z + 7.5 - t * 0.15,
    );
    camera.lookAt(x, 1.3, z + 1);
  }
}
