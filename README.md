# robinhirt.de

Persönliche Website, eine statische Seite. Astro 5, TypeScript, keine Laufzeit-Abhängigkeiten im Browser.

```bash
npm install
npm run dev        # http://localhost:4321
npm run build      # schreibt nach dist/
npm run preview    # dient dist/ lokal
```

- `DESIGN.md` – Gestaltungsplan und Begründungen
- `TODO.md` – offene Inhalte und getroffene Annahmen
- `src/scripts/model.ts` – das lernende Modell im Kopf (Gauß-Prozess, Ausreißer, Zeichnen)
- `src/scripts/timeline.ts` – die beim Scrollen gezogene Achse im Werdegang
- `tools/og.html` – Vorlage für das Open-Graph-Bild
