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

Kontraste (berechnet): Graphit auf Papier 15,3:1, Blei auf Papier 5,7:1,
Bernstein auf Papier 5,4:1, Kreide auf Schiefer 14,5:1, Blei hell auf
Schiefer 7,0:1, Bernstein hell auf Schiefer 7,7:1.

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
  die letzten 120 Abtastwerte, Toleranzband = Mittel ± 3,5 σ. Ein Wert
  außerhalb wird im selben Moment markiert: die Spur wird dort Bernstein,
  am Beginn jeder Abweichung sitzt ein Punkt.
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

## Überarbeitungsrunde (nach Screenshots Desktop/Handy, hell/dunkel)

- **Herausgenommen: die Fallstriche.** Jede Abweichung hatte einen feinen
  Bernstein-Strich von der Spur bis zur Zeitachse. Bei mehreren Ereignissen
  wurde das ein Gitter. Jetzt bleibt nur der Punkt und die eingefärbte Spur.
- Toleranzband von 2,5 σ auf 3,5 σ: bei 2,5 σ schlug reines Rauschen etwa
  alle zwei Sekunden an, die Marken verloren ihre Bedeutung.
- Beginn eines Ereignisses erst nach 30 ruhigen Werten; Sprünge zählen so
  als ein Ereignis, nicht als zehn.
- Handy: das Porträt stand als großer Kasten über dem Namen. Jetzt sitzt es
  klein neben Name und Rolle, der Kernsatz läuft darunter über die volle Breite.
- Literaturangaben: lange DOI-Links brechen jetzt um statt über den Rand zu laufen.
- Nach einer Größenänderung füllt sich der Puffer sofort auf, damit die Spur
  die ganze Breite nutzt.

## Zweite Runde: das Signal als Mehrkanal-Schrieb

Rückmeldung: die Einzelspur war zu einfach. Jetzt drei Kanäle, wie an einer
Maschine überwacht: Vibration, Temperatur, Strom.

- **Gekoppelt.** Strom erwärmt mit 1,2 s Verzögerung und träge; Vibration
  schlägt fast sofort auf den Strom durch; eine Laständerung rüttelt leicht.
  Wer einen Kanal mit der Maus zieht, sieht die anderen nachziehen. Die
  Kopplung läuft über die gemessene Abweichung vom Mittel, nicht über den
  Generator; sie ist also selbst Teil dessen, was die Erkennung sieht.
- **Messcursor.** Unter dem Zeiger steht eine Hairline mit Zeitabstand und den
  drei Werten an dieser Stelle. Messen, nicht nur ansehen.
- **Bandbreite am Rand.** Rechts vom Schreibkopf steht die halbe Bandbreite
  (±σ·K) je Kanal in Mono, direkt an der Spur statt in einer Anzeige darunter.
- **Protokoll.** Jede Abweichung wird eingetragen (Zeit, Kanal, Art, Dauer,
  Stärke in σ). Die Art wird aus den Daten bestimmt: kürzer als 0,2 s ist
  eine Spitze, ein verschobener Mittelwert ein Sprung, sonst Streuung; was
  unter dem Zeiger entstand, heißt Eingriff.
- **Zeitachse** mit absoluter Laufzeit alle fünf Sekunden, der Moment beim
  Laden zeichnet die drei Kanäle um 180 ms versetzt.
- Fotos: das Porträt im Kopf (4:5, neutraler Hintergrund) und ein zweites bei
  „Über mich“ in der Achsenspalte, beide ohne Rahmen, ohne Rundung.
- Tastatur: Ziffern wählen den Kanal, Leertaste und Pfeile stoßen an; ein
  Sprunglink „Zum Inhalt“ steht vor dem Kopf.

## Dritte Runde: vom Sensor zum lernenden Modell

Rückmeldung: der Industrie-Fokus war zu eng. Das Motiv soll KI im Allgemeinen
zeigen: Muster, Mathematik, etwas Natur. Das Prinzip bleibt (etwas läuft live,
ein Modell schaut zu, Besucher greifen ein), der Gegenstand wechselt.

