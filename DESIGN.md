# Designplan – robinhirt.de

Stand: 25.11.2026, erster Entwurf.

## Ausgangslage

Das Repository war leer. Gewählt: Astro 5 mit statischem Output und
TypeScript, keine UI-Bibliothek, kein CSS-Framework. Das Signal im Hero ist
ein eigenes Canvas-2D-Modul in TypeScript, ohne Abhängigkeiten.

prenode.de arbeitet mit Blau (#2048c4, #4d65ff) auf Weiß und einer
Webflow-Vorlage. Diese Seite nutzt deshalb kein Blau, kein Logo und keine
Karten.

## Leitbild: der Messschrieb

Ein Schreiber zieht eine Spur über Papier. Die Spur hat Rauschen und Drift,
und hin und wieder schlägt sie aus. Daneben steht, was gemessen wurde und
wann. Alles auf der Seite folgt diesem Bild:

- Die **Spur** ist das eine laute Element (Hero, live).
- Die **Achse** ist die Struktur: eine schmale linke Spalte trägt die
  Abschnittsnamen und die Jahre wie Skalenwerte. Im Werdegang wird sie zur
  gezeichneten Linie.
- **Werte** (Jahre, Messwerte, Fußnoten) stehen in Monospace, wie auf einem
  Schrieb beschriftet.

## Farben

Hell (Papier):

| Name       | Wert      | Rolle                                         |
|------------|-----------|-----------------------------------------------|
| Papier     | `#F1F2EF` | Fläche. Neutral-kühles Weiß, keine Creme.      |
| Graphit    | `#1A1C1A` | Text, Spur, Überschriften, Linkunterstrich.   |
| Blei       | `#5B615B` | Nebentext, Jahre, Beschriftungen (Mono).      |
| Raster     | `#D3D6D0` | Hilfslinien, Trennlinien, Rand des Toleranzbands. |
| Bernstein  | `#A3470A` | Nur für Abweichungen: Marken im Signal, der Punkt „jetzt“ auf der Achse. Keine Links, keine Buttons. |

Dunkel (Schiefer):

| Name           | Wert      | Rolle                       |
|----------------|-----------|-----------------------------|
| Schiefer       | `#141615` | Fläche, dunkles Graugrün, kein Schwarz. |
| Kreide         | `#E4E6E1` | Text, Spur.                 |
| Blei hell      | `#9BA39B` | Nebentext.                  |
| Raster dunkel  | `#2A2E2A` | Hilfslinien.                |
| Bernstein hell | `#E09A3A` | Abweichungen.               |

Bernstein ist die Farbe einer Warnleuchte an der Maschine: sie taucht nur
auf, wenn etwas vom Erwarteten abweicht. Dadurch bleibt die Seite
zweifarbig, bis das Signal ausschlägt.

Kontraste (geprüft im Build): Graphit auf Papier 16:1, Blei auf Papier
5,5:1, Bernstein auf Papier 5,2:1, Kreide auf Schiefer 15:1, Blei hell auf
Schiefer 6,6:1, Bernstein hell auf Schiefer 7,5:1.

## Schriften

Beide mit SIL Open Font License, lokal gebündelt (über fontsource, kein CDN).

- **Instrument Sans** (variabel, 400–700): Fließtext, Überschriften, Name.
  Ein nüchterner Grotesk mit leicht schmaler Laufweite; trägt lange Zeilen
  und große Grade ohne Pathos.
- **JetBrains Mono** (variabel, 400–500): alles, was „gemessen“ ist: Jahre
  auf der Achse, die Anzeige unter dem Signal, Fußnoten, Meta-Angaben.

Größenskala (Basis 17 px, Faktor 1,25):
`0.8rem · 0.9rem · 1rem · 1.25rem · 1.6rem · 2rem · 2.5rem · 3.2rem`.
Hero-Satz 2.5–3.2 rem flüssig, Zeilenlänge überall ≤ 72 Zeichen.

## Layout

Desktop (ab 900 px): zweispaltig. Links die Achse (11 rem), rechts der
Inhalt (max. 42 rem Zeilenbreite). Die Achse scrollt mit und trägt
Abschnittsnamen auf Höhe des Abschnitts, im Werdegang die Jahre.

```
┌──────────────────────────────────────────────────────────────┐
│ Robin Hirt                                     Hell/Dunkel ⌁ │
│                                                              │
│ Dr.-Ing. Robin Hirt                      ┌──────────┐        │
│ Unternehmer. Seit über zehn Jahren       │ Porträt  │        │
│ arbeite ich an künstlicher Intelligenz,  │ (folgt)  │        │
│ die im Betrieb funktionieren muss.       └──────────┘        │
│                                                              │
│ ─────────────────────── Toleranzband ──────────────────────  │
│ ~~~~~~~^~~~~~~~~~~~~~~~~~~~~~~~~~~~~^~~~~~~~~~~~~~~~~~~~~~~  │  ← Spur, live
│ ───────│───────────────────────────│────────────────────────  │     ^ = Abweichung
│ Wert 0.42  Mittel 0.40  ±0.11  Abweichungen 3   synthetisch  │
│                                                              │
├───────────┬──────────────────────────────────────────────────┤
│ Werdegang │                                                  │
│      ·    │ Mit 16 selbständig als Softwareentwickler        │
│   2011 ●  │ Studium am KIT, Auslandssemester Istanbul        │
│      │    │                                                  │
│   2015 ●  │ Erstes KI-Projekt bei SAP                        │
│      │    │                                                  │
│   2017 ●  │ Promotion, angewandte KI                         │
│   2018 ●  │ prenode gegründet                                │
│   2019 ●  │ MIT-IBM Watson AI Lab                            │
│           │                                                  │
│ Aktuell   │ prenode bringt KI und IoT in Maschinen …         │
│           │                                                  │
│ Belege    │ Auftritte · Veröffentlichungen · Auszeichnungen  │
│           │                                                  │
│ Über mich │ Ich bin Unternehmer …                            │
│           │                                                  │
│ Kontakt   │ E-Mail · LinkedIn                                │
├───────────┴──────────────────────────────────────────────────┤
│ Dr.-Ing. Robin Hirt is an entrepreneur …   Impressum · Datenschutz │
└──────────────────────────────────────────────────────────────┘
```

Mobil (unter 900 px): eine Spalte. Die Achse wird zur linken Randlinie mit
den Jahren darüber, die Abschnittsnamen stehen als kleine Mono-Zeile über
dem Inhalt. Das Signal läuft voll-breit, Höhe 40 vh, Berührung stört es.

## Das Signal

- Synthetisch: langsame Sinusdrift + Random Walk + Gauß-Rauschen,
  gelegentlich Sprung oder Spitze. Feste Abtastrate (50 Hz), unabhängig von
  der Bildrate.
- Erkennung: gleitender Mittelwert und gleitende Standardabweichung über
  die letzten 120 Abtastwerte, Toleranzband = Mittel ± 2,5 σ. Ein Wert
  außerhalb wird im selben Moment markiert (Bernstein-Strich und Punkt).
- Störung: Maus oder Finger ziehen die Spur in ihre Richtung; die Erkennung
  reagiert sichtbar, das Band weitet sich danach.
- Ehrlicher Satz unter der Spur: „Synthetisches Signal. Die Erkennung läuft
  lokal in deinem Browser.“ Dazu eine Anzeige der laufenden Werte in Mono.
- Reduzierte Bewegung: ein einmal berechnetes Standbild. Außerhalb des
  Sichtfelds pausiert die Schleife.

## Bewegung

Ein Moment beim Laden: die Spur beginnt leer und läuft von rechts ins Bild,
der Hero-Text steht sofort. Danach nur Antworten: die Achsenlinie im
Werdegang wird beim Scrollen gezeichnet, Links zeigen Fokus durch einen
2 px Graphit-Rahmen, sonst nichts. Keine Einblendungen pro Abschnitt.

## Drei Prinzipien

1. **Eine Spur, sonst Ruhe.** Genau ein Element darf laut sein. Alles andere
   ist Text auf Papier mit Hairlines.
2. **Werte sind Messwerte.** Jahre, Zahlen und Beschriftungen stehen in
   Monospace an der Achse, nicht als Dekoration im Text.
3. **Bewegung nur als Antwort.** Was sich bewegt, bewegt sich, weil jemand
   scrollt, zeigt oder tippt. Ausnahme: der eine Moment beim Laden.

## Prüfung: Wäre dieser Plan für jede andere Seite genauso entstanden?

Erste Fassung hatte: Hero mit Text links und Bild rechts, darunter
Abschnitte mit Überschriften, Jahre fett vor jedem Eintrag, ein Akzent für
Links und Buttons, Verlauf hinter dem Signal. Das ist die Vorlage jeder
Portfolio-Seite. Geändert:

- **Achse statt Überschriften.** Abschnittsnamen und Jahre wandern in die
  linke Spalte und werden zu Skalenbeschriftung. Das gibt es nur, weil die
  Seite ein Schrieb ist.
- **Der Akzent gehört der Abweichung.** Bernstein taucht nur im Signal und am
  Punkt „jetzt“ auf. Links sind Graphit mit Unterstrich. Eine Akzentfarbe
  für alles Klickbare wäre austauschbar.
- **Kein Verlauf, kein Schatten, keine Karte.** Belege stehen als Listen mit
  Hairlines, Veröffentlichungen wie Literaturangaben.
- **Das Porträt ist Teil der Spur-Zeile**, nicht die rechte Hero-Hälfte: es
  sitzt klein neben dem Namen, das Signal bekommt die volle Breite.
- **Die Timeline ist die Spur.** Die Linie im Werdegang nutzt dieselbe
  Strichstärke und Farbe wie das Signal und wird beim Scrollen gezogen.
