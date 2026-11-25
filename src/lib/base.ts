/** Pfad mit dem Basis-Pfad der Site (GitHub Pages liefert unter /robinhirt-de/) */
const base = import.meta.env.BASE_URL.replace(/\/$/, '');
export const href = (p: string) => base + p;