- **Was läuft.** Aus einer verborgenen, glatten Kurve fallen verrauschte
  Punkte, gelegentlich ein Ausreißer. Die Kurve wandert langsam, alte Punkte
  verblassen nach 26 s und verschwinden: das Modell muss weiterlernen.
  Eine Region mit wenig Daten wandert ebenfalls, dort wird das Band breit.
- **Das Modell.** Gauß-Prozess-Regression mit RBF-Kern (Längenskala 0,11 der
  Breite, Rauschen σ = 0,09), Cholesky-Zerlegung, bis zu 90 Punkte, unter
  2 ms je Fit. Das Band zeigt ±1 σ und ±2 σ der Vorhersage.
- **Erkennung.** Leave-one-out: für jeden Punkt die Vorhersage ohne ihn
  selbst, geschlossen aus K⁻¹. Liegt er mehr als 3 σ daneben, ist er ein
  Ausreißer, wird Bernstein und beim zweiten Fit ausgelassen. Die Kurve
  biegt sich also nicht zu ihm hin, zeigt ihn aber.
- **Eingreifen.** Klick oder Finger setzt Punkte (mit Ring), Ziehen mehrere;
  ein Messcursor zeigt Wert ± σ unter dem Zeiger. Leertaste setzt einen
  Messpunkt, Pfeile einen Ausreißer.
- **Der Moment beim Laden.** Die ersten Punkte kommen schnell, das Band
  zieht sich von breit nach schmal zusammen: Lernen in zwei Sekunden.
- Anzeige darunter: Punkte, Ausreißer, mittlere Unsicherheit, Rechenzeit.
  Das Protokoll ist entfallen, die Fläche ist wieder ruhiger.
- Datei: `src/scripts/model.ts`; die frühere Mehrkanal-Fassung liegt in der
  Git-Historie (Commit „Signal: drei gekoppelte Kanäle“).

## Vergleich: drei Motive zur Auswahl

Neben dem lernenden Modell sind die beiden anderen Konzepte gebaut, damit die
Wahl am echten Kopf fällt. Umschalten per Adresse, die Startseite bleibt sonst
unverändert:

- `/` – Lernendes Modell (`src/scripts/model.ts`)
- `/?motiv=vorhersage` – Vorhersage gegen Wirklichkeit (`src/scripts/forecast.ts`):
  Lorenz-System als Spur (zeitlich so gestreckt, dass eine Schwingung etwa
  drei Sekunden dauert), autoregressives Modell 16. Ordnung, laufend per
  kleinster Quadrate aus den letzten sechs Sekunden angepasst, Vorhersage
  0,5 s. Gestrichelt: was für diesen Moment vorhergesagt war. Bernstein: die
  Lücke, wo die Wirklichkeit mehr als 0,12 daneben liegt. Der Kegel vor dem
  Jetzt ist der gemessene mittlere Fehler je Horizontschritt (±2). Maus oder
  Finger ziehen den Zustand, Klick stößt an.
- `/?motiv=schwarm` – Ordnung im Schwarm (`src/scripts/swarm.ts`): 260
  Individuen nach drei Regeln, k-means für k = 1…5 mit Warmstart je Bild,
  k gewählt, solange eine weitere Gruppe die Trägheit noch um 38 % senkt,
  mit Hysterese gegen Flackern. Hülle je Gruppe (Andrew), Außenseiter ab 2,2
  Streuungen vom Gruppenmittel. Maus oder Finger verscheuchen.

Alle drei teilen `src/scripts/ui.ts` (Schleife mit Pause, Anzeige, Farben)
und dieselbe Sprache: Papier, Graphit, Band, Bernstein nur für das, was
nicht passt.

## Vierte Runde: alle drei bleiben, dichter, kürzer

Rückmeldung: alle drei Motive gefallen, sie sollen wechseln und visuell
packender werden, die Texte darunter kürzer.

- **Wechsel.** Jeder Besuch bekommt per Zufall eines der drei Motive. In der
  Achsenspalte steht „Motiv 2/3“ und ein Link „nächstes“, der das Motiv an
  Ort und Stelle austauscht (jedes Modul baut sich sauber ab: Schleife,
  Beobachter, Zeiger). `?motiv=` legt eines fest, der Link trägt die Adresse
  des nächsten als Fallback ohne JavaScript.
