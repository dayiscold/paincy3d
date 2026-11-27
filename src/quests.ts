import { errands } from "./villageJobs";
import type { StoryManager } from "./storyState";
import type { FarmResult } from "./farm";

const jobs = [
  { action: "milk", title: "Подоить корову", unit: "л", goal: 2, reward: 15 },
  {
    action: "sellMilk",
    title: "Сдать молоко у прилавка",
    unit: "л",
    goal: 2,
    reward: 25,
  },
  {
    action: "feed",
    title: "Покормить корову",
    unit: "раз",
    goal: 1,
    reward: 20,
  },
  {
    action: "sellCream",
    title: "Сделать и продать сливки",
    unit: "банка",
    goal: 1,
    reward: 80,
  },
] as const;

export class QuestManager {
  private index = 0;
  private progress = 0;

  take(state: StoryManager, index: number) {
    if (!this.available(state, index)) return false;
    state.side = index;
    state.carrying = false;
    return true;
  }
  available(state: StoryManager, index: number) {
    const job = errands[index];
    return (
      !!job &&
      state.side < 0 &&
      !state.completed.includes(index) &&
      state.rep.locals >= job.trust &&
      (job.giver !== "forest" || state.beat.chapter >= 7)
    );
  }
  deliver(state: StoryManager, gift: boolean) {
    const job = errands[state.side];
    if (!job || !state.carrying) return 0;
    state.completed.push(state.side);
    state.side = -1;
    state.carrying = false;
    if (job.works) {
      state.rep.apply("build");
      state.rep.locals++;
    } else state.rep.locals += gift ? 5 : 3;
    return gift ? 0 : job.reward;
  }
  get label() {
    const job = jobs[this.index];
    if (!job) return "Все задания смены выполнены";
    return (
      job.title +
      " · " +
      this.progress +
      "/" +
      job.goal +
      " " +
      job.unit +
      " · +" +
      job.reward +
      " ₽"
    );
  }
  record(amounts: FarmResult["amounts"]) {
    const job = jobs[this.index];
    if (!job || !amounts) return 0;
    this.progress += amounts[job.action] ?? 0;
    if (this.progress < job.goal) return 0;
    this.index++;
    this.progress = 0;
    return job.reward;
  }
  snapshot() {
    return { index: this.index, progress: this.progress };
  }
  restore(data: ReturnType<QuestManager["snapshot"]>) {
    this.index = data.index;
    this.progress = data.progress;
  }
  reset() {
    this.index = this.progress = 0;
  }
}
