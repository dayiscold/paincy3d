import * as T from "three";
import { Physics, R } from "./physics";
import { human, villager } from "./models";
import { scene } from "./scene";
export class Enemy {
  actor: ReturnType<Physics["capsule"]>;
  model: ReturnType<typeof human>;
  hp = 75;
  boss = false;
  private stamp = false;
  private rushTimer = 3;
  private rushX = 0;
  private rushZ = 0;
  private connected = false;
  private state: "patrol" | "chase" | "search" = "patrol";
  private lastSeen = new T.Vector2();
  private memory = 0;
  private attackTime: number | null = null;
  private target = 1;
  private cooldown = 0;
  private flash = 0;
  private phase = 0;
  constructor(
    private physics: Physics,
    private path: number[][],
    color: string,
    hat: boolean,
    name = "",
  ) {
    this.actor = physics.capsule(path[0][0], path[0][1]);
    this.model = villager(name, color, hat);
    this.model.g.traverse((m) => {
      if (m instanceof T.Mesh) {
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });
    scene.add(this.model.g);
    this.sync();
  }
  get alerted() {
    return this.state !== "patrol" && this.hp > 0;
  }
  get pos() {
    return this.actor.body.translation();
  }
  sync() {
    const p = this.pos;
    this.model.g.position.set(p.x, p.y - 0.87, p.z);
  }
  update(
    dt: number,
    player: { x: number; y: number; z: number },
    damage: () => void,
    playerBody: R.RigidBody,
  ) {
    this.cooldown -= dt;
    if (this.hp <= 0) {
      this.model.g.rotation.z = Math.min(
        1.52,
        this.model.g.rotation.z + dt * 4,
      );
      this.model.g.position.y = 0.34;
      return;
    }
    const p = this.pos,
      dx = player.x - p.x,
      dz = player.z - p.z,
      dist = Math.hypot(dx, dz);
    if (this.boss && dist < 12) {
      this.rushTimer -= dt;
      if (this.rushTimer < 1.4 && this.rushTimer > 0.8) {
        this.stamp = this.hp < 110 && dist < 3;
        this.model.g.rotation.y = Math.atan2(dx, dz);
        this.rushX = dx / Math.max(0.01, dist);
        this.rushZ = dz / Math.max(0.01, dist);
        this.model.arms[0].rotation.x = -1.6;
        this.model.arms[1].rotation.x = -1.6;
        this.actor.body.setLinvel(
          { x: 0, y: this.actor.body.linvel().y, z: 0 },
          true,
        );
        this.connected = false;
        this.sync();
        return;
      }
      if (this.rushTimer <= 0.8 && this.rushTimer > 0) {
        this.actor.body.setLinvel(
          {
            x: this.stamp ? 0 : this.rushX * 7,
            y: this.actor.body.linvel().y,
            z: this.stamp ? 0 : this.rushZ * 7,
          },
          true,
        );
        if (
          (this.stamp ? dist < 3 && player.y - p.y < 0.6 : dist < 1.7) &&
          !this.connected
        ) {
          const delta = new T.Vector3(dx, player.y - p.y, dz);
          const ray = new R.Ray(p, delta.clone().normalize());
          const hit = this.physics.world.castRay(
            ray,
            delta.length(),
            true,
            undefined,
            undefined,
            undefined,
            this.actor.body,
          );
          if (!hit || hit.collider.parent()?.handle === playerBody.handle) {
            damage();
            this.connected = true;
          }
        }
        this.sync();
        return;
      }
      if (this.rushTimer <= 0) this.rushTimer = this.hp < 100 ? 2.8 : 4.5;
    }
    const facing = this.model.g.rotation.y;
    const ahead =
      (Math.sin(facing) * dx + Math.cos(facing) * dz) / Math.max(0.001, dist);
    const aware = this.state !== "patrol";
    let visible = false;
    if (dist < (aware ? 13 : 8) && (aware || dist < 2.5 || ahead > 0.35)) {
      const delta = new T.Vector3(dx, player.y - p.y, dz);
      const length = delta.length();
      const ray = new R.Ray(p, delta.normalize());
      const hit = this.physics.world.castRay(
        ray,
        length,
        true,
        undefined,
        undefined,
        undefined,
        this.actor.body,
      );
      visible = !hit || hit.collider.parent()?.handle === playerBody.handle;
    }
    if (visible) {
      this.state = "chase";
      this.lastSeen.set(player.x, player.z);
      this.memory = 4;
    } else if (this.state !== "patrol") {
      this.memory -= dt;
      this.state = this.memory > 0 ? "search" : "patrol";
    }
    const patrol = this.state === "patrol";
    const x = (patrol ? this.path[this.target][0] : this.lastSeen.x) - p.x,
      z = (patrol ? this.path[this.target][1] : this.lastSeen.y) - p.z,
      len = Math.hypot(x, z);
    if (patrol && len < 0.6) this.target = (this.target + 1) % this.path.length;
    const inReach = visible && dist < 1.65 && Math.abs(p.y - player.y) < 1.45;
    if (inReach && this.cooldown <= 0 && this.attackTime === null) {
      this.attackTime = 0;
      this.model.g.rotation.y = Math.atan2(dx, dz);
      this.cooldown = 1.35;
    }
    let armAngle = 0;
    let speed = patrol ? 1 : this.state === "chase" ? 2.55 : 1.6;
    if (this.attackTime !== null) {
      const windup = 0.42;
      const before = this.attackTime;
      this.attackTime += dt;
      if (
        before < windup &&
        this.attackTime >= windup &&
        inReach &&
        ahead > 0.6
      )
        damage();
      // Pull the shoulder back, punch forward, then lower the arm.
      const t = this.attackTime;
      armAngle =
        t < 0.3
          ? (0.9 * t) / 0.3
          : t < windup
            ? 0.9 - (2.5 * (t - 0.3)) / (windup - 0.3)
            : -1.6 * Math.max(0, 1 - (t - windup) / 0.32);
      speed = 0;
      if (t >= windup + 0.32) this.attackTime = null;
    } else if (this.state === "search" && len < 0.5) {
      speed = 0;
      this.model.g.rotation.y += dt * 1.8;
    } else {
      this.model.g.rotation.y = Math.atan2(x, z);
      if (inReach && dist < 1.28) speed = 0;
    }
    this.actor.body.setLinvel(
      {
        x: (x / Math.max(0.01, len)) * speed,
        y: this.actor.body.linvel().y,
        z: (z / Math.max(0.01, len)) * speed,
      },
      true,
    );
    this.phase += dt * speed * 4;
    this.flash = Math.max(0, this.flash - dt);
    this.model.g.rotation.set(
      this.flash * 1.8,
      this.model.g.rotation.y,
      Math.sin(this.phase * 0.5) * 0.04,
    );
    this.model.legs.forEach(
      (l, i) =>
        (l.rotation.x = speed ? Math.sin(this.phase + i * Math.PI) * 0.35 : 0),
    );
    this.model.arms[0].rotation.x = -this.model.legs[0].rotation.x;
    this.model.arms[1].rotation.x = armAngle - this.model.legs[1].rotation.x;
    this.sync();
  }
  hit(n: number) {
    this.hp = Math.max(0, this.hp - n);
    this.flash = 0.19;
    if (!this.hp) this.actor.body.setEnabled(false);
  }
  remove() {
    scene.remove(this.model.g);
    this.physics.world.removeRigidBody(this.actor.body);
  }
}
export function spawnEnemies(p: Physics) {
  return [
    new Enemy(
      p,
      [
        [-1, -8],
        [2, -17],
        [-2, -23],
      ],
      "#805746",
      true,
    ),
    new Enemy(
      p,
      [
        [-18, 4],
        [-30, 4],
        [-25, 6],
      ],
      "#4c6271",
      false,
    ),
    new Enemy(
      p,
      [
        [2, 25],
        [1, 37],
        [-2, 32],
      ],
      "#66714a",
      true,
    ),
  ];
}
