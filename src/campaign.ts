import { DialogueManager, type Option } from "./storyUI";
import { StoryManager, EventManager, SaveManager } from "./storyState";
import {
  places,
  chapters,
  epilogues,
  story,
  type Place,
  type Answer,
} from "./storyData";
import { incidents, errands } from "./villageJobs";
import { NPCInteraction, CutsceneManager } from "./storyWorld";
import { Enemy } from "./ai";
import { Farm, type FarmResult } from "./farm";
import { QuestManager } from "./quests";
import { Controls } from "./controls";
import { Physics, R } from "./physics";
import { el } from "./ui";
import { daylight } from "./scene";
import { VillageWork } from "./villageWork";

interface Checkpoint {
  story: Pick<
    StoryManager,
    "id" | "count" | "seen" | "ending" | "side" | "carrying" | "completed"
  >;
  rep: { locals: number; gang: number; farm: number; peace: number };
  farm: ReturnType<Farm["snapshot"]>;
  shift: ReturnType<QuestManager["snapshot"]>;
  x: number;
  z: number;
  clock: number;
  slot: number;
  bull: [number, number];
}
function validCheckpoint(data: Checkpoint | null): data is Checkpoint {
  if (!data || !data.story || !data.rep || !data.farm || !data.shift)
    return false;
  const s = data.story,
    f = data.farm;
  const numbers = [
    s.count,
    data.rep.locals,
    data.rep.gang,
    data.rep.farm,
    data.rep.peace,
    f.milk,
    f.cream,
    f.rubles,
    data.x,
    data.z,
    data.clock,
    data.slot,
    data.shift.index,
    data.shift.progress,
  ];
  return (
    numbers.every(Number.isFinite) &&
    data.slot >= 0 &&
    data.slot < 4 &&
    story.some((b) => b.id === s.id) &&
    (s.ending === "" || Object.hasOwn(epilogues, s.ending)) &&
    Array.isArray(s.seen) &&
    Array.isArray(s.completed) &&
    s.completed.every((i) => Number.isInteger(i) && !!errands[i]) &&
    Number.isInteger(s.side) &&
    s.side >= -1 &&
    s.side < errands.length &&
    Array.isArray(f.cows) &&
    f.cows.length === 5 &&
    f.cows.every(
      (c) => c && Number.isFinite(c.ready) && typeof c.fed === "boolean",
    ) &&
    (f.batch === null || Number.isFinite(f.batch)) &&
    Array.isArray(data.bull) &&
    data.bull.length === 2 &&
    data.bull.every(Number.isFinite)
  );
}
const gating = {
  trust: "доверие жителей или банды ≥ 2",
  truce: "доверие ≥ 5 и два мирных решения",
  future:
    "доверие ≥ 9, три мирных решения, развитие ≥ 6 и два сельских ремонта",
};
export class Campaign {
  state = new StoryManager();
  events = new EventManager();
  saves = new SaveManager<Checkpoint>();
  ui: DialogueManager;
  world: NPCInteraction;
  film = new CutsceneManager();
  cinema: Place | null = null;
  eventFoes: Enemy[] = [];
  foes: Enemy[] = [];
  spawned = false;
  trackSide = false;
  duty = 0;
  chatter = 0;
  cover = 0;
  work = new VillageWork();
  time = 0;
  slot = 0;
  constructor(
    private p: Physics,
    private controls: Controls,
    private farm: Farm,
    private shift: QuestManager,
    private notify: (s: string, t?: number) => void,
    private rest: () => void,
  ) {
    this.world = new NPCInteraction(p);
    this.world.update(this.b, this.pos, 0, 0, 0, false);
    this.work.update(this.state, this.events, 0, this.pos, 0);
    this.ui = new DialogueManager((on) => {
      if (on) controls.stop();
      else controls.active = true;
    });
    const compass = document.createElement("div");
    compass.id = "compass";
    el("hud").append(compass);
  }
  private dark: boolean | null = null;
  get pos() {
    return this.controls.actor.body.translation();
  }
  get b() {
    return this.state.beat;
  }
  distance(at: Place) {
    const [x, z] = places[at];
    return Math.hypot(this.pos.x - x, this.pos.z - z);
  }
  withinReach(at: Place) {
    if (this.distance(at) >= 3.7) return false;
    const [x, z] = places[at],
      from = this.pos;
    const dist = this.distance(at);
    if (dist < 0.05) return true;
    const ray = new R.Ray(
      { x: from.x, y: from.y + 0.4, z: from.z },
      { x: (x - from.x) / dist, y: 0, z: (z - from.z) / dist },
    );
    const hit = this.p.world.castRay(
      ray,
      dist - 0.03,
      true,
      undefined,
      undefined,
      undefined,
      this.controls.actor.body,
    );
    return (
      !hit ||
      (this.b.kind === "mount" &&
        hit.collider.handle === this.world.tractorCollider.handle)
    );
  }
  clear() {
    this.clearEventFoes();
    this.foes.forEach((e) => e.remove());
    this.foes = [];
    this.spawned = false;
    this.duty = 0;
  }
  clearEventFoes() {
    this.eventFoes.forEach((e) => e.remove());
    this.eventFoes = [];
  }
  completeEvent() {
    const ev = incidents[this.events.active];
    if (!ev) return;
    this.clearEventFoes();
    this.events.finish();
    this.state.rep.locals++;
    this.farm.rubles += 150;
    this.message(ev[0], ev[3] + " · +150 ₽");
    this.save();
  }
  save() {
    this.farm.price = Math.max(22, 35 + this.state.rep.locals);
    const { id, count, seen, ending, side, carrying, completed, rep } =
      this.state;
    const b = this.world.boris.position;
    if (
      !this.saves.write({
        story: { id, count, seen, ending, side, carrying, completed },
        rep,
        farm: this.farm.snapshot(),
        shift: this.shift.snapshot(),
        x: this.pos.x,
        z: this.pos.z,
        clock: this.time,
        slot: this.slot,
        bull: [b.x, b.z],
      })
    )
      this.notify("Браузер не сохранил контрольную точку", 5);
  }
  get hasSave() {
    return validCheckpoint(this.saves.read());
  }
  restore(fresh = false) {
    this.film.clear();
    this.clear();
    this.ui.close();
    this.cinema = null;
    this.trackSide = false;
    this.pendingJob = -1;
    this.state = new StoryManager();
    this.events = new EventManager();
    const data = fresh ? null : this.saves.read();
    if (validCheckpoint(data)) {
      Object.assign(this.state, data.story);
      Object.assign(this.state.rep, data.rep);
      this.farm.restore(data.farm);
      this.shift.restore(data.shift);
      this.time = data.clock;
      this.slot = data.slot;
      this.controls.actor.body.setTranslation(
        { x: data.x, y: 1, z: data.z },
        true,
      );
      this.world.boris.position.set(data.bull[0], 0, data.bull[1]);
    } else {
      this.farm.rubles = 150;
      this.time = 0;
      this.slot = 0;
    }
    this.sync();
    this.world.update(
      this.b,
      this.pos,
      this.controls.yaw,
      0,
      this.time,
      this.controls.driving,
    );
    this.work.update(this.state, this.events, this.time, this.pos, 0);
    if (fresh) this.save();
  }
  sync() {
    const drive = this.b.kind === "drive";
    this.controls.driving = drive;
    this.controls.actor.collider.setShape(
      drive ? new R.Cuboid(0.85, 0.64, 1.45) : new R.Capsule(0.54, 0.33),
    );
    this.farm.price = Math.max(22, 35 + this.state.rep.locals);
    this.dark = null;
  }
  advance(next?: string) {
    if (this.b.kind === "stealth")
      this.state.rep.apply(
        this.foes.every((e) => e.hp > 0) ? "peace" : "rough",
      );
    if (this.b.id === "prep") this.farm.rubles += 3000;
    if (this.b.id === "mount") this.world.quarry.position.set(0, 0, -5);
    if (this.b.kind === "drive" && this.b.id !== "chase") {
      this.world.tractor.position.set(
        this.b.id === "catch" ? -11 : 19,
        0,
        this.b.id === "catch" ? -19 : 6,
      );
    }
    this.clear();
    this.state.advance(next);
    this.sync();
    this.save();
  }
  farmAction(result: FarmResult, id: number | undefined) {
    const k = this.b.kind;
    if (
      (k === "milk" || k === "feed") &&
      id !== undefined &&
      id >= 0 &&
      result.amounts?.[k] &&
      !this.state.seen.includes(id)
    ) {
      this.state.seen.push(id);
      this.state.count++;
      if (this.state.count >= this.b.count) this.advance();
    }
    if (k === "sale" && result.amounts?.sellMilk) this.advance();
    this.save();
  }
  spawn() {
    const { at, kind, count, id } = this.b;
    const [x, z] = places[at];
    const total =
      count + (this.state.rep.gang < 0 && id === "warehouse" ? 1 : 0);
    for (let i = 0; i < total; i++) {
      // Keep the warehouse raiders in the loading lane, clear of the cattle pens.
      const sx =
        id === "warehouse"
          ? 22 + i * 1.55
          : x + (kind === "stealth" ? 3 : i * 1.55);
      const sz =
        id === "warehouse" ? -10.8 : z + (kind === "stealth" ? 2 : 2.4);
      const foe = new Enemy(
        this.p,
        [
          [sx, sz],
          [sx + 1, sz + 4],
        ],
        id === "boss" ? "#76382e" : "#695846",
        i % 2 === 0,
        id === "boss" ? "Саныч" : id === "vitek" ? "Витёк" : "",
      );
      if (kind === "boss" || id === "vitek") {
        foe.hp = kind === "boss" ? 240 : 130;
        foe.model.g.scale.setScalar(1.15);
      }
      foe.boss = kind === "boss";
      this.foes.push(foe);
    }
    this.spawned = true;
  }
  tick(dt: number) {
    const b = this.b;
    const s = this.state;
    this.world.update(
      b,
      this.pos,
      this.controls.yaw,
      dt,
      this.time,
      this.controls.driving,
    );
    this.work.update(this.state, this.events, this.time, this.pos, dt);
    if (this.cinema) {
      this.film.show(this.cinema, dt, s.ending);
      return;
    }
    if (this.ui.open || s.ending) return;
    this.events.tick(
      dt,
      b.chapter >= 2 && ["talk", "feed", "milk", "sale"].includes(b.kind),
      s.rep.gang,
    );
    if (this.eventFoes.length) {
      if (this.events.active < 0) this.clearEventFoes();
      else if (this.eventFoes.every((e) => e.hp <= 0)) {
        this.completeEvent();
        return;
      }
    }
    if (this.events.following) {
      const at = this.events.active === 1 ? "farm" : "zina";
      const v = this.work.visitorPosition(this.events.active);
      const [x, z] = places[at];
      if (this.distance(at) < 4 && Math.hypot(v.x - x, v.z - z) < 5) {
        this.completeEvent();
        return;
      }
    }
    const dark =
      b.id === "night" ||
      (this.events.active === 5 && this.events.night) ||
      (s.side === 7 && !s.carrying && this.distance("store") < 7);
    if (this.dark !== dark) {
      daylight(dark);
      this.dark = dark;
    }

    if (
      ["fight", "boss", "stealth"].includes(b.kind) &&
      this.distance(b.at) < 16 &&
      !this.spawned
    )
      this.spawn();
    this.cover -= dt;
    if (this.cover <= 0 && ["warehouse", "wave1", "wave2"].includes(b.id)) {
      const threat = this.foes.find(
        (e) => e.hp > 0 && this.work.alliesCover(e.pos.x, e.pos.z),
      );
      if (threat) {
        threat.hit(15);
        this.cover = 3;
        this.notify("Зина свистит. Дежурные оттесняют налётчика.", 1.1);
      }
    }
    if (
      this.spawned &&
      b.kind !== "stealth" &&
      this.foes.every((e) => e.hp === 0)
    ) {
      this.notify(
        b.kind === "boss" ? "Саныч бросает печать." : "Противники отступили.",
      );
      this.advance();
      return;
    }
    if (b.kind === "walk" && this.distance("stop") > 9) {
      this.advance();
      return;
    }
    if (b.id === "arrival" && this.distance("stop") > 11) {
      this.advance("keys");
      this.notify("Гена кричит вслед про обратный билет.");
    }
    if (b.kind === "drive") {
      this.chatter -= dt;
      if (this.chatter <= 0) {
        const lines = [
          "Правее бери, я слева дорогу чинил!",
          "Если железка отвалилась и едем — значит, запасная.",
          "Тормоза есть. Просто они стеснительные.",
        ];
        this.notify(
          "Валера: «" + lines[Math.floor(this.time / 5) % 3] + "»",
          3,
        );
        this.chatter = 5;
      }
      if (
        this.distance(b.at) < 3.4 &&
        (b.id === "driveHome" ||
          this.world.quarry.position.distanceTo(this.world.tractor.position) <
            6)
      ) {
        this.advance();
        return;
      }
    }
    if (this.events.active >= 0 && this.events.remaining >= 65 - dt)
      this.notify(
        "В деревне: " +
          incidents[this.events.active][0] +
          " · " +
          places[incidents[this.events.active][1]][2] +
          " [J]",
        6,
      );
    if (
      b.kind === "escort" &&
      this.distance("farm") < 4 &&
      this.world.boris.position.distanceTo(
        this.world.actors[0].actor.g.position,
      ) < 5
    ) {
      this.notify("Борис дома. Валера закрывает калитку.");
      this.advance();
    }
    if (s.side === 7 && !s.carrying) {
      this.duty = this.distance("store") < 4 ? this.duty + dt : 0;
    }
  }
  get sidePlace() {
    const j = errands[this.state.side];
    return j ? (this.state.carrying ? j.giver : j.site) : null;
  }
  get target() {
    return (
      (this.trackSide && this.sidePlace) ||
      (this.pendingJob >= 0 ? errands[this.pendingJob].giver : null) ||
      this.b.at
    );
  }
  get objective() {
    const b = this.b,
      j = errands[this.state.side];
    if (this.trackSide && j)
      return (
        j.name +
        " · " +
        (this.state.carrying ? "Вернуться к заказчику" : j.action)
      );
    if (this.pendingJob >= 0)
      return "Взять поручение · " + errands[this.pendingJob].name;
    return (
      "Глава " +
      b.chapter +
      " · " +
      chapters[b.chapter - 1] +
      "\n" +
      b.goal +
      (b.kind === "feed" || b.kind === "milk"
        ? " · " + this.state.count + "/" + b.count
        : "")
    );
  }
  guide() {
    const at = this.target,
      [x, z, label] = places[at];
    this.world.marker.position.x = x;
    this.world.marker.position.z = z;
    const angle =
      Math.atan2(x - this.pos.x, -(z - this.pos.z)) + this.controls.yaw;
    const octant = Math.round(angle / (Math.PI / 4));
    const arrow = ["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"][
      ((octant % 8) + 8) % 8
    ];
    el("compass").textContent =
      arrow + " " + label + " · " + Math.round(this.distance(at)) + " м";
  }
  journal() {
    const s = this.state,
      r = s.rep,
      j = errands[s.side];
    const options: Option[] = [
      { label: "К работе [J]", run: () => this.ui.close() },
      {
        label: "Пройденные задания",
        run: () =>
          this.message(
            "Завершено",
            chapters
              .slice(0, this.b.chapter - 1)
              .concat(s.completed.map((i) => errands[i].name))
              .join("\n") || "Первая смена только началась.",
            () => this.journal(),
          ),
      },
    ];
    if (this.pendingJob >= 0)
      options.push({
        label: "Снять отметку поручения",
        run: () => {
          this.pendingJob = -1;
          this.ui.close();
        },
      });
    if (j)
      options.push({
        label: this.trackSide ? "Отметить главу" : "Отметить поручение",
        run: () => {
          this.trackSide = !this.trackSide;
          this.ui.close();
        },
      });
    else options.push({ label: "Доска поручений", run: () => this.board() });
    const ev = incidents[this.events.active];
    this.ui.show(
      "Журнал смены",
      this.b.goal +
        "\n" +
        this.shift.label +
        "\nЖители " +
        r.locals +
        " · Банда " +
        r.gang +
        " · Ферма " +
        r.farm +
        " · Мирных решений " +
        r.peace +
        "\nПоручения " +
        s.completed.length +
        "/" +
        errands.length +
        (j
          ? " · " + j.name + " — " + (s.carrying ? "Вернуться" : j.action)
          : "") +
        (ev ? "\nСейчас в деревне: " + ev[0] + " · " + places[ev[1]][2] : ""),
      options,
    );
  }
  board() {
    const s = this.state;
    this.ui.show(
      "Объявления на сельсовете",
      "Выберите поручение. Сначала заберите заказ у хозяина.",
      errands
        .map((j, i) => ({
          label:
            j.name +
            " · " +
            places[j.giver][2] +
            " · " +
            j.reward +
            " ₽" +
            (s.completed.includes(i)
              ? " ✓"
              : j.giver === "forest" && s.beat.chapter < 7
                ? " · найти директора"
                : j.trust > s.rep.locals
                  ? " · доверие " + j.trust
                  : ""),
          disabled: !this.shift.available(s, i),
          run: () => {
            this.pendingJob = i;
            this.ui.close();
            this.notify(j.request + " · " + places[j.giver][2], 7);
          },
        }))
        .concat([
          { label: "Назад", disabled: false, run: () => this.journal() },
        ]),
    );
  }
  pendingJob = -1;
  options(): Option[] {
    const actions: Option[] = [];
    const b = this.b,
      s = this.state;
    if (
      this.withinReach(b.at) &&
      ["talk", "ending", "mount", "stealth"].includes(b.kind)
    )
      actions.push({ label: b.goal, run: () => this.converse() });
    const j = errands[s.side];
    if (j && this.sidePlace && this.distance(this.sidePlace) < 3.8)
      actions.push({
        label: s.carrying ? "Сдать: " + j.name : j.action,
        run: () => {
          if (!s.carrying && s.side === 7 && this.duty < 15) {
            this.notify(
              "Остаться на посту ещё " + Math.ceil(15 - this.duty) + " с",
            );
            return;
          }
          if (s.carrying && !j.works) {
            this.ui.show(j.name, j.receipt, [
              {
                label: "Получить " + j.reward + " ₽",
                run: () => this.finishJob(false),
              },
              {
                label: "Оставить награду хозяину · доверие жителей",
                run: () => this.finishJob(true),
              },
            ]);
            return;
          }
          if (s.carrying) {
            this.finishJob(false);
            return;
          } else {
            s.carrying = true;
            this.notify("Готово. Вернитесь к заказчику.");
          }
          this.save();
        },
      });
    if (!j)
      for (const [i, job] of errands.entries()) {
        if (!this.shift.available(s, i) || this.distance(job.giver) >= 3.6)
          continue;
        actions.push({
          label: job.name,
          run: () =>
            this.ui.show(
              job.name,
              job.request +
                "\n" +
                job.action +
                " · " +
                places[job.site][2] +
                " · " +
                job.reward +
                " ₽",
              [
                {
                  label: "Берусь",
                  run: () => {
                    if (!this.shift.take(s, i)) return;
                    this.duty = 0;
                    this.trackSide = true;
                    this.pendingJob = -1;
                    this.ui.close();
                    this.save();
                  },
                },
                { label: "В другой раз", run: () => this.ui.close() },
              ],
            ),
        });
      }
    const ev = incidents[this.events.active];
    if (
      ev &&
      !this.events.following &&
      !this.eventFoes.length &&
      this.distance(ev[1]) < 4
    ) {
      actions.push({
        label: ev[2],
        run: () => {
          if (this.events.active === 1 || this.events.active === 9) {
            this.events.following = true;
            this.events.remaining = 100;
            this.notify(
              this.events.active === 1
                ? "Проводи бурёнку к стаду на ферме."
                : "На ошейнике адрес Зины. Отведи пса к её дому.",
              7,
            );
          } else this.completeEvent();
        },
      });
      if ([3, 4, 5].includes(this.events.active))
        actions.push({
          label: "Вмешаться в драку",
          run: () => {
            const [x, z] = places[ev[1]];
            this.events.remaining = 100;
            this.state.rep.apply("rough");
            this.eventFoes.push(
              new Enemy(
                this.p,
                [
                  [x + 2, z + 2],
                  [x + 1, z + 4],
                ],
                "#675549",
                true,
              ),
            );
            this.notify("Оттесните зачинщика от ворот.");
            this.save();
          },
        });
    }
    if (this.distance("home") < 3 && b.chapter >= 2)
      actions.push({
        label: "Перевести дух дома",
        run: () => {
          this.rest();
          this.notify("Дома спокойно. Здоровье восстановлено.");
        },
      });
    const resident = this.world.actors.find(
      (n) => n.actor.g.visible && this.distance(n.at) < 3.3,
    );
    if (resident)
      actions.push({
        label: "Поговорить · " + resident.name,
        run: () => {
          const local: Record<string, string> = {
            Валера: "Я трактор вчера покрасил. Теперь он ломается празднично.",
            Гена: "На обратный билет сбор отдельный. Просто чтоб ты знал.",
            "Баба Зина":
              "Слушай не тех, кто громче. Слушай тех, кто банки возвращает.",
            Директор:
              "В описи восемь станков. В цехе семь. С восьмого мне пишут письма.",
            Коля: "В магазине в долг нельзя. Но у тебя лицо, как у исключения.",
            Петрович: "Деталь отечественная. Напильник в комплект не входит.",
            Сторож:
              "Я тут порядок берегу. С места не сдвинулся, чтоб не расплескать.",
            Работница:
              "У нас молоко высшего сорта. Зарплата пока опытный образец.",
          };
          this.message(
            resident.name,
            (s.rep.locals < 0
              ? "Сначала объясни, чего ты людей пугаешь. "
              : s.rep.locals >= 5
                ? "Про тебя Зина хорошо отзывалась. "
                : "") + local[resident.name],
          );
        },
      });
    if (
      ev &&
      ev[0] === "Приезд торговца" &&
      this.distance("stop") < 4 &&
      this.farm.milk > 0
    )
      actions.push({
        label: "Продать торговцу молоко · 65 ₽/л",
        run: () => {
          const litres = this.farm.milk;
          this.farm.milk = 0;
          this.farm.rubles +=
            litres * 65 + this.shift.record({ sellMilk: litres });
          this.events.finish();
          this.save();
          this.message(
            "Заезжий торговец",
            "Ваши " + litres + " л приняты. За свежесть плачу сверху.",
          );
        },
      });
    if (this.distance("garage") < 3.6 && !this.farm.upgrade)
      actions.push({
        label: "Купить быстрый сепаратор · 600 ₽",
        disabled: this.farm.rubles < 600,
        run: () => {
          this.farm.rubles -= 600;
          this.farm.upgrade = true;
          s.rep.apply("build");
          this.save();
          this.notify("Петрович: Теперь сливки готовы за три секунды.");
        },
      });
    return actions;
  }
  finishJob(gift: boolean) {
    const s = this.state,
      j = errands[s.side];
    if (!j || !s.carrying) return;
    this.farm.rubles += this.shift.deliver(s, gift);
    this.trackSide = false;
    this.save();
    this.message(
      j.name,
      gift
        ? "Хозяин жмёт тебе руку. Про это узнают соседи."
        : j.receipt + " · +" + j.reward + " ₽",
    );
  }
  prompt() {
    if (this.events.following)
      return this.events.active === 1
        ? "Проводить корову на ферму"
        : "Проводить пса к дому Зины";
    if (this.b.kind === "fight" || this.b.kind === "boss")
      return this.spawned
        ? "Противников осталось: " + this.foes.filter((e) => e.hp > 0).length
        : "";
    const first = this.options()[0];
    return first ? "[Q] " + first.label : "";
  }
  interact() {
    const list = this.options();
    if (!list.length) return;
    if (list.length === 1 && !list[0].disabled) {
      list[0].run();
      return;
    }
    this.ui.show(
      "На месте",
      "Выберите действие",
      list
        .map((o) => ({
          ...o,
          run: () => {
            this.ui.close();
            o.run();
          },
        }))
        .concat([{ label: "Уйти", run: () => this.ui.close() }]),
    );
  }
  message(title: string, line: string, done = () => {}) {
    this.ui.show(title, line, [
      {
        label: "Дальше",
        run: () => {
          this.ui.close();
          done();
        },
      },
    ]);
  }
  converse() {
    const b = this.b;
    if (b.id === "toll" && this.farm.milk === 0) {
      this.notify("Бидоны пусты. Принеси молоко с фермы.");
      return;
    }
    if (b.kind === "stealth" && this.foes.some((e) => e.alerted)) {
      this.notify("Часовой смотрит сюда. Уйди из виду.");
      return;
    }
    const finish = (ans?: Answer) => {
      if (ans?.cost) this.farm.rubles -= ans.cost;
      this.state.rep.apply(ans?.effect);
      if (b.kind === "ending" && ans) {
        this.state.ending = ans.reply;
        this.save();
        this.results();
        return;
      }
      this.advance(ans?.next);
      const line = ans?.reply;
      if (line) this.message(b.who, line);
      else this.ui.close();
      if (b.id === "victory") {
        this.cinema = "mill";
        this.film.elapsed = 0;
        this.message(
          "После смены",
          "Рабочие выкатывают бидоны во двор. Коля снимает с ворот чужой замок.\nВалера: «Мужики, завтра всё-таки на работу?»",
          () => {
            this.film.clear();
            this.cinema = null;
          },
        );
      }
    };
    this.ui.show(
      b.who,
      b.line,
      b.answers?.map((a) => ({
        label:
          a.text +
          (a.gate && !this.state.allowed(a.gate) ? " · " + gating[a.gate] : ""),
        disabled:
          (a.cost ?? 0) > this.farm.rubles || !this.state.allowed(a.gate),
        run: () => finish(a),
      })) ?? [
        {
          label: b.kind === "mount" ? "За руль · WASD" : "Продолжить",
          run: () => finish(),
        },
      ],
    );
  }
  results() {
    const end = this.state.ending,
      [at, scene, line] = epilogues[end];
    this.cinema = at;
    this.film.elapsed = 0;
    this.ui.show(end, scene + "\n" + line, [
      {
        label: "Итоги смены",
        run: () =>
          this.ui.show(
            "Итоги · " + end,
            "Поручения " +
              this.state.completed.length +
              "/15 · Жители " +
              this.state.rep.locals +
              " · Хозяйство " +
              this.state.rep.farm +
              " · Касса " +
              this.farm.rubles +
              " ₽",
            [
              { label: "Посмотреть эпилог", run: () => this.results() },
              {
                label: "Вернуться к выбору судьбы фермы",
                run: () => {
                  if (end === "Да ну его нахуй") this.farm.rubles += 3000;
                  this.film.clear();
                  this.cinema = null;
                  this.state.ending = "";
                  this.ui.close();
                  this.save();
                },
              },
            ],
          ),
      },
    ]);
  }
}
