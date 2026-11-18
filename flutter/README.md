# Scheda Personaggio D&D 5E — app Flutter

Riscrittura in Flutter dell'app web che sta nella cartella principale del repository: stessa scheda, stessi
calcoli, stesso formato di salvataggio (i JSON esportati da una versione si importano nell'altra), per
**Android, iOS, web e desktop** (Windows, macOS, Linux) con un solo codice.

L'app web (HTML/CSS/JS) resta al suo posto e continua a funzionare: questa è una cartella a parte, `flutter/`.

## Cosa c'è

- Scheda completa: informazioni e classe (scelte di classe, razze e background, manuali), combattimento e PF
  (riposi, tiri contro morte, salita di livello), caratteristiche, tiri salvezza e abilità, equipaggiamento (armatura,
  oggetti CA, armi, monete), incantesimi e trucchetti, privilegi e risorse a usi limitati, lingue.
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
  ui/                 pannelli, popup incantesimi, descrizioni, sessione
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

## Test

```bash
npm run flutter:parity             # nella cartella principale: genera 96 personaggi dal Model JS
cd flutter && flutter test
```

- **Parità**: per ogni personaggio costruito dal Model JS, lo stato normalizzato e tutti i valori derivati (CA, PF, abilità,
  incantesimi, risorse, scelte…) in italiano e in inglese devono essere identici a quelli calcolati in Dart.
- **Interfaccia**: avvio, cambio lingua, descrizioni, popup degli incantesimi, accesso con token.
- **Traduzioni**: ogni `tr('…')` della UI ha la traduzione inglese nel dizionario.
- **Collaborazione**: client RPC, account, token e sincronizzazione contro un backend finto in memoria.

## Limiti noti

- Importa/Esporta usa il testo JSON (copia e incolla), non i file: evita plugin per ogni piattaforma.
- Il link dell'email del Master non apre l'app nativa (serve un deep link da configurare nel progetto Supabase).
- Le icone dell'app sono quelle predefinite di Flutter.
