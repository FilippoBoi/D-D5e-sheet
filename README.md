# Scheda Personaggio D&D 5E

Scheda personaggio interattiva per **Dungeons & Dragons 5ª Edizione**, scritta in HTML5, CSS3 e JavaScript vanilla, senza framework né dipendenze runtime. Calcola in automatico modificatori, CA, tiri salvezza, abilità, attacchi, CD degli incantesimi e privilegi di classe, e salva i dati nel browser.

**▶ Prova online:** <https://filippoboi.github.io/D-D5e-sheet/>

## Funzionalità

| Sezione | Cosa fa |
|---|---|
| **1. Informazioni & Classe** | Nome, giocatore, razza, background, allineamento, 12 classi, livello 1-20, bonus di competenza e dado vita automatici |
| **2. Combattimento** | CA con scomposizione, iniziativa, velocità, PF max/attuali/temporanei, PF suggeriti, danno/cura (i danni consumano prima i PF temporanei), TS contro morte, riposo lungo |
| **3. Caratteristiche** | Modificatore `floor((punteggio − 10) / 2)` istantaneo, TS con competenze impostate dalla classe |
| **4. Abilità** | Le 18 abilità ufficiali con competenza, Maestria e Factotum del Bardo; Percezione passiva |
| **5. Equipaggiamento** | Tutte le armature del Manuale (leggere, medie con DES max +2, pesanti a valore fisso), scudo +2, bonus magico, requisito di Forza e svantaggio in Furtività, Difesa senza Armatura di Barbaro e Monaco, tabella armi con TpC automatico, monete, inventario |
| **6. Incantesimi** | Visibile solo per gli incantatori. Caratteristica da incantatore, CD, bonus di attacco, slot per livello (incantatori completi, mezzi incantatori dal 2° livello, Magia del Patto del Warlock) |
| **7. Privilegi** | Privilegi di classe sbloccati livello per livello e risorse che scalano (usi dell'Ira, punti Ki, dadi dell'Attacco Furtivo…) |

Inoltre: sezioni a fisarmonica con stato memorizzato, riepilogo fisso in alto, esportazione e importazione in JSON, layout responsive per mobile e desktop, stili di stampa.

## Architettura (MVC)

```
index.html                      ← markup della View (attributi data-bind / data-out)
css/styles.css                  ← stile, design tokens, layout responsive
js/
├── app.js                      ← composition root: crea e collega M, V e C
├── core/
│   ├── EventEmitter.js         ← pub/sub usato dal Model
│   └── utils.js                ← funzioni pure (percorsi, clamp, formatModifier)
├── data/                       ← regole statiche di D&D 5E (solo dati)
│   ├── abilities.js  skills.js  armors.js  classes.js
│   ├── classFeatures.js  classResources.js  spellSlots.js
├── model/                      ← MODEL: stato e regole, nessun accesso al DOM
│   ├── CharacterModel.js       ← unica fonte di verità, emette 'change'
│   ├── characterSchema.js      ← stato di default + validazione di ogni valore
│   ├── calculations.js         ← formule pure (CA, competenza, slot, PF…)
│   ├── deriveStats.js          ← stato → tutti i valori calcolati
│   └── LocalStorageRepository.js ← persistenza
├── view/                       ← VIEW: solo DOM, nessuna regola di gioco
│   ├── CharacterView.js
│   └── dom.js
└── controller/
    └── CharacterController.js  ← eventi View → comandi Model → render View
tests/                          ← test con il runner integrato di Node
```

### Flusso dei dati

```
 utente modifica un input
        │
        ▼
 View.onFieldChange(path, value) ──► Controller ──► Model.set(path, value)
                                                         │ valida + aggiorna
                                                         ▼
 View.render(state, derived) ◄── Controller ◄── evento 'change'
                                     │
                                     └──► LocalStorageRepository.save()  (con debounce)
```

- Il **Model** conserva solo i dati inseriti dal giocatore. Tutto ciò che si può calcolare (modificatori, CA, CD…) viene derivato da `deriveStats()` a ogni modifica, quindi non può andare fuori sincrono.
- La **View** è dichiarativa: `data-bind="abilities.str"` collega un input allo stato, `data-out="ac"` mostra un valore calcolato e `data-show-if="spellcasting.isCaster"` gestisce la visibilità.
- Il **Controller** non contiene regole né codice DOM: smista eventi e comandi.

Ogni dato in ingresso, da un input, da `localStorage` o da un file importato, passa da `sanitizeValue()`. Così lo stato resta valido anche con salvataggi vecchi o manomessi.

## Avvio in locale

L'app usa i **moduli ES** (`<script type="module">`), che i browser non caricano da `file://`. Serve quindi un piccolo server statico. Va bene uno qualsiasi di questi:

```bash
npx serve .
```

```bash
python -m http.server 8080
```

Poi apri <http://localhost:8080> (con `npx serve` la porta predefinita è 3000).

In alternativa, in VS Code puoi usare l'estensione **Live Server** con "Open with Live Server" su `index.html`.

## Test

Le regole del Model sono funzioni pure e si testano senza browser né dipendenze (Node ≥ 18):

```bash
npm test
```

I test girano anche su GitHub Actions a ogni push e pull request (`.github/workflows/ci.yml`).

## Pubblicazione su GitHub Pages

1. Crea un repository su GitHub e carica il progetto:
   ```bash
   git init
   git add .
   git commit -m "Prima versione della scheda personaggio"
   git branch -M main
   git remote add origin https://github.com/<utente>/<repository>.git
   git push -u origin main
   ```
2. Su GitHub apri **Settings → Pages**.
3. In **Build and deployment** scegli *Source: Deploy from a branch*, branch `main`, cartella `/ (root)`, poi **Save**.
4. Dopo circa un minuto la scheda è online su `https://<utente>.github.io/<repository>/`.

Il file `.nojekyll` dice a GitHub Pages di servire i file così come sono, senza elaborarli con Jekyll.

## Dati e privacy

I dati restano solo nel `localStorage` del browser in uso e non vengono mai inviati altrove. Per spostare un personaggio su un altro dispositivo usa **Esporta** e **Importa** (file JSON). Se il browser blocca lo storage, ad esempio in alcune modalità private, la scheda funziona lo stesso ma non salva.

## Estendere la scheda

- **Nuova armatura**: aggiungi una voce in `js/data/armors.js`; il selettore si aggiorna da solo.
- **Nuovo privilegio o classe**: modifica `js/data/classes.js` e `js/data/classFeatures.js`.
- **Nuovo campo**: aggiungi il valore di default in `characterSchema.js` e un input con `data-bind="percorso"` in `index.html`. Se serve una validazione, aggiungi una regola in `RULES`.
- **Nuovo valore calcolato**: aggiungilo all'oggetto restituito da `deriveStats()` e mostralo con `data-out="percorso"`.

## Note legali

Progetto amatoriale non ufficiale. *Dungeons & Dragons* è un marchio di Wizards of the Coast. Le descrizioni dei privilegi sono riassunti brevi pensati come promemoria: per il testo completo fai riferimento al Manuale del Giocatore.