- **Modell.** Statt eines Bands ein Fächer aus 16 Kurven, die der
  Gauß-Prozess für möglich hält: Stichproben aus der Nachverteilung (Cholesky
  der 140×140-Kovarianz, feste Zufallszahlen, deshalb verformen sich die
  Kurven stetig statt zu springen).
- **Vorhersage.** Rechts zeichnet das System seinen Schmetterling (x–z-
  Projektion der letzten 2400 Zustände, hinten blass), der aktuelle Zustand
  läuft darauf mit und wird Bernstein, wenn die Vorhersage gerade verfehlt.
  Vor dem Jetzt ein Fächer aus fünf autoregressiven Modellen (Ordnung 8 bis
  32); das mittlere trägt den Kegel und den Schatten.
- **Schwarm.** Als Murmuration: bis zu 2400 Individuen (nach Fläche), je
  14 nächste Nachbarn wie bei Staren, Angst steckt an und läuft als Welle
  durch den Schwarm, ein leiser Wind und ein Zug zum Platz über der Mitte.
  Ein Jäger kreist von allein, sobald zwei Sekunden niemand die Maus bewegt.
  Nachleuchten durch halbtransparentes Übermalen statt Schweifen, Hüllen nur
  als gestrichelte Hairline. Unter 2 ms je Bild bei 1400 Individuen.
- **Texte.** Je Motiv ein Satz plus „Synthetisch, gerechnet lokal im Browser.“
- **Veröffentlichungen** haben eine eigene Unterseite, nach Jahr, mit den
  Jahren als Skala in der Achsenspalte; die Startseite behält drei.

## Fünfte Runde: kühler, voller, mit Fotos

Rückmeldung: Palette zu erdig, Animationen sollen die Fläche füllen, neue Fotos.

**Neue Farben.** Papier wird kühles Weiß, Graphit und Blei bekommen einen
Blaustich, die Signalfarbe wechselt von Bernstein zu Türkis. Die Rolle bleibt:
Türkis nur für das, was nicht passt (Ausreißer, verfehlte Vorhersage,
Außenseiter) und für Platzhalter.

| Name    | Hell      | Dunkel    | Kontrast hell / dunkel |
|---------|-----------|-----------|------------------------|
| Papier  | `#F4F6F7` | `#0F1316` | Fläche                 |
| Graphit | `#15191D` | `#E6EAEE` | 16,3 : 1 / 15,4 : 1    |
| Blei    | `#58646E` | `#98A4AE` | 5,6 : 1 / 7,3 : 1      |
| Raster  | `#D3DAE0` | `#262D33` | Hairlines              |
| Türkis  | `#087A80` | `#35D0C4` | 4,7 : 1 / 9,8 : 1      |

Im Code heißt der Token `--signal`, damit ein Farbwechsel nicht wieder
Namen ändert. Alle drei Motive, Favicon und OG-Bild folgen den Tokens.

**Volle Fläche.** Der Kopf ist höher (54 vh). Das Modell nutzt die ganze
Höhe (größere Amplitude der verborgenen Kurve, 24 Kurven im Fächer), die
Vorhersage die ganze Höhe und rechts ein Drittel für den Schmetterling, der
Schwarm hat jetzt einen Platz, der langsam über die ganze Fläche wandert,
und mehr Individuen je Fläche.

**Fotos.** Porträt im Kopf (neu, 4:5, heller Hintergrund), ein breites Bild
unter „Über mich“ über beide Spalten, ein quadratischer Ausschnitt des
sitzenden Bilds bei „Kontakt“. Das OG-Bild nutzt das breite Foto, der Text
steht im freien Raum rechts.

## Sechste Runde: Fotos als Bühne

Rückmeldung: Fotos als kleine Kacheln wirkten beiläufig, der Fächer im Modell
war zu unruhig, der Schwarm soll größere Elemente haben.

- **Kopf als Bühne.** Das sitzende Foto (Freiraum links) läuft in
  Schwarzweiß über die volle Breite, 80 vh hoch. Name, Rolle und Kernsatz
  stehen im Freiraum unten links; das Bild ist 112 % breit, damit die Person
  rechts vom Text bleibt. Darunter das Motiv, 50 vh. Im Dunkelmodus wird das
  Foto per Filter abgedunkelt, der Text bleibt derselbe Token.
