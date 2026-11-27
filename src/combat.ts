import * as T from "three";
import { Enemy } from "./ai";
import { weapon } from "./models";
import { Physics, R } from "./physics";
import { sound } from "./audio";
import { weapons } from "./weapons";

export class Combat {
  slot = 0;
  private elapsed: number | null = null;
  private models = weapons.map((w) => weapon(w.id));

  constructor(private camera: T.PerspectiveCamera) {
    camera.add(...this.models);
    this.pose(false, 0);
  }
  reset() {
    this.elapsed = null;
    this.slot = 0;
  }
  select(slot: number) {
    if (this.elapsed === null && weapons[slot]) this.slot = slot;
  }
  attack() {
    if (this.elapsed !== null) return;
    this.elapsed = 0;
    sound("swing");
  }
  step(dt: number, foes: Enemy[], physics: Physics, body: R.RigidBody) {
    if (this.elapsed === null) return false;
    const w = weapons[this.slot];
    const previous = this.elapsed;
    this.elapsed += dt;
    const contact = previous < w.windup && this.elapsed >= w.windup;
    if (this.elapsed >= w.windup + w.recovery) this.elapsed = null;
    if (!contact) return false;
    const ray = new R.Ray(this.camera.position, this.camera.getWorldDirection(new T.Vector3()));
    const hit = physics.world.castRay(ray, w.range, true, undefined, undefined, undefined, body);
    const enemy = foes.find((e) => e.hp > 0 && hit?.collider.handle === e.actor.collider.handle);
    if (!enemy) return false;
    enemy.hit(w.damage);
    sound("hit");
    return true;
  }
  pose(visible: boolean, bob: number) {
    this.models.forEach((m, i) => { m.visible = visible && i === this.slot; });
    if (!visible) return;
    const m = this.models[this.slot];
    const w = weapons[this.slot];
    const t = this.elapsed ?? 0;
    const windup = Math.min(t / w.windup, 1);
    const draw = Math.sin(windup * Math.PI);
    const strike = t < w.windup ? windup ** 3 : Math.max(0, 1 - (t - w.windup) / w.recovery) ** 2;
    const thrust = w.id === "fork" || w.id === "fists";
    m.position.set(0.24 - 0.11 * strike, -0.28 + bob * 0.5 + 0.04 * draw, -0.58 + 0.08 * draw - 0.22 * strike);
    m.rotation.set(
      (w.id === "fists" ? -0.18 : -0.82) + 0.35 * draw - (thrust ? 0.5 : 0.95) * strike,
      0, w.id === "fists" ? 0 : -0.20 - 0.22 * draw + (thrust ? 0 : 0.72 * strike),
    );
  }
}
