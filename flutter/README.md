# Scheda Personaggio D&D 5E — app Flutter

Riscrittura in Flutter dell'app web che sta nella cartella principale del repository: stessa scheda, stessi
calcoli, stesso formato di salvataggio (i JSON esportati da una versione si importano nell'altra), per
**Android, iOS, web e desktop** (Windows, macOS, Linux) con un solo codice.

L'app web (HTML/CSS/JS) resta al suo posto e continua a funzionare: questa è una cartella a parte, `flutter/`.

## Cosa c'è

- Scheda completa: informazioni e classe (scelte di classe, razze e background, manuali), combattimento e PF
  (riposi, tiri contro morte, salita di livello), caratteristiche, tiri salvezza e abilità, equipaggiamento (armatura,
  oggetti CA, armi, monete), incantesimi e trucchetti, privilegi e risorse a usi limitati, lingue.
- **Pensata per il tablet** (anche con S Pen): sezioni raggiungibili con un tocco — Gioco (combattimento e PF, caratteristiche,
  tiri salvezza, abilità), Incantesimi (solo per gli incantatori), Privilegi e risorse, Equipaggiamento, Note, Informazioni.
  Da 840 px di larghezza la navigazione è una barra laterale (con le etichette estese da 1200 px), sotto è una barra in basso;
  si ricorda l'ultima sezione aperta. In Gioco le colonne diventano due quando c'è spazio e il riepilogo (CA, PF, iniziativa…)
  resta sempre in alto. Bersagli di tocco di almeno 48 px, testo ingrandibile senza overflow, tastiera virtuale che non copre
  il campo in uso (la barra in basso si nasconde mentre si scrive).
- **Note**: più note con titolo (anche da modelli rapidi: sessione, PNG, luogo, da fare), crea/rinomina/elimina (con «Annulla»),
  riordina (maniglia di trascinamento o menu «Sposta su/giù»), ricerca nel testo senza badare a maiuscole e accenti, salvataggio
  automatico. «Talenti & altri tratti» e «Storia & personalità» sono le note predefinite in cima all'elenco (restano anche nel
  pannello Privilegi). Su schermo largo elenco ed editor stanno affiancati; su schermo stretto l'editor sostituisce l'elenco.
- Elenco di trucchetti e incantesimi con popup di ricerca e filtri.
- Descrizioni di abilità, trucchetti e incantesimi nella lingua dell'interfaccia (testo SRD 5.1, CC BY 4.0, con traduzione
  italiana non ufficiale e brevi riassunti per ciò che è fuori dall'SRD): pulsante **i** accanto a ogni voce.
- Italiano e inglese, tema chiaro «Pergamena» e scuro «Notte arcana», salvataggio locale automatico.
- Collaborazione online (Supabase): il giocatore entra con il token della scheda, il Master con l'email; pannello della
  campagna, sincronizzazione per campo. Su web il link dell'email riporta nell'app; sulle app native si incolla
  l'indirizzo completo del link (le app native non intercettano ancora i link del sito).

## Come è fatta

```
lib/
  i18n.dart           lingua, pick()/loc()/tr()
  data/catalog.dart   cataloghi (letti da assets/data/*.json)
  model/              logica pura: schema, calcoli, scelte di classe, razze, risorse, incantesimi, deriveStats
  auth/ net/ sync/    account, token, client RPC, sincronizzazione (stessa logica della versione web)
  ui/                 pannelli (panels_*.dart), navigazione e sezioni (sheet_page.dart), note (panels_notes.dart),
                      popup incantesimi, descrizioni, sessione
  app_controller.dart salvataggio, lingua, tema, scheda condivisa
  session_controller.dart  accesso e pannello del Master
assets/data/          dati esportati da js/data (non modificare a mano)
```

I dati di gioco **non** sono duplicati a mano: `npm run flutter:data` (nella cartella principale) li esporta da `js/data`
in `assets/data/`. Per correggere un testo si modifica la versione web (o i `docs/*.md` delle descrizioni) e si riesporta.

## Provarla

