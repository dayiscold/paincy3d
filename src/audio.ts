let ctx: AudioContext | undefined;
export let muted = false;
export function unlock() {
  ctx ??= new AudioContext();
  void ctx.resume();
}
export function toggleSound() {
  muted = !muted;
  return muted;
}
export function sound(
  kind: "hit" | "swing" | "milk" | "sell" | "hurt" | "step" | "click",
) {
  if (!ctx || muted) return;
  const f = {
    hit: 112,
    swing: 180,
    milk: 490,
    sell: 660,
    hurt: 102,
    step: 69,
    click: 320,
  }[kind];
  const dur = kind === "sell" ? 0.27 : 0.13;
  const o = ctx.createOscillator(),
    g = ctx.createGain(),
    now = ctx.currentTime;
  o.type = ["sell", "milk", "click"].includes(kind) ? "sine" : "triangle";
  o.frequency.setValueAtTime(f, now);
  o.frequency.exponentialRampToValueAtTime(
    kind === "sell" ? 990 : kind === "milk" ? 680 : f * 0.37,
    now + dur,
  );
  g.gain.setValueAtTime(kind === "step" ? 0.026 : 0.13, now);
  g.gain.exponentialRampToValueAtTime(0.001, now + dur);
  o.connect(g).connect(ctx.destination);
  o.start();
  o.stop(now + dur);
}
