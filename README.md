🇮🇹 Italiano · **[🇬🇧 English](README.en.md)**

# Scheda Personaggio D&D 5E

Scheda personaggio interattiva per **Dungeons & Dragons 5ª Edizione**, scritta in HTML5, CSS3 e JavaScript vanilla, senza framework né dipendenze runtime. Calcola in automatico modificatori, CA, tiri salvezza, abilità, attacchi, CD degli incantesimi e privilegi di classe, e salva i dati nel browser.

**▶ Prova online:** <https://filippoboi.github.io/D-D5e-sheet/>

## Funzionalità

| Sezione | Cosa fa |
|---|---|
| **1. Informazioni & Classe** | Nome, giocatore, razza, background, allineamento, 12 classi, livello 1-20, bonus di competenza e dado vita automatici, e le **scelte di classe** del PHB (sottoclasse, stile di combattimento, Maestria, Metamagia, Suppliche Occulte, Manovre, Discipline…): vedi sotto |
| **2. Combattimento** | CA con scomposizione, iniziativa, velocità, PF max/attuali/temporanei, PF suggeriti, danno/cura (i danni consumano prima i PF temporanei), TS contro morte, riposo lungo |
| **3. Caratteristiche** | Modificatore `floor((punteggio − 10) / 2)` istantaneo, TS con competenze impostate dalla classe |
| **4. Abilità** | Le 18 abilità ufficiali con competenza, Maestria e Factotum del Bardo; Percezione passiva |
| **5. Equipaggiamento** | Tutte le armature del Manuale (leggere, medie con DES max +2, pesanti a valore fisso), scudo +2, bonus magico, requisito di Forza e svantaggio in Furtività, Difesa senza Armatura di Barbaro e Monaco, tabella armi con TpC automatico, monete, inventario |
| **6. Incantesimi** | Visibile solo per gli incantatori. Caratteristica da incantatore, CD, bonus di attacco, slot per livello (incantatori completi, mezzi incantatori dal 2° livello, Magia del Patto del Warlock), **trucchetti e incantesimi scelti** da un elenco di circa 500 voci (vedi sotto) |
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
│   ├── spells.js  spellNames.js  spellProgression.js   ← incantesimi (generated/spells.js da 5e.tools)
│   └── classChoices/           ← scelte di classe: un file per classe + index.js
├── model/                      ← MODEL: stato e regole, nessun accesso al DOM
│   ├── CharacterModel.js       ← unica fonte di verità, emette 'change'
│   ├── characterSchema.js      ← stato di default + validazione di ogni valore
│   ├── calculations.js         ← formule pure (CA, competenza, slot, PF…)
│   ├── classChoices.js         ← scelte di classe: validazione, azzeramenti, effetti, privilegi
│   ├── deriveStats.js          ← stato → tutti i valori calcolati
│   └── LocalStorageRepository.js ← persistenza
├── view/                       ← VIEW: solo DOM, nessuna regola di gioco
│   ├── CharacterView.js
│   ├── AuthView.js             ← barra di sessione, login, pannello del Master
│   └── dom.js
├── controller/
│   ├── CharacterController.js  ← eventi View → comandi Model → render View
│   └── SessionController.js    ← login, pannello del Master, collega la scheda condivisa
├── auth/                       ← AccountService (login Master con email), AuthService (chi è collegato)
├── net/RemoteApi.js            ← chiamate RPC al database (solo fetch)
├── sync/                       ← sincronizzazione per sezione (CharacterSync, diff)
└── config.js                   ← URL e chiave pubblica del backend (vuoti = solo locale)
supabase/schema.sql             ← tabelle, sicurezza e funzioni del backend
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

## Scelte di classe

