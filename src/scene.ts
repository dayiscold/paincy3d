import * as T from "three";
export const scene = new T.Scene();
export const camera = new T.PerspectiveCamera(68, 1, 0.07, 340);
export const renderer = new T.WebGLRenderer({
  canvas: document.querySelector("#world")!,
  antialias: true,
});
renderer.setClearColor(0xd5a093);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
export function resize() {
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();
const ambient = new T.HemisphereLight(0xffdddd, 0x738474, 1.8);
scene.add(ambient);
const sun = new T.DirectionalLight(0xffdfae, 2);
sun.position.set(-50, 55, -45);
sun.castShadow = true;
sun.shadow.mapSize.set(1536, 1536);
Object.assign(sun.shadow.camera, {
  left: -58,
  right: 58,
  top: 58,
  bottom: -58,
  far: 180,
});
sun.shadow.camera.updateProjectionMatrix();
sun.shadow.normalBias = 0.06;
scene.add(sun);
scene.fog = new T.FogExp2(0xc29b9a, 0.0075);

export function daylight(night: boolean) {
  const sky = scene.getObjectByName("Небо") as
    | T.Mesh<T.SphereGeometry, T.ShaderMaterial>
    | undefined;
  if (sky) sky.material.uniforms.dusk.value = night ? 1 : 0;
  ambient.intensity = night ? 0.48 : 1.8;
  sun.intensity = night ? 0.25 : 2;
  scene.fog!.color.setHex(night ? 0x454961 : 0xc29b9a);
}
