export const weapons = [
  { id: "fists", name: "Кулаки", range: 2.2, damage: 21, windup: 0.08, recovery: 0.26 },
  { id: "shovel", name: "Лопата", range: 3.3, damage: 40, windup: 0.22, recovery: 0.41 },
  { id: "pin", name: "Скалка", range: 2.4, damage: 30, windup: 0.13, recovery: 0.32 },
  { id: "fork", name: "Вилы", range: 3.9, damage: 46, windup: 0.31, recovery: 0.54 },
] as const;

export type WeaponId = (typeof weapons)[number]["id"];
