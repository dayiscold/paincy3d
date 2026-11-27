import { story, type Effect } from "./storyData";
import { errands } from "./villageJobs";
export class ReputationSystem {
  locals = 0;
  gang = 0;
  farm = 0;
  peace = 0;
  apply(effect?: Effect) {
    if (effect === "peace") {
      this.peace++;
      this.locals += 2;
    }
    if (effect === "rough") {
      this.gang -= 2;
      this.locals--;
    }
    if (effect === "gang") {
      this.gang += 2;
    }
    if (effect === "trust") this.locals += 2;
    if (effect === "build") this.farm += 2;
  }
}
export class StoryManager {
  id = "arrival";
  seen: number[] = [];
  count = 0;
  ending = "";
  side = -1;
  carrying = false;
  completed: number[] = [];
  rep = new ReputationSystem();
  get beat() {
    return story.find((b) => b.id === this.id)!;
  }
  allowed(gate?: string) {
    if (gate === "trust") return this.rep.locals >= 2 || this.rep.gang >= 2;
    if (gate === "truce") return this.rep.locals >= 5 && this.rep.peace >= 2;
    if (gate === "future")
      return (
        this.rep.locals >= 9 &&
        this.rep.peace >= 3 &&
        this.rep.farm >= 6 &&
        this.completed.filter((i) => errands[i].works).length >= 2
      );
    return true;
  }
  advance(next?: string) {
    const b = this.beat;
    if (["seal", "battery", "post"].includes(b.id)) this.rep.apply("build");
    if (["returnJars", "allies", "release"].includes(b.id))
      this.rep.apply("trust");
    this.id = next ?? b.next ?? story[story.indexOf(b) + 1]?.id ?? b.id;
    this.count = 0;
    this.seen = [];
  }
}
export class SaveManager<T> {
  private key = "paincy.milk-wars.1";
  read(): T | null {
    try {
      return JSON.parse(localStorage.getItem(this.key) ?? "null");
    } catch {
      return null;
    }
  }
  write(data: T) {
    try {
      localStorage.setItem(this.key, JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }
}
export class EventManager {
  following = false;
  night = false;
  wait = 80;
  active = -1;
  remaining = 0;
  tick(dt: number, available: boolean, gang: number) {
    if (!available) {
      this.following = false;
      this.active = -1;
      this.wait = Math.max(35, this.wait);
      return;
    }
    if (this.active >= 0) {
      this.remaining -= dt;
      if (this.remaining <= 0) this.finish();
      return;
    }
    this.wait -= dt;
    if (this.wait <= 0) {
      this.active =
        gang < 0 && Math.random() < 0.35 ? 5 : Math.floor(Math.random() * 10);
      this.night = this.active === 5;
      this.remaining = 65;
    }
  }
  finish() {
    this.following = false;
    this.night = false;
    this.active = -1;
    this.wait = 75 + Math.random() * 70;
  }
}
