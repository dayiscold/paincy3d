import R from "@dimforge/rapier3d-compat";
export const STEP = 1 / 60;
export class Physics {
  world = new R.World({ x: 0, y: -20, z: 0 });
  constructor() {
    this.world.timestep = STEP;
  }
  box(x: number, y: number, z: number, w: number, h: number, d: number) {
    return this.world.createCollider(
      R.ColliderDesc.cuboid(w / 2, h / 2, d / 2).setTranslation(x, y, z),
    );
  }
  capsule(x: number, z: number) {
    const body = this.world.createRigidBody(
      R.RigidBodyDesc.dynamic()
        .setTranslation(x, 1, z)
        .lockRotations()
        .setCanSleep(false)
        .setCcdEnabled(true),
    );
    const collider = this.world.createCollider(
      R.ColliderDesc.capsule(0.54, 0.33)
        .setFriction(0)
        .setFrictionCombineRule(R.CoefficientCombineRule.Min)
        .setRestitution(0),
      body,
    );
    return { body, collider };
  }
}
export async function initPhysics() {
  await R.init();
  return new Physics();
}
export { R };
