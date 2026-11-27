export interface Option {
  label: string;
  run: () => void;
  disabled?: boolean;
}
export class DialogueManager {
  panel = document.createElement("section");
  options: Option[] = [];
  page = 0;
  constructor(private freeze: (on: boolean) => void) {
    this.panel.id = "story-panel";
    this.panel.hidden = true;
    this.panel.setAttribute("role", "dialog");
    document.getElementById("hud")!.append(this.panel);
  }
  get open() {
    return !this.panel.hidden;
  }
  show(title: string, body: string, options: Option[], page = 0) {
    this.freeze(true);
    this.page = page;
    this.panel.hidden = false;
    this.panel.replaceChildren();
    const h = document.createElement("h2");
    h.textContent = title;
    const p = document.createElement("p");
    p.textContent = body;
    this.panel.append(h, p);
    this.options = options.slice(page * 6, page * 6 + 6);
    if (options.length > 6)
      this.options.push({
        label: "Другая страница",
        run: () =>
          this.show(
            title,
            body,
            options,
            (page + 1) % Math.ceil(options.length / 6),
          ),
      });
    this.options.forEach((o, i) => {
      const btn = document.createElement("button");
      btn.disabled = !!o.disabled;
      btn.textContent = i + 1 + ". " + o.label;
      btn.onclick = () => this.choose(i);
      this.panel.append(btn);
    });
  }
  choose(i: number) {
    const o = this.options[i];
    if (o && !o.disabled) o.run();
  }
  close() {
    this.panel.hidden = true;
    this.options = [];
    this.freeze(false);
  }
}
