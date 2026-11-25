# robinhirt.de

Persönliche Website, eine statische Seite. Astro 5, TypeScript, keine Laufzeit-Abhängigkeiten im Browser.

Live: https://coomish.github.io/robinhirt-de/ (GitHub Pages). Jeder Push auf `main`
baut und veröffentlicht über `.github/workflows/pages.yml`; `SITE` und `BASE`
kommen dabei aus GitHub Pages. Mit eigener Domain später `site` in
`astro.config.mjs` setzen und in den Pages-Einstellungen die Domain eintragen.

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # schreibt nach dist/
npm run preview    # dient dist/ lokal
```

- `DESIGN.md` – Gestaltungsplan und Begründungen
- `TODO.md` – offene Inhalte und getroffene Annahmen
- `src/scripts/model.ts` – das lernende Modell im Kopf (Gauß-Prozess, Ausreißer, Zeichnen)
- `src/scripts/forecast.ts`, `src/scripts/swarm.ts` – die beiden anderen Motive; der Kopf wählt je Besuch zufällig, `?motiv=modell|vorhersage|schwarm` legt fest, Vergleich unter `/motive`
- `src/data/publikationen.ts` – Daten der Unterseite `/veroeffentlichungen`
- `src/scripts/ui.ts` – Gemeinsames: Schleife, Anzeige, Farben
- `src/scripts/timeline.ts` – die beim Scrollen gezogene Achse im Werdegang
- `tools/og.html` – Vorlage für das Open-Graph-Bild
