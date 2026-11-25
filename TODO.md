# Offen

Sichtbare Platzhalter auf der Seite sind in Bernstein gestrichelt markiert.

## Inhalte, die fehlen

- [ ] Domain eintragen: `site` in `astro.config.mjs` (steht auf `https://example.invalid`).
      Davon hängen Canonical-Link, Open-Graph-URL und das OG-Bild ab.
- [ ] E-Mail-Adresse im Abschnitt Kontakt (`src/pages/index.astro`).
- [ ] Porträt für den Kopf: Platzhalter in `src/components/Hero.astro`, Format 4:5,
      als `<img>` mit `width`/`height` einsetzen, Datei nach `public/`.
- [ ] Bühnenfoto: noch nicht platziert. Vorschlag: neben „Auftritte“ in Belege.
- [ ] Link zum Video eines aktuellen Vortrags plus lokales Vorschaubild
      (`public/video-vorschau.svg` ersetzen, `href` am `.video-link` setzen).
- [ ] Jahr, in dem die Selbständigkeit mit 16 begann (`src/components/Timeline.astro`, erster Eintrag).
- [ ] Jahr des Handelsblatt KI Summit: 2020 oder 2021.
- [ ] Jahr von VDMA Startup the Future: 2021 oder 2022.
- [ ] „gegründet“ oder „mitgegründet“ (Zeitachse 2018, Fußzeile auf Englisch, JSON-LD `founder`).
- [ ] Texte für Impressum (`src/pages/impressum.astro`) und Datenschutz (`src/pages/datenschutz.astro`).

## Annahmen, die ich getroffen habe

- „gegründet“ steht vorerst überall, da die Rolle „Gründer von prenode“ heißt.
- „Über mich“ nutzt nur die Sätze, die nicht schon in der Zeitachse stehen
  (erster Satz, Demo-Nebensatz, Karlsruhe/Laufen/Karate). Der Mittelteil des
  gelieferten Textes doppelt den Werdegang und ist deshalb weggelassen.
- Die Wahl des Farbschemas liegt im `localStorage` des Browsers (kein Cookie,
  keine Übertragung). Im Datenschutz-Platzhalter steht ein Satz dazu.
- Auftritte sind nach Jahr sortiert, das Handelsblatt-Jahr steht als „2020/21“.
- Zeitachse: Studium als „2011–16“, Promotion als „2017–19“ abgekürzt; prenode 2018
  steht chronologisch zwischen Promotion und MIT.
- Schriften: Instrument Sans und JetBrains Mono (beide SIL OFL), nur die
  Latin-Teilmengen, gebündelt in `public/fonts/` samt Lizenzen.
- Das OG-Bild (`public/og.png`) ist aus `tools/og.html` gerendert
  (Chrome headless, 1200×630). Bei Textänderung neu erzeugen.

## Technisch

- [ ] `astro check` läuft in dieser Umgebung nicht durch (fragt nach einer
      Installation, obwohl `@astrojs/check` installiert ist). Die Skripte sind
      mit `tsc --strict` geprüft. Bei Gelegenheit prüfen.
- [ ] Nach dem Eintragen der Domain: Lighthouse erneut (lokal beide Läufe 100/100/100/100).
