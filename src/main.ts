import "./style.css";
import * as T from "three";
import { camera, scene, renderer } from "./scene";
import { initPhysics, STEP } from "./physics";
import { Controls } from "./controls";
import { buildWorld } from "./world";
import { spawnEnemies } from "./ai";
import { Combat } from "./combat";
import { Farm } from "./farm";
import { Campaign } from "./campaign";
import { QuestManager } from "./quests";
import { weapons } from "./weapons";
import { sound, toggleSound, unlock } from "./audio";
import { buildUI, el, hud, menu, soundLabel } from "./ui";

buildUI();
async function run() {
  const physics = await initPhysics();
  buildWorld(physics);
  const controls = new Controls(physics, camera, 3, 9),
    farm = new Farm(physics),
    quests = new QuestManager(),
    combat = new Combat(camera);
  const campaign = new Campaign(physics, controls, farm, quests, notify, () => {
    health = 100;
  });
  let enemies: ReturnType<typeof spawnEnemies> = [];
  // First-person equipment is added later and stays outside the village shadow map.
  scene.traverse((object) => {
    if (
      object instanceof T.Mesh &&
      object.material instanceof T.MeshStandardMaterial &&
      !object.material.transparent
    ) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  scene.add(camera);
  const hero = controls.actor.body;
  let mode: "ready" | "pause" | "death" | "game" = "ready",
    health = 100,
    clock = 0,
    acc = 0,
    previous = 0,
    noticeUntil = 0,
    damageTime = 0,
    foot = 0;
  const canvas = renderer.domElement;
  function notify(msg: string, seconds = 2.2) {
    el("notice").textContent = msg;
    noticeUntil = clock + seconds;
  }
  let newShift = false;
  function reset() {
    hero.setTranslation({ x: 4, y: 1, z: 17 }, true);
    hero.setLinvel({ x: 0, y: 0, z: 0 }, true);
    controls.yaw = -0.58;
    controls.pitch = 0;
    health = 100;
    clock = 0;
    damageTime = -2;
    foot = 0;
    farm.reset();
    quests.reset();
    combat.reset();
    enemies.forEach((e) => e.remove());
    enemies = [];
    campaign.restore(newShift);
    newShift = false;
    clock = campaign.time;
    combat.select(campaign.slot);
  }
  function pause(dead = false) {
    if (mode !== "game") return;
    mode = dead ? "death" : "pause";
    controls.stop();
    menu(mode);
    el("new-shift").hidden = !campaign.hasSave;
    acc = 0;
    if (document.pointerLockElement) document.exitPointerLock();
  }
  function start() {
    if (mode === "game") return;
    const fresh = mode === "ready" || mode === "death";
    if (fresh) reset();
    mode = "game";
    menu("game");
    controls.active = true;
    controls.view();
    if (campaign.state.ending) campaign.results();
    if (campaign.ui.open) controls.stop();
    if (fresh) notify("Лето 2026. [Q] — обратиться, [J] — открыть журнал.", 5);
  }
  document.addEventListener("pointerlockchange", () => {
    if (document.pointerLockElement === canvas) start();
    else pause();
  });
  document.addEventListener("pointerlockerror", () => {
    el("intro").textContent =
      "Для обзора мышью разрешите захват курсора и нажмите кнопку ещё раз.";
  });
  el("start").onclick = async () => {
    unlock();
    sound("click");
    try {
      await canvas.requestPointerLock();
    } catch {
      el("intro").textContent =
        "Захват мыши недоступен. Откройте игру в отдельной вкладке.";
    }
  };
  el("new-shift").onclick = () => {
    if (
      !confirm(
        "Начать с автобуса? Текущую контрольную точку заменит новая смена.",
      )
    )
      return;
    newShift = true;
    mode = "ready";
    el("start").click();
  };
  el("audio").onclick = () => {
    unlock();
    soundLabel(toggleSound());
    sound("click");
  };
  addEventListener("blur", () => pause());
  addEventListener("mousedown", (e) => {
    if (
      mode === "game" &&
      !campaign.ui.open &&
      !controls.driving &&
      e.button === 0
    ) {
      combat.attack();
      campaign.work.react();
    }
  });
  addEventListener("keydown", (e) => {
    if (mode !== "game" || e.repeat) return;
    if (campaign.ui.open) {
      if (/^Digit[1-7]$/.test(e.code))
        campaign.ui.choose(Number(e.code.slice(-1)) - 1);
      if (e.code === "KeyJ" && !campaign.cinema) campaign.ui.close();
      if (e.code === "Escape") pause();
      return;
    }
    if (e.code === "KeyJ") {
      campaign.journal();
      return;
    }
    if (e.code === "KeyQ") {
      campaign.interact();
      return;
    }
    if (/^Digit[1-4]$/.test(e.code)) {
      const slot = Number(e.code.slice(-1)) - 1;
      combat.select(slot);
      if (combat.slot === slot) {
        sound("click");
        campaign.slot = slot;
        campaign.save();
      }
    }
    if (e.code === "KeyE" || e.code === "KeyF") {
      controls.view();
      const target = farm.target(camera);
      const result = farm.interact(target, clock, e.code === "KeyF");
      if (result) {
        const reward = quests.record(result.amounts);
        farm.rubles += reward;
        campaign.farmAction(result, target);
        notify(
          result.message +
            (reward ? " · Задание выполнено! +" + reward + " ₽" : ""),
        );
      }
    }
    if (e.code === "Escape") pause();
  });
  function hurt() {
    if (mode !== "game") return;
    health = Math.max(0, health - 12);
    damageTime = clock;
    sound("hurt");
    if (!health) pause(true);
    else notify("«Слышь, а молоко по знакомству?»", 1.1);
  }
  menu("ready");
  if (campaign.hasSave) {
    el("startText").textContent = "Продолжить смену";
    el("new-shift").hidden = false;
  }
  function frame(now: number) {
    const dt = Math.min(0.1, (now - previous) / 1000);
    previous = now;
    if (mode === "game" && campaign.ui.open) {
      acc = 0;
      combat.pose(false, 0);
      if (campaign.cinema)
        campaign.film.show(campaign.cinema, dt, campaign.state.ending);
    } else if (mode === "game") {
      campaign.slot = combat.slot;
      if (campaign.b.chapter === 6 && !enemies.length)
        enemies = spawnEnemies(physics);
      if (campaign.b.chapter !== 6 && enemies.length) {
        enemies.forEach((e) => e.remove());
        enemies = [];
      }
      const foes = enemies.concat(campaign.foes, campaign.eventFoes);
      acc += dt;
      while (acc >= STEP && mode === "game") {
        controls.move();
        controls.view();
        if (combat.step(STEP, foes, physics, hero)) notify("Попадание", 0.5);
        for (const enemy of foes)
          enemy.update(STEP, hero.translation(), hurt, hero);
        if (mode !== "game") break;
        physics.world.step();
        clock += STEP;
        acc -= STEP;
      }
      if (mode !== "game") {
        requestAnimationFrame(frame);
        return;
      }
      campaign.time = clock;
      campaign.tick(dt);
      campaign.guide();
      controls.view();
      const speed = Math.hypot(hero.linvel().x, hero.linvel().z);
      if (speed > 1 && Math.abs(hero.linvel().y) < 0.4) {
        foot += dt * speed;
        if (foot >= 2) {
          sound("step");
          foot %= 2;
        }
      }
      const bob = speed > 1 ? Math.sin(foot * Math.PI) * 0.035 : 0;
      camera.position.y += bob;
      combat.pose(mode === "game" && !controls.driving, bob);
      hud(
        health,
        farm.milk,
        farm.cream,
        farm.rubles,
        "[" + (combat.slot + 1) + "]  " + weapons[combat.slot].name,
        campaign.objective + "  ·  [J]",
        [farm.prompt(farm.target(camera), clock), campaign.prompt()]
          .filter(Boolean)
          .join("\n"),
      );
      if (clock > noticeUntil) el("notice").textContent = "";
      el("wound").style.opacity = String(
        Math.max(0, 1 - (clock - damageTime) * 3),
      );
    } else if (mode === "ready") {
      const sway = Math.sin(now * 0.00009);
      camera.position.set(14.5 + sway * 0.42, 3.7, 32);
      camera.lookAt(-0.4, 4, -15);
    }
    if (mode !== "game") combat.pose(false, 0);
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
run().catch((err) => {
  el("intro").textContent = "Ошибка загрузки игры: " + String(err);
  console.error(err);
});