- **„Über mich“ als Bühne.** Das Profilfoto mit Blick nach rechts, der Text
  steht im Freiraum rechts, vertikal mittig. Unter 760 px stapeln beide
  Bühnen: Foto oben, Text darunter auf Papier.
- **Nur zwei Fotos.** Die drei früheren Bilder sind entfernt; Porträt in der
  Achsenspalte und Kontaktfoto entfallen. Schwarzweiß, weil Graphit auf Grau
  mit der Palette eins wird und das Türkis der Motive darunter frei bleibt.
- **Modell** zurück zum Band (±1 σ, ±2 σ) mit nur sechs sehr leisen
  möglichen Kurven. **Schwarm** mit weniger, größeren Tieren (Striche, 2,4 px,
  Länge nach Tempo) und gefüllten, weit gepolsterten Hüllen.
- OG-Bild: dasselbe Schwarzweißfoto, Text links im Freiraum.

## Siebte Runde: Zeichenfeld

Ein Motiv statt drei, ein Bild statt zwei Bänder. Der Kopf ist ein voller
Bildschirm: Grund, darüber ein Zeichenfeld über die ganze Fläche, davor ich
freigestellt, davor Name und Kernsatz.

**Was an der Referenz wirkt.** Tausende kleine, scharfe Zeichen stehen auf
einem strengen Raster, und erst das organische Muster darüber, dichte Inseln
aus kräftigen Zeichen zwischen feinen grauen Punkten, macht aus dem Raster ein
Bild. Eine einzige kräftige Farbe trägt fast alles, die wenigen Zeichen in
anderen Farben wirken dadurch wie Funde. Das Feld ist groß und angeschnitten,
es ragt über den Rand und läuft nach unten aus, statt in einem Kasten zu sitzen.

**Was wir übernehmen, was nicht.** Übernommen: Raster, Inseln, eine Farbe,
Anschnitt, Auslaufen nach unten. Nicht übernommen: der Kreis (unser Feld ist
eine Fläche, die links dünn und rechts dicht ist), die Zeichenfamilie (dort
Kreise, Quadrate, Kreuze; bei uns Striche, deren Neigung den vorhergesagten
Wert zeigt, und Punkte), und das Blau (Farbwahl zwischen Petrol und einem
eigenen Blau, Standbilder folgen).

```
┌──────────────────────────────────────────────────────────────┐ 100 svh
│ Robin Hirt                                              Hell │
│ · · · · · · · · · · · · · · · · ╱╱╱╲╲ · · · · ╱╱╱╱ · · ·     │
│ · · · · · · · · · · · · · · ╱╱╱╱╱╲╲╲╲╲ · · ╱╱╱╱╱╱╱ · · ·     │
│ · · · · · · · · · · · · · ╱╱╱╱  ┌──────┐ ╲╲╲ ╱╱╱╱╱╱╱╱ · ·    │
│ · · · · · · · · · · · · · ╲╲╲╲  │      │ ╲╲╲╲╲╲╲ ╱╱╱╱ · ·    │
│                     · · · · ╲╲  │  ich │ ╲╲╲╲╲ × ╲╲╲╲╲ · ·   │  × = Ausreißer
│ Dr.-Ing. Robin Hirt         · · │      │ · ╲╲╲╲╲╲╲╲╲╲ · ·    │      in Akzent
│ Unternehmer. Seit über      · · │      │ · · ╲╲╲╲╲╲╲╲ · ·    │
│ zehn Jahren arbeite ich     · · │      │ · · · ╲╲╲╲ · · ·    │
│ an künstlicher Intelligenz, · · │      │ · · · · · · · ·     │
│ die im Betrieb              · ·                              │
│ funktionieren muss.          ·   ·    ·     ·    ·   ·       │  Feld läuft aus
├──────────────────────────────────────────────────────────────┤
│ Ein Modell für den Betrieb muss wissen, wo es sich nicht     │
│ sicher ist. Hier füllt sich das Feld, wo es Daten hat.       │
│ Tipp auf die Fläche und gib ihm welche.      ▸ Wie das funkt.│
└──────────────────────────────────────────────────────────────┘
```

