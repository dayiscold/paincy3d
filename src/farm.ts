import * as T from "three";
import { cow } from "./models";
import { scene } from "./scene";
import { Physics } from "./physics";
import { sound } from "./audio";
export interface FarmResult {
  message: string;
  amounts?: Partial<Record<"milk" | "sellMilk" | "feed" | "sellCream", number>>;
}

const counter = -1;
const feedPrice = 20;
const batchLitres = 4;
const creamPrice = 190;
const batchSeconds = 6;
export class Farm {
  price = 35;
  upgrade = false;
  milk = 0;
  rubles = 0;
  cream = 0;
  private batchReady: number | null = null;
  cows: { model: T.Group; ready: number; fed: boolean }[] = [];
  constructor(p: Physics) {
    for (const [x, z, a] of [
      [11, -2, 0.4],
      [17, -5, -0.7],
      [22, -2, 0.2],
      [10, -6, -0.2],
      [22, -6, 0.4],
    ]) {
      const model = cow();
      model.position.set(x, 0, z);
      model.rotation.y = a;
      scene.add(model);
      p.box(x, 0.8, z, 2.1, 1.6, 1);
      this.cows.push({ model, ready: 0, fed: false });
    }
  }
  target(camera: T.PerspectiveCamera) {
    const dir = camera.getWorldDirection(new T.Vector3());
    const objects = [
      ...this.cows.map((c, i) => ({
        id: i,
        pos: c.model.position.clone().add(new T.Vector3(0, 1.2, 0)),
      })),
      { id: counter, pos: new T.Vector3(-7.5, 1.3, 0.65) },
    ];
    return objects
      .filter((o) => {
        o.pos.sub(camera.position);
        return (
          o.pos.length() < 3.8 && o.pos.clone().normalize().dot(dir) > 0.55
        );
      })
      .sort((a, b) => a.pos.lengthSq() - b.pos.lengthSq())[0]?.id;
  }
  prompt(id: number | undefined, t: number) {
    if (id === undefined) return "";
    if (id === counter) {
      const sale = this.saleValue
        ? "[E] Продать всё · " + this.saleValue + " ₽"
        : "Приём молока · " + this.price + " ₽/л";
      let process = "[F] Сделать сливки · " + batchLitres + " л";
      if (this.batchReady !== null)
        process =
          t >= this.batchReady
            ? "[F] Забрать сливки"
            : "Сепаратор · ещё " + Math.ceil(this.batchReady - t) + " с";
      return sale + "\n" + process;
    }
    const cow = this.cows[id];
    const milk =
      cow.ready > t
        ? "Следующее доение через " + Math.ceil(cow.ready - t) + " с"
        : "[E] Подоить · " + (cow.fed ? 4 : 2) + " л";
    return (
      milk +
      "\n" +
      (cow.fed ? "Корова накормлена" : "[F] Дать корм · " + feedPrice + " ₽")
    );
  }
  private get saleValue() {
    return this.milk * this.price + this.cream * creamPrice;
  }
  interact(
    id: number | undefined,
    t: number,
    secondary: boolean,
  ): FarmResult | undefined {
    if (id === undefined) return;
    if (id === counter) {
      if (secondary) return this.process(t);
      const earned = this.saleValue;
      if (!earned)
        return { message: "Сначала подоите корову или заберите сливки" };
      const amounts = { sellMilk: this.milk, sellCream: this.cream };
      this.rubles += earned;
      this.milk = this.cream = 0;
      sound("sell");
      return { message: "Продано · +" + earned + " ₽", amounts };
    }
    const cow = this.cows[id];
    if (secondary) {
      if (cow.fed) return { message: "Бурёнка уже накормлена" };
      if (this.rubles < feedPrice)
        return { message: "На корм нужно " + feedPrice + " ₽" };
      this.rubles -= feedPrice;
      cow.fed = true;
      return {
        message: "Корм выдан · следующее доение даст 4 л",
        amounts: { feed: 1 },
      };
    }
    if (cow.ready > t) return { message: "Бурёнке нужен отдых" };
    const litres = cow.fed ? 4 : 2;
    cow.fed = false;
    cow.ready = t + 24;
    this.milk += litres;
    sound("milk");
    return { message: "+" + litres + " л молока", amounts: { milk: litres } };
  }
  private process(t: number): FarmResult {
    if (this.batchReady !== null) {
      if (t < this.batchReady) return { message: "Сепаратор ещё работает" };
      this.cream++;
      this.batchReady = null;
      return { message: "Получена банка сливок · " + creamPrice + " ₽" };
    }
    if (this.milk < batchLitres)
      return { message: "Для сепаратора нужно " + batchLitres + " л молока" };
    this.milk -= batchLitres;
    this.batchReady = t + (this.upgrade ? 3 : batchSeconds);
    return {
      message:
        "Сливки будут готовы через " + (this.upgrade ? 3 : batchSeconds) + " с",
    };
  }
  snapshot() {
    return {
      milk: this.milk,
      cream: this.cream,
      rubles: this.rubles,
      upgrade: this.upgrade,
      batch: this.batchReady,
      cows: this.cows.map(({ ready, fed }) => ({ ready, fed })),
    };
  }
  restore(data: ReturnType<Farm["snapshot"]>) {
    this.milk = data.milk;
    this.cream = data.cream;
    this.rubles = data.rubles;
    this.upgrade = data.upgrade;
    this.batchReady = data.batch;
    data.cows.forEach((v, i) => Object.assign(this.cows[i], v));
  }
  reset() {
    this.upgrade = false;
    this.price = 35;
    for (const cow of this.cows) {
      cow.ready = 0;
      cow.fed = false;
    }
    this.batchReady = null;
    this.milk = this.cream = this.rubles = 0;
  }
}
