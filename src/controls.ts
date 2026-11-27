import * as T from "three";
import { Physics, R } from "./physics";
export class Controls {
  keys = new Set<string>();
  yaw = 0;
  pitch = 0;
  driving = false;
  jump = false;
  active = false;
  actor: ReturnType<Physics["capsule"]>;
  constructor(
    private physics: Physics,
    private camera: T.PerspectiveCamera,
    x: number,
    z: number,
  ) {
    this.actor = physics.capsule(x, z);
    addEventListener("keydown", (e) => {
      if (!this.active) return;
      e.preventDefault();
      this.keys.add(e.code);
      if (e.code === "Space" && !e.repeat) this.jump = true;
    });
    addEventListener("keyup", (e) => this.keys.delete(e.code));
    addEventListener("mousemove", (e) => {
      if (!this.active) return;
      this.yaw = (this.yaw - e.movementX * 0.0022) % (Math.PI * 2);
      this.pitch = T.MathUtils.clamp(
        this.pitch - e.movementY * 0.0022,
        -1.44,
        1.44,
      );
    });
  }
  stop() {
    this.active = false;
    this.keys.clear();
    this.jump = false;
  }
  move() {
    const { body } = this.actor,
      pos = body.translation(),
      vel = body.linvel();
    const strafe =
        Number(this.keys.has("KeyD")) - Number(this.keys.has("KeyA")),
      forward = Number(this.keys.has("KeyW")) - Number(this.keys.has("KeyS"));
    const speed =
      (this.keys.has("ShiftLeft") || this.keys.has("ShiftRight") ? 7 : 4.2) /
      Math.max(1, Math.hypot(strafe, forward));
    if (this.driving) {
      this.yaw -= strafe * 0.032 * (forward < 0 ? -1 : 1);
      this.actor.collider.setRotationWrtParent({
        x: 0,
        y: Math.sin(this.yaw / 2),
        z: 0,
        w: Math.cos(this.yaw / 2),
      });
      body.setLinvel(
        {
          x: -Math.sin(this.yaw) * forward * 9,
          y: vel.y,
          z: -Math.cos(this.yaw) * forward * 9,
        },
        true,
      );
      this.jump = false;
      return;
    }
    const grounded =
      this.jump &&
      this.physics.world.castRay(
        new R.Ray(pos, { x: 0, y: -1, z: 0 }),
        0.94,
        true,
        undefined,
        undefined,
        undefined,
        body,
      );
    body.setLinvel(
      {
        x: (strafe * Math.cos(this.yaw) - forward * Math.sin(this.yaw)) * speed,
        y: grounded ? 7 : vel.y,
        z:
          (-strafe * Math.sin(this.yaw) - forward * Math.cos(this.yaw)) * speed,
      },
      true,
    );
    this.jump = false;
  }
  view() {
    const p = this.actor.body.translation();
    this.camera.position.set(p.x, p.y + (this.driving ? 2.1 : 0.72), p.z);
    this.camera.rotation.set(this.pitch, this.yaw, 0, "YXZ");
  }
}