Serve [Flutter](https://docs.flutter.dev/get-started/install) (testata con 3.50).

```bash
cd flutter
flutter pub get
flutter run -d chrome        # web
flutter run -d linux         # desktop (o windows / macos)
flutter run                  # un telefono collegato o un emulatore
```

Build di rilascio:

```bash
flutter build web --release --base-href /D-D5e-sheet/
flutter build apk --release        # Android
flutter build ios --release        # iOS (serve un Mac)
flutter build windows --release    # o linux / macos
```

## Note e formato di salvataggio

Le note libere stanno in `notes.items` (`[{id, title, text}]`, al massimo 100, titolo di 80 caratteri, testo di 20 000), accanto
a `notes.traits` e `notes.backstory` che non cambiano. Il campo esiste **anche nello schema della versione JS**
(`js/model/characterSchema.js`): la versione web classica non le mostra, ma le conserva quando importa/esporta o sincronizza,
quindi il formato JSON resta lo stesso e il test di parità lo verifica (nel test di parità si ignorano solo gli `id` delle note,
perché la versione JS ne genera di casuali quando mancano o sono doppi). Nella sincronizzazione per campo le liste si scambiano
intere: due persone che modificano note diverse nello stesso momento si sovrascrivono (vince la modifica locale, come per le armi).

Scrittura a mano: tutti i campi di testo lasciano attivo `stylusHandwritingEnabled` (S Pen su Android, Apple Pencil su iOS) e un
test controlla che nessun campo lo disattivi.

## Pubblicazione del sito

`.github/workflows/pages.yml` costruisce la versione web e la pubblica su GitHub Pages: **Flutter in radice**
(`https://filippoboi.github.io/D-D5e-sheet/`) e la versione precedente in `/classic/`. Va attivato una sola volta in
*Settings → Pages → Build and deployment → Source: GitHub Actions* (finché la sorgente è «Deploy from a branch»,
il sito continua a servire i file JS della radice). Chi ha già una scheda salvata nella versione JS la ritrova:
al primo avvio l'app Flutter copia scheda, lingua, manuali e accesso dal localStorage dello stesso indirizzo.

## Test

```bash
npm run flutter:parity             # nella cartella principale: genera 96 personaggi dal Model JS
cd flutter && flutter test
```

- **Parità**: per ogni personaggio costruito dal Model JS, lo stato normalizzato e tutti i valori derivati (CA, PF, abilità,
  incantesimi, risorse, scelte…) in italiano e in inglese devono essere identici a quelli calcolati in Dart.
- **Interfaccia**: avvio, cambio lingua, descrizioni, popup degli incantesimi, accesso con token.
- **Layout** (`layout_test.dart`): barra laterale/in basso, sezioni ricordate, due colonne, nessun overflow con tablet orizzontale
  e verticale, tablet piccolo e telefono × testo 1×/1,5×/2× × italiano/inglese × 5 classi, linee guida Android sui bersagli di tocco,
  tastiera virtuale.
- **Note** (`notes_test.dart`): modello e normalizzazione, sincronizzazione, creazione, ricerca, riordino, eliminazione con annulla,
  schermo stretto, scrittura a mano attiva.
- **Traduzioni**: ogni `tr('…')` della UI ha la traduzione inglese nel dizionario.
- **Collaborazione**: client RPC, account, token e sincronizzazione contro un backend finto in memoria.

## Limiti noti

- Il layout è verificato con test e con screenshot di Chromium a 1280×800, 800×1280 e 390×800 (`docs/screenshots/`), non su un
  tablet Samsung reale: tastiera, S Pen e gesti vanno provati sul dispositivo.
- In Note la ricerca non evidenzia le corrispondenze dentro il testo; non ci sono ancora grassetti, elenchi o disegno a mano libera.
- Importa/Esporta usa il testo JSON (copia e incolla), non i file: evita plugin per ogni piattaforma.
- Il link dell'email del Master non apre l'app nativa (serve un deep link da configurare nel progetto Supabase).
- Le icone dell'app sono quelle predefinite di Flutter.
