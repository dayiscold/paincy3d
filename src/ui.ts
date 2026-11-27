const paths: Record<string, string> = {
  forest:
    '<path d="m7 3-6 9h3l-4 6h12l-4-6h4zM16 1l-5 8h3l-4 6h3l-4 5h14l-4-6h3l-4-6h3z" fill="currentColor" stroke="none"/>',
  volume: '<path d="M3 9h4l5-4v14l-5-4H3zM16 8q4 4 0 8m3-11q7 7 0 14"/>',
  muted: '<path d="M3 9h4l5-4v14l-5-4H3zM16 9l6 6m0-6-6 6"/>',
  arrow: '<path d="M4 12h15m-6-6 6 6-6 6"/>',
  key: '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M5 9h2m2 0h2m2 0h2m2 0h2M6 12h2m2 0h2m2 0h2m-8 3h8"/>',
  pin: '<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0z"/><circle cx="12" cy="10" r="2"/>',
  play: '<path d="m6 3 14 9-14 9z" fill="currentColor" stroke="none"/>',
  close: '<path d="m5 5 14 14M19 5 5 19"/>',
};
const icon = (name: string) =>
  '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7">' +
  paths[name] +
  "</svg>";
export const el = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
export function buildUI() {
  el("ui").innerHTML = `<div id="cover">
 <header><div class="brand"><i>${icon("forest")}</i> ПАИНЦЫ <b>/</b> 3D</div><button id="audio" title="Переключить звук"></button></header>
 <main><div class="genre"><span></span> МОЛОЧНЫЕ ВОЙНЫ · ЛЕТО 2026</div><h1 aria-label="Паинцы 3D"><canvas id="title"></canvas></h1>
 <p id="intro">Автобус до Паинцев. В кармане — билет и адрес молочной фермы.</p>
 <button class="start" id="start" disabled>${icon("play")}<strong id="startText">Загрузка деревни…</strong>${icon("arrow")}</button>
 <button class="help" id="new-shift" hidden>Новая смена</button>
 <button class="help" id="help">${icon("key")} Управление</button></main>
 <footer><div>${icon("pin")} <span>ПАИНЦЫ <b>/</b> ПЕРМСКИЙ КРАЙ</span></div><span class="version">ЛЫСЬВЕНСКИЙ ОКРУГ</span></footer></div>
 <div id="hud" hidden><div class="stats"><span>ЗДОРОВЬЕ <strong id="hp"></strong></span><span>МОЛОКО <strong id="milk"></strong></span><span>СЛИВКИ <strong id="cream"></strong></span><span>ДЕНЬГИ <strong id="money"></strong></span></div><div id="quest"></div><div id="cross"></div><div id="tip"></div><div id="notice"></div><div id="arms"></div><div id="wound"></div></div>
 <dialog id="manual"><div class="dialoghead"><h2>Управление</h2><button id="close" aria-label="Закрыть">${icon("close")}</button></div>
 <p>Паинцы, Пермский край. Герои и криминальные события вымышлены.</p>
 <dl>${[
   ["W A S D", "Движение"],
   ["Мышь", "Осмотреться"],
   ["Shift / Пробел", "Бег / прыжок"],
   ["ЛКМ", "Удар"],
   ["1 / 2 / 3 / 4", "Кулаки / лопата / скалка / вилы"],
   ["E", "Подоить / продать продукцию"],
   ["F", "Дать корм / работа с сепаратором"],
   ["J / Q", "Журнал / сюжетное действие"],
   ["Цифры", "Выбор ответа в разговоре"],
   ["Esc", "Пауза"],
 ]
   .map(([a, b]) => "<div><dt>" + a + "</dt><dd>" + b + "</dd></div>")
   .join("")}</dl></dialog>`;
  const modal = el<HTMLDialogElement>("manual");
  el("help").onclick = () => modal.showModal();
  el("close").onclick = () => modal.close();
  drawTitle();
  soundLabel(false);
}
export function soundLabel(off: boolean) {
  el("audio").innerHTML =
    icon(off ? "muted" : "volume") +
    "<span>ЗВУК " +
    (off ? "ВЫКЛ" : "ВКЛ") +
    "</span>";
  el("audio").setAttribute("aria-pressed", String(!off));
}
function drawTitle() {
  const glyphs = [
    "11111/11011/11011/11011/11011/11011/11011",
    "01110/11011/11011/11111/11011/11011/11011",
    "11011/11011/11011/11111/11111/11011/11011",
    "11011/11011/11011/11111/11011/11011/11011",
    "110110/110110/110110/110110/110110/111111/000011",
    "1100011/1100011/1111011/1101111/1101111/1101111/1111011",
  ];
  // Hand-cut Cyrillic display letters on a coarse pixel grid.
  glyphs[2] = "110011/110011/110111/111111/111011/110011/110011";
  const all = [
    ...glyphs,
    "11110/00011/00011/01110/00011/00011/11110",
    "11110/11011/11011/11011/11011/11011/11110",
  ];
  const c = el<HTMLCanvasElement>("title");
  c.width = 640;
  c.height = 111;
  const ctx = c.getContext("2d")!;
  let x = 1;
  for (const [i, g] of all.entries()) {
    if (i === 6) x += 10;
    const rows = g.split("/");
    for (const [off, col] of [
      [6, "#302e29"],
      [0, i < 6 ? "#f7f1d9" : "#ff985c"],
    ] as const) {
      ctx.fillStyle = col;
      rows.forEach((row, y) =>
        Array.from(row).forEach((px, k) => {
          if (px === "1") ctx.fillRect(x + k * 12, 3 + y * 13 + off, 12, 13);
        }),
      );
    }
    x += (rows[0].length + 1) * 12;
  }
}
export function menu(mode: "game" | "pause" | "death" | "ready") {
  el("cover").hidden = mode === "game";
  el("hud").hidden = mode !== "game";
  el<HTMLButtonElement>("start").disabled = false;
  el("startText").textContent =
    mode === "death"
      ? "С контрольной точки"
      : mode === "pause"
        ? "Продолжить игру"
        : "Начать игру";
  el("intro").textContent =
    mode === "death"
      ? "Смена окончена. Попробуй ещё раз."
      : mode === "pause"
        ? "Игра на паузе. Деревня подождёт."
        : "Автобус до Паинцев. В кармане — билет и адрес молочной фермы.";
}
export function hud(
  hp: number,
  milk: number,
  cream: number,
  money: number,
  weapon: string,
  quest: string,
  prompt: string,
) {
  for (const [id, value] of Object.entries({
    hp: hp + " / 100",
    milk: milk + " л",
    cream: cream + " шт.",
    money: money + " ₽",
    arms: weapon,
    quest,
    tip: prompt,
  })) {
    const node = el(id);
    if (node.textContent !== value) node.textContent = value;
  }
}