**Das Feld.** Ein zweidimensionaler Gauß-Prozess (RBF-Kern) über der Fläche,
aufgebaut auf `model.ts`. Messpunkte kommen alle paar hundert Millisekunden
an, öfter rechts und in der Mitte als links, und verblassen nach etwa 30 s.
Jede Rasterzelle (14 px, auf schwachen Geräten 18 px) ist ein Zeichen: Wo
die Streuung der Vorhersage klein ist, steht ein kräftiger Strich in der
Feldfarbe, seine Neigung zeigt den vorhergesagten Wert (−1 … 1 → −70° … 70°),
seine Stärke die Sicherheit. Wo das Modell nichts weiß, steht ein feiner
grauer Punkt. Ausreißer (Leave-one-out, > 3 σ) sind kleine Kreuze in der
Akzentfarbe, die einzigen Zeichen in einer zweiten Farbe. Links, hinter dem
Text, dämpft eine Maske das Feld; nach unten läuft es aus. Ein Klick setzt
einen Messpunkt, und das Feld füllt sich um ihn herum. Canvas 2D, ein Pfad
je Zeichenklasse, Werte zwischen zwei Fits weich überblendet.

**Prüfung gegen die sechs Punkte.** (1) Ein Motiv, und der Satz darunter
erklärt es ohne Fachwort; die Fachdetails stehen im Aufklapper. (2) Ein Bild
mit Ebenen statt zwei Bändern; das Feld liegt hinter dem Foto, der Text davor.
(3) Fläche statt Linie: tausende Zeichen, Inseln, Auslaufen. (4) Unter dem
Kopf ein asymmetrisches Raster über die volle Breite, Werdegang als drei
Kapitel mit prenode als größtem. (5) Neue Schrift mit Charakter, Vergleich
dreier Kandidaten folgt; Monospace nur im Aufklapper. (6) Kernsatz nur im
Kopf, „Über mich“ entfällt, Auftritte mit Thema, ein neuer Abschnitt
„Wovon ich überzeugt bin“ als zweiter Höhepunkt.

**Gebaut (Stand nach der Farbwahl).** Feldfarbe Petrol `#0F6F7A` (dunkel
`#3FB6C0`), Akzent für Ausreißer und Platzhalter `#BB3813` (dunkel `#FF8F62`).
Schrift: Bricolage Grotesque (OFL) für Kernsatz, Kapitel und Überzeugungen,
Instrument Sans für Fließtext mit 19 px auf dem Desktop, JetBrains Mono nur im
Aufklapper. Verglichen wurden Bricolage Grotesque, Fraunces und Syne;
Bricolage hat in großen Graden den meisten Charakter (eigenwillige
Innenformen, enge, sichere Buchstaben) und bleibt ein Grotesk, Fraunces zieht
Richtung „Serife auf Papier“, Syne ist breit und modisch und liest sich in
langen Zeilen schlechter. Unter dem Kopf ein Zwölferraster: Abschnittsname in
den ersten zwei Spalten, Bauen und Forschen nebeneinander, Gründen darunter
groß, die drei Überzeugungen versetzt, Auftritte mit Jahr, Ort und Thema,
Belege in drei Spalten, zum Schluss das kleine Foto mit einem Satz und dem
Kontakt. Kurve, Vorhersage und Schwarm sind aus dem Code entfernt (Git-Historie).

**Überarbeitungsrunde.** Nach Vorlage sah noch das Kästchen „Vorschaubild
folgt“ bei den Auftritten aus, eine graue Karte mit Platzhaltergrafik. Es ist
entfernt; der Hinweis auf das Video steht als eine Zeile unter der Liste.

**Ohne Freisteller.** Bis der Freisteller da ist, liegt das Schwarzweißfoto
als rechteckige Platte rechts unten im Kopf, 4:5 beschnitten, am rechten und
unteren Rand angeschnitten; das Feld läuft bis an die Kanten. Auf dem Handy
steht die Platte oben, der Text darunter, das Feld bleibt dort unten dünn.
