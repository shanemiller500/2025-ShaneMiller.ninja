/** Union-find over a list: items joined when `near(a, b)`. Returns groups of indices. */
export function clusters<T>(items: T[], near: (a: T, b: T) => boolean): number[][] {
  const parent = items.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i])));
  for (let i = 0; i < items.length; i++) for (let j = i + 1; j < items.length; j++) if (near(items[i], items[j])) parent[find(i)] = find(j);
  const groups = new Map<number, number[]>();
  items.forEach((_, i) => {
    const r = find(i);
    const g = groups.get(r);
    if (g) g.push(i);
    else groups.set(r, [i]);
  });
  return Array.from(groups.values());
}