Tutte le scelte di classe del Manuale del Giocatore 2014 (solo PHB), dal 1° al 20° livello, nel pannello *Informazioni & Classe*: sottoclasse (Patrono, Dominio, Cammino, Collegio, Circolo, Archetipo, Tradizione, Giuramento, Scuola), Stile di Combattimento (anche l'extra del Campione), Maestria, Metamagia, Suppliche Occulte, Dono del Patto, Arcanum Mistico, Manovre, Discipline Elementali, Nemico Prescelto ed Esploratore Nato, spirito totemico, scelte del Cacciatore, terreno del Circolo della Terra, ascendenza draconica. Vedi solo ciò che la classe ha **al livello attuale**. Nel pannello *Privilegi* i privilegi generici ("Privilegio del Cammino") sono sostituiti da quelli dell'opzione scelta, con un'etichetta ("Patrono Ultraterreno: Immondo").

### Cosa si calcola e cosa resta descrittivo

| Calcolato | Dove |
|---|---|
| Stile Difesa: +1 CA con armatura, nella scomposizione della CA | `calculations.js` |
| Resilienza Draconica: CA 13 + DES senza armatura (scudo consentito) e +1 PF suggeriti per livello | `calculations.js` |
| Maestria (Ladro, Bardo) solo su abilità competenti e entro la quota; competenza e Maestria da Dominio della Conoscenza, competenze del Collegio della Sapienza e Accolito della Natura | `classChoices.js`, `deriveStats.js` |
| Cavaliere Mistico e Mistificatore Arcano: incantatori "a un terzo" dal 3° (INT, slot, CD, bonus) | `spellSlots.js`, `deriveStats.js` |
| Maestro di Battaglia: dadi di superiorità e CD delle manovre | `classResources.js` |
| Circolo della Luna: GS massimo della Forma Selvatica | `classResources.js` |

Resta **descrittivo** ciò che dipende dall'arma impugnata o dalla situazione (Tiro, Duellare, Armi Possenti, Protezione, Combattere con Due Armi, critici del Campione…), gli incantesimi (di dominio, di patrono, Arcanum Mistico: qui solo una nota di testo) e le competenze con armature e strumenti.

### Regole di comportamento

- **Cambio classe**: tutte le scelte si azzerano.
- **Cambio sottoclasse**: si azzerano le scelte che ne dipendono (`when`).
- **Calo di livello o prerequisito perso** (Patto, livello, competenza): non si cancella nulla. Una scelta sotto il suo livello si nasconde; gli elementi di una lista oltre la quantità consentita, o con prerequisito non soddisfatto, restano memorizzati ma non contano e la scheda li segnala con un pulsante per toglierli.
- **Salvataggi e JSON vecchi** si caricano senza errori: le chiavi mancanti prendono il valore di default. `SCHEMA_VERSION` non cambia, perché i campi sono solo aggiunti.
- **Collaborazione**: nessuna modifica al backend. I campi singoli si fondono come gli altri; le liste (Invocazioni, Manovre…) si sostituiscono intere, quindi due persone che modificano la *stessa* lista insieme si sovrascrivono (vince l'ultima).

### Formato dei dati e come aggiungere una scelta

Un file per classe in `js/data/classChoices/` (più `index.js`, che documenta tutti i campi). Una scelta è un oggetto:

```js
{ key: 'metamagic', type: 'multi', minLevel: 3, count: [[3, 2], [10, 3], [17, 4]],
  label: 'Metamagia', labelEn: 'Metamagic',
  options: [{ value: 'twinned', label: 'Incantesimo Gemello', labelEn: 'Twinned Spell',
              description: '…', descriptionEn: '…' }] }
```

| `type` | Significato | Stato (`info.classChoices[key]`) |
|---|---|---|
| `single` | un'opzione da una lista (sottoclasse, stile…) | stringa |
| `multi` | N opzioni distinte, con N che dipende dal livello (`count`) | elenco |
| `skills` | N abilità: `mode: 'expertise'` (solo competenti), `'proficiency'` o `'both'` | elenco |
| `text` | testo breve (Arcanum Mistico) | stringa, max 60 caratteri |

Campi utili: `when: { key, in: [...] }` (la scelta esiste solo per certi valori di un'altra), `prereq: { level, choice: { key, value } }` sull'opzione, `differsFrom` (deve differire da un'altra scelta), `featureName` (riga di privilegi a cui aggiungere la scelta), `effects` sull'opzione (`acWithArmor`, `hpPerLevel`, `unarmoredDefense`, `spellcasting`) e `features: [livello, nome, descrizione, nameEn, descriptionEn]` per i privilegi della sottoclasse. Italiano e inglese sono obbligatori: `tests/i18n.test.js` fallisce se manca una traduzione. Le chiavi dello stato sono uniche tra le classi e i valori delle sottoclassi pure (lo verifica `tests/classChoices.test.js`); il default si genera dalle definizioni, quindi non serve toccare lo schema.

### Trucchetti e incantesimi

Nel pannello **Incantesimi** i pulsanti «Scegli trucchetti» e «Scegli incantesimi» aprono un popup (a schermo intero su telefono) con ricerca per nome in italiano o inglese, filtri per livello, rituali e concentrazione, e un tocco per aggiungere o togliere: le modifiche si salvano subito. Per ogni voce si vedono scuola, tempo di lancio, gittata, componenti, durata e il rimando al manuale («PHB, p. 241»).

Ogni abilità, trucchetto e incantesimo ha un pulsante **«i»** (sulla scheda, nell'elenco delle abilità e nel popup di scelta) che apre la descrizione nella lingua dell'interfaccia (con ripiego sull'italiano). I testi vengono dai file in `docs/` (`skills-description.md`, `cantrips-description.md`, `spell-descriptions.md`): testo **SRD 5.1** (CC BY 4.0) con traduzione italiana non ufficiale, e brevi riassunti originali per ciò che è fuori dall'SRD. Dopo aver corretto un Markdown, `npm run descriptions` rigenera `js/data/generated/skillDescriptions.js` e `spellDescriptions.js` (il secondo, circa 700 KB, si scarica solo alla prima descrizione aperta). Non esiste ancora un elenco dei talenti: restano nel campo di testo libero. Per aggiungere una lingua: voce in `i18n.js`, bandiera in `FLAGS` di `scripts/build-descriptions.mjs` e un blocco per lingua nei Markdown; `tests/descriptions.test.js` elenca ciò che manca.

- L'elenco proposto è la **lista della classe** (il Cavaliere Mistico e il Mistificatore Arcano usano quella del Mago); «Altre classi» allarga, e le aggiunte dei supplementi (Xanathar, Tasha…) compaiono quando si attiva quel manuale nel riquadro «Manuali».
- «Tutti» mostra gli incantesimi fino al livello dei propri slot; «Oltre» quelli di livello superiore.
- Il contatore (es. `3/4`) segue le tabelle del PHB: trucchetti e incantesimi conosciuti, oppure modificatore + livello per chi prepara (Chierico, Druido, Mago; Paladino con metà livello). È un'indicazione, non un blocco: diventa rosso se si supera il limite (talenti, regole della casa…).
- Cambiando classe gli elenchi si svuotano (appartengono alla vecchia lista). I due campi di testo libero restano, nel riquadro «Altri incantesimi, a mano», per ciò che non è in elenco.
- Nomi: in italiano solo quelli ufficiali già noti al progetto (`js/data/spellNames.js`), altrimenti il titolo inglese; la ricerca trova entrambi.

### Altri manuali (da 5e.tools)

Nel pannello *Informazioni & Classe* c'è la sezione **Manuali**: il PHB è sempre attivo, gli altri (Xanathar, Tasha, Volo, Mordenkainen, Eberron, Wildemount, Ravnica, Theros, Strixhaven, avventure…) si attivano a piacere e la scelta resta nel browser. Attivando un manuale compaiono nei menu le sue **razze e sottorazze** (con bonus, velocità, scurovisione, competenze), i suoi **background** e le sue **sottoclassi** (nome, livelli e nomi dei privilegi, con il rimando «Vedi XGE, p. 28»). Ciò che hai già scelto resta sempre visibile anche se spegni il manuale.

I dati stanno in `js/data/generated/` e si rigenerano con `npm run data` (script `scripts/build-5etools-data.mjs`, che legge il mirror dei dati 2014 di 5e.tools). Non si copia il testo dei manuali: le descrizioni dei privilegi si scrivono a mano, come per il PHB. Limiti noti: nomi e tratti sono in inglese (5e.tools non ha l'italiano; i nomi italiani sono solo quelli già noti), i bonus liberi di *Mostri del Multiverso* e le varianti «Variant; …» non hanno effetto automatico, e le scelte interne delle sottoclassi (Rune, Manovre aggiuntive…) e la classe Artefice non sono ancora coperte.

Fonte dei contenuti: 5e.tools (PHB 2014), con descrizioni sintetiche e non copiate. 5e.tools non ha l'italiano: i termini italiani sono quelli già nel progetto o una resa provvisoria; l'elenco di quelli da verificare sul PHB italiano è nei commenti in testa a ciascun file di dati.

### Prestazioni e accessibilità

Le scelte pesano circa 100 KB (31 KB compressi) e sono moduli statici: `deriveStats()` è sincrona e a ogni render si elabora solo la classe attiva (calcolo dei derivati sotto 1 ms, un click su una casella dipinto in circa 30 ms con la lista più lunga). Le liste multiple sono `fieldset` con `legend`, caselle native, contatore in `aria-live`, note collegate con `aria-describedby`, ricerca oltre 12 opzioni e righe alte almeno 44 px; funzionano da tastiera. Provato a 390 px.

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

Le regole del Model sono funzioni pure e si testano senza browser né dipendenze (Node ≥ 18). Le scelte di classe hanno test su dati, validazione, azzeramenti, effetti calcolati, sincronizzazione e traduzioni (`tests/classChoices*.test.js`, `tests/i18n.test.js`):

```bash
npm test
```

I test girano anche su GitHub Actions a ogni push e pull request (`.github/workflows/ci.yml`).

Il backend ha un suo test di sicurezza (`supabase/tests/security.sql`): carica lo schema su un Postgres vero e verifica, recitando i ruoli reali (anonimo, Master loggato, proprietario del database), che nessuno possa leggere o scrivere schede altrui, tra giocatori e tra Master, che i token ruotati smettano di funzionare, che una campagna si rivendichi una sola volta e che due persone non si sovrescrivano. In CI parte da solo; in locale, con un Postgres qualsiasi:

```bash
psql -v ON_ERROR_STOP=1 -f supabase/tests/prepare.sql -f supabase/schema.sql -f supabase/tests/security.sql
```

(`prepare.sql` crea i ruoli, lo schema `auth` e `auth.uid()` che Supabase fornisce già: su Supabase non serve. `fixtures/` contiene gli schemi realmente pubblicati in passato (v1 e v2) e `legacy.sql` i dati di una campagna con il token admin: servono a provare l'aggiornamento di un database già in uso e la rivendicazione, anche in CI.)

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

## Collaborazione online (opzionale)

Master e giocatori possono lavorare sulla stessa scheda. Il **Master** entra con la sua **email** (un link, niente password); i **giocatori** con un **token** che il Master dà loro.

| Chi | Come entra | Cosa può fare |
|---|---|---|
| **Master** | Account: riceve un link per email. Funziona da qualunque dispositivo, quindi non c'è nulla da perdere | Crea più campagne (ognuna ha **un solo Master**, il suo creatore); per ognuna crea le schede, vede e modifica quelle di tutti, ricopia i link, ruota (revoca) i token, elimina |
| **Giocatore** | Token `PG-XXXX-XXXX-XXXX`, o link di invito `…/?t=TOKEN` | Una sola scheda: la sua. Non vede né tocca quelle degli altri |

Il token viene tolto dall'indirizzo subito dopo l'ingresso e il dispositivo resta collegato. Le modifiche arrivano agli altri in pochi secondi. Si scambiano solo i campi cambiati: il Master che toglie PF e il giocatore che cambia la velocità non si sovrascrivono, anche se i due campi stanno nella stessa sezione. Solo se due persone modificano *lo stesso campo* (o la stessa lista, come le armi) vince l'ultimo che salva. Ogni pochi secondi il browser chiede soltanto un numero di revisione (pochi byte) e scarica la scheda solo se è cambiata. La scheda locale del browser non viene toccata mentre si è in campagna, e se la scheda di campagna è vuota si può caricarci quella locale.

**Senza configurazione l'app resta solo locale**, come prima.

### Attivarla (circa 10 minuti, gratis)

1. Crea un progetto su [supabase.com](https://supabase.com).
2. In **SQL Editor** incolla ed esegui `supabase/schema.sql` (si può rieseguire dopo ogni aggiornamento).
3. In **Authentication → URL Configuration** imposta **Site URL** con l'indirizzo del tuo sito (es. `https://tuonome.github.io/nome-repo/`) e aggiungilo anche tra i **Redirect URLs** (meglio con `/**` in fondo; per provare in locale aggiungi `http://localhost:8080/**`). Senza questo il link dell'email non riporta alla scheda.
4. In **Project Settings → API** copia *Project URL* e la chiave *anon / publishable* in `js/config.js`. Sono pubbliche per progettazione: la sicurezza sta nel database. **Non** usare mai la chiave `service_role` / *secret*.
5. Pubblica come al solito. Apri il sito → **Accedi / Campagna** → inserisci la tua email → apri il link ricevuto → *Crea campagna*.
6. *(Consigliato)* Dopo aver fatto il tuo primo accesso, in **Authentication → Sign In / Providers** disattiva **Allow new users to sign up**: da quel momento nessun altro può registrarsi, né farti spedire email a indirizzi altrui. Se vuoi altri Master, riattivala il tempo che si registrino.
7. *(Consigliato)* Imposta un **codice di creazione**, così solo chi lo conosce può creare campagne. Nel SQL Editor:

   ```sql
   select set_creation_code('una frase lunga e tua');
   ```

   Il form *Crea campagna* chiederà il codice e il database rifiuta la creazione senza quello giusto. Per toglierlo: `select set_creation_code(null);`. Nel database resta solo l'hash; scegli una frase lunga, perché non c'è un limite di tentativi.

**Aggiornare uno schema già installato**: incolla di nuovo `supabase/schema.sql` ed eseguilo; non cancella campagne né schede. Se arrivi dalla versione con il **token admin**, quel token non serve più per entrare: accedi come Master con la tua email e, nella schermata *La tua campagna*, usa **Rivendica campagna** con il vecchio token. Succede una volta sola: da quel momento la campagna è del tuo account e il vecchio token smette di valere. I token dei giocatori non cambiano.

### Email: limiti e problemi comuni

- Il servizio email incluso in Supabase consegna **solo agli indirizzi dei membri della tua organizzazione** e manda **al massimo 2 email l'ora** ([dettagli](https://supabase.com/docs/guides/auth/rate-limits)). Per un Master solo (tu) basta. Per altri Master serve un provider email tuo (SMTP personalizzato, in **Authentication → SMTP Settings**, es. Resend o Brevo con piano gratuito): il codice non cambia.
- *"Il link è scaduto o già usato"*: alcuni programmi di posta aprono i link in anteprima e li consumano prima di te. Chiedi un nuovo link e aprilo copiandolo nel browser; tra un invio e l'altro passa almeno un minuto.
- *"Troppi invii di email"*: hai raggiunto il limite orario; aspetta o configura un SMTP tuo.

### Sicurezza, in breve

- Le tabelle hanno RLS attiva e nessuna policy: con la chiave pubblica non si legge né scrive nulla direttamente. Tutto passa da funzioni che verificano **chi chiama**: l'account (Master) o il token (giocatore), e limitano l'accesso alla sua campagna / scheda.
- Il Master è un account Supabase Auth con email; l'unico proprietario di una campagna è chi l'ha creata. Gli accessi anonimi di Supabase (se mai li attivassi) non sono considerati Master.
- I token dei giocatori sono salvati in chiaro perché il Master deve poterli ricopiare: sono leggibili solo dal proprietario della campagna. Chi ha il token di una scheda può modificarla, quindi trattalo come una password.
- Token da 60 bit casuali: non si indovinano. Non c'è un limite di frequenza sui tentativi, di proposito: un'attesa nel database terrebbe occupata una connessione per ogni tentativo e permetterebbe a chiunque di esaurirle con poche richieste. Per un tavolo di gioco è adeguato, non per dati sensibili.
- La sessione del Master sta nel browser (`localStorage`) e si rinnova da sola. La pagina ha una **Content-Security-Policy** che le permette di caricare solo i propri file e di parlare solo con sé stessa e con `*.supabase.co`, così uno script iniettato non potrebbe spedire altrove la sessione. Se il progetto usa un dominio Supabase personalizzato, aggiungilo a `connect-src` nel `<meta>` di `index.html`. Dopo l'ingresso dal link il refresh token che era nell'indirizzo viene subito sostituito, perché non resti valido nella cronologia del browser.
- I link di invito dei giocatori contengono il token: la pagina non invia mai il Referer ad altri siti e lo toglie dall'indirizzo dopo l'ingresso. Resta però nella cronologia del browser da cui il link è stato aperto; se il dubbio c'è, il Master può rigenerare il token.
- Senza codice di creazione (vedi sopra) chiunque sia registrato può creare campagne: non vede né tocca le altre, ma usa il tuo spazio. In ogni caso il limite è di 50 schede per campagna e 128 KB per scheda (una scheda reale ne occupa pochi).
- Se un account viene eliminato da Supabase, le sue campagne restano (senza proprietario) e i giocatori non perdono la scheda.
- Il piano gratuito di Supabase mette in pausa i progetti inattivi per qualche settimana: al primo accesso basta riattivarlo dal pannello.

## Dati e privacy

Senza collaborazione online i dati restano solo nel `localStorage` del browser in uso e non vengono mai inviati altrove; con la collaborazione attiva, le schede *di campagna* (e solo quelle) vengono salvate sul tuo progetto Supabase. Per spostare un personaggio su un altro dispositivo usa **Esporta** e **Importa** (file JSON). Se il browser blocca lo storage, ad esempio in alcune modalità private, la scheda funziona lo stesso ma non salva.

## Estendere la scheda

- **Nuova armatura**: aggiungi una voce in `js/data/armors.js`; il selettore si aggiorna da solo.
- **Nuovo privilegio o classe**: modifica `js/data/classes.js` e `js/data/classFeatures.js`.
- **Nuovo campo**: aggiungi il valore di default in `characterSchema.js` e un input con `data-bind="percorso"` in `index.html`. Se serve una validazione, aggiungi una regola in `RULES`.
- **Nuovo valore calcolato**: aggiungilo all'oggetto restituito da `deriveStats()` e mostralo con `data-out="percorso"`.

## Licenza

Il **codice** è rilasciato con licenza [MIT](LICENSE). I testi SRD 5.1 in `docs/` e nei dati generati sono © Wizards of the Coast, [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/legalcode); la traduzione italiana è non ufficiale.

## Note legali

Progetto amatoriale non ufficiale. *Dungeons & Dragons* è un marchio di Wizards of the Coast. Le descrizioni dei privilegi sono riassunti brevi pensati come promemoria: per il testo completo fai riferimento al Manuale del Giocatore.
