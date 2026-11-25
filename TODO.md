# Offen

Sichtbare Platzhalter auf der Seite sind in Bernstein gestrichelt markiert.

## Inhalte, die fehlen

- [ ] Domain eintragen: `site` in `astro.config.mjs` (steht auf `https://example.invalid`).
      Davon hängen Canonical-Link, Open-Graph-URL und das OG-Bild ab.
- [ ] E-Mail-Adresse im Abschnitt Kontakt (`src/pages/index.astro`).
- [x] Porträt für den Kopf: `public/portrait-640.jpg` (aus Drive „Robin Hirt.jpeg“,
      Sales-Ablage, Oktober 2026, 800 px, 4:5 beschnitten). Falls ein größeres
      Original existiert, austauschen; 640 px reichen für 9 rem bei 2×.
- [x] Foto bei „Über mich“: `public/ueber-mich-900.jpg` (aus Drive „Robin_Portrait.jpg“,
      2021, Pullover vor Pflanze). Alternative im Drive: „robin_hirt.jpeg“ (2020, Backsteinwand).
- [ ] Bühnenfoto: im Drive nicht gefunden. Durchsucht: Marketing-Ablage (Hannover-Messe-
      Ordner 2020/2021/2024, „Vortrag Industrial Transformation Stage“, Handelsblatt
      KI Summit), Admin „20240425 Messe_“, Dateinamen mit Bühne/Vortrag/Keynote/Stage.
      Gefunden wurden nur Grafiken (Speaker-Teaser, Signaturen). Online gab es keine
      Fotos mit geklärten Rechten. Platzhalter steht weiter bei „Auftritte“.
- [ ] Link zum Video eines aktuellen Vortrags plus lokales Vorschaubild
      (`public/video-vorschau.svg` ersetzen, `href` am `.video-link` setzen).
- [ ] Jahr, in dem die Selbständigkeit mit 16 begann (`src/components/Timeline.astro`, erster Eintrag).
- [ ] Jahr des Handelsblatt KI Summit: steht jetzt als 2021, weil der Drive-Ordner
      „2021-09 Handelsblatt KI Summit“ heißt. Bitte bestätigen.
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
  (Chrome headless, 1200×630) und zeigt das lernende Modell mit Band. Bei Textänderung neu
  erzeugen: `python3 -m http.server 4333` im Projektordner, dann Chrome headless
  mit `--screenshot` auf `http://localhost:4333/tools/og.html`.
- Die Fotos stammen aus dem prenode-Drive. Nutzungsrechte (Fotograf) vor
  Veröffentlichung prüfen.

## Vor der Veröffentlichung

- [ ] Motiv wählen (siehe DESIGN.md, „Vergleich“), dann `src/pages/motive.astro`
      löschen, den `?motiv=`-Umschalter in `src/components/Hero.astro` entfernen
      und die beiden nicht gewählten Module aus `src/scripts/` nehmen.
- [ ] OG-Bild zum gewählten Motiv rendern (`tools/og.html` zeigt das lernende Modell).

## Technisch

- [ ] `astro check` läuft in dieser Umgebung nicht durch (fragt nach einer
      Installation, obwohl `@astrojs/check` installiert ist). Die Skripte sind
      mit `tsc --strict` geprüft. Bei Gelegenheit prüfen.
- [ ] Nach dem Eintragen der Domain: Lighthouse erneut (lokal beide Läufe 100/100/100/100).
