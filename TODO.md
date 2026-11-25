# Offen

Sichtbare Platzhalter auf der Seite sind in Bernstein gestrichelt markiert.

## Inhalte, die fehlen

- [ ] Domain eintragen: in den GitHub-Pages-Einstellungen (Custom domain) und als
      `site` in `astro.config.mjs`. Bis dahin liegt die Seite unter
      https://coomish.github.io/robinhirt-de/ und bekommt Adresse und Basis-Pfad
      automatisch vom Workflow.
- [ ] Unterseiten ohne Schrägstrich am Ende (`/impressum`) leiten auf GitHub Pages
      per 301 auf `/impressum/` um. Harmlos; falls störend, `trailingSlash: 'always'`
      setzen und die Links anpassen.
- [ ] Das alte Repository `coomish.github.io` (Seite von 2017) ist unberührt. Soll die
      neue Seite direkt unter coomish.github.io liegen, dort den Inhalt ersetzen oder
      gleich die eigene Domain nutzen.
- [ ] E-Mail-Adresse im Abschnitt Kontakt (`src/pages/index.astro`).
- [x] Kopf: `public/buehne-1536.jpg` (sitzend, Schwarzweiß) als Bühne.
- [x] „Über mich“: `public/ueber-1536.jpg` (Profil, Blick nach rechts) als Bühne.
- [x] OG-Bild aus demselben Foto wie der Kopf (`tools/og.html`, `public/og-foto.jpg`).
- [ ] Die Originale sind 1536 px breit; für sehr große Bildschirme ein Export
      mit 2400 px nachliefern (gleiche Bilder, nur größer).
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
- Die Fotos sind die drei gelieferten Bilder. Nutzungsrechte (Fotograf) vor
  Veröffentlichung prüfen. Die Originale liegen nicht im Repository, nur die
  beschnittenen Ableitungen in `public/`.

## Vor der Veröffentlichung

- [ ] `src/pages/motive.astro` (Vergleichsseite) löschen; der Wechsel per Zufall
      und „nächstes“ bleibt.
- [ ] OG-Bild zeigt das lernende Modell; bei Bedarf zu einem anderen Motiv rendern.
- [ ] Veröffentlichungen prüfen (`src/data/publikationen.ts`, aus Semantic Scholar,
      Google Scholar war nur teilweise lesbar, dblp blockierte). Vier Einträge
      ohne gesicherten Ort fehlen noch: „How to Learn from Others? A Research
      Agenda on Transfer Machine Learning for Sales Forecasting“ (2019),
      „Towards Service-oriented Cognitive Analytics for Smart Service Systems“
      (2018), „How to Cope With Incomplete Prediction Input?…“ (2017), und der
      Ort von „Cognition in the Era of Smart Service Systems“ (2018, hier als
      ICIS angenommen). Bitte ergänzen oder bestätigen.

## Technisch

- [ ] `astro check` läuft in dieser Umgebung nicht durch (fragt nach einer
      Installation, obwohl `@astrojs/check` installiert ist). Die Skripte sind
      mit `tsc --strict` geprüft. Bei Gelegenheit prüfen.
- [ ] Nach dem Eintragen der Domain: Lighthouse erneut (lokal beide Läufe 100/100/100/100).
