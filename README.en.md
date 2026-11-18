**[🇮🇹 Italiano](README.md)** · 🇬🇧 English

# D&D 5E Character Sheet

An interactive character sheet for **Dungeons & Dragons 5th Edition**, written in HTML5, CSS3 and vanilla JavaScript, with no frameworks and no runtime dependencies. It automatically calculates modifiers, AC, saving throws, skills, attacks, spell save DCs and class features, and saves your data in the browser.

**▶ Try it online:** <https://filippoboi.github.io/D-D5e-sheet/>

The interface is available in **Italian and English** (flag selector in the header). It follows your browser language by default.

## Features

| Section | What it does |
|---|---|
| **1. Info & Class** | Name, player, race, background, alignment, 12 classes, level 1-20, automatic proficiency bonus and hit die |
| **2. Combat** | AC with breakdown, initiative, speed, max/current/temporary HP, suggested HP, damage/healing (damage uses temporary HP first), death saves, long rest |
| **3. Abilities** | Instant modifier `floor((score − 10) / 2)`, saving throws with proficiencies set by the class |
| **4. Skills** | The 18 official skills with proficiency, Expertise and the Bard's Jack of All Trades; passive Perception |
| **5. Equipment** | Every Player's Handbook armor (light, medium with max DEX +2, heavy with a fixed value), +2 shield, magic bonus, Strength requirement and Stealth disadvantage, Barbarian and Monk Unarmored Defense, weapon table with automatic to-hit, coins, inventory |
| **6. Spells** | Shown only to spellcasters. Spellcasting ability, DC, attack bonus, slots per level (full casters, half casters from level 2, Warlock Pact Magic), and **chosen cantrips and spells** picked from a list of about 500 entries (see below) |
| **7. Features** | Class features unlocked level by level and scaling resources (Rage uses, Ki points, Sneak Attack dice…) |

Also: collapsible sections that remember their state, a sticky summary bar, JSON export and import, a responsive layout for mobile and desktop, and print styles.

## Architecture (MVC)

```
index.html                      ← the View's markup (data-bind / data-out attributes)
css/styles.css                  ← styles, design tokens, responsive layout
js/
├── app.js                      ← composition root: creates and wires M, V and C
├── core/
│   ├── EventEmitter.js         ← pub/sub used by the Model
│   └── utils.js                ← pure functions (paths, clamp, formatModifier)
├── data/                       ← static D&D 5E rules (data only)
│   ├── abilities.js  skills.js  armors.js  classes.js
│   ├── classFeatures.js  classResources.js  spellSlots.js
│   ├── spells.js  spellNames.js  spellProgression.js   ← spells (generated/spells.js from 5e.tools)
├── model/                      ← MODEL: state and rules, no DOM access
│   ├── CharacterModel.js       ← single source of truth, emits 'change'
│   ├── characterSchema.js      ← default state + validation of every value
│   ├── calculations.js         ← pure formulas (AC, proficiency, slots, HP…)
│   ├── deriveStats.js          ← state → all the calculated values
│   └── LocalStorageRepository.js ← persistence
├── view/                       ← VIEW: DOM only, no game rules
│   ├── CharacterView.js
│   ├── AuthView.js             ← session bar, sign-in, the DM's panel
│   └── dom.js
├── controller/
│   ├── CharacterController.js  ← View events → Model commands → View render
│   └── SessionController.js    ← sign-in, the DM's panel, attaches the shared sheet
├── auth/                       ← AccountService (DM sign-in by email), AuthService (who is signed in)
├── net/RemoteApi.js            ← RPC calls to the database (fetch only)
├── sync/                       ← field-level synchronization (CharacterSync, diff)
└── config.js                   ← backend URL and public key (empty = local only)
supabase/schema.sql             ← backend tables, security and functions
tests/                          ← tests using Node's built-in runner
```

### Data flow

```
 user edits an input
        │
        ▼
 View.onFieldChange(path, value) ──► Controller ──► Model.set(path, value)
                                                         │ validates + updates
                                                         ▼
 View.render(state, derived) ◄── Controller ◄── 'change' event
                                     │
                                     └──► LocalStorageRepository.save()  (debounced)
```

- The **Model** stores only what the player entered. Everything that can be calculated (modifiers, AC, DC…) is derived by `deriveStats()` on every change, so it can never go out of sync.
- The **View** is declarative: `data-bind="abilities.str"` binds an input to the state, `data-out="ac"` shows a calculated value and `data-show-if="spellcasting.isCaster"` controls visibility.
- The **Controller** contains neither rules nor DOM code: it routes events and commands.

Every incoming value, whether from an input, from `localStorage` or from an imported file, goes through `sanitizeValue()`. This keeps the state valid even with old or tampered saves.

### Cantrips and spells

In the **Spells** panel, “Choose cantrips” and “Choose spells” open a popup (full screen on phones) with search by Italian or English name, filters for level, rituals and concentration, and one tap to add or remove: changes are saved right away. Each entry shows school, casting time, range, components, duration and the sourcebook reference (“PHB, p. 241”); descriptions are not copied.

- The list offered is the **class spell list** (Eldritch Knight and Arcane Trickster use the Wizard list); “Other classes” widens it, and additions from supplements (Xanathar's, Tasha's…) appear once that book is turned on in “Sourcebooks”.
- “All” shows spells up to the level of your slots; “Higher” shows the rest.
- The counter (e.g. `3/4`) follows the PHB tables: cantrips and spells known, or modifier + level for prepared casters (Cleric, Druid, Wizard; Paladin uses half level). It is a guide, not a block: it turns red past the limit (feats, house rules…).
- Changing class clears the lists (they belonged to the old class's list). The two free-text fields remain, under “Other spells, by hand”, for anything not in the list.
- Names: Italian only for the official ones the project already knows (`js/data/spellNames.js`), otherwise the English title; search finds both.

## Running it locally

The app uses **ES modules** (`<script type="module">`), which browsers will not load from `file://`. You therefore need a small static server. Any of these will do:

```bash
npx serve .
```

```bash
python -m http.server 8080
```

Then open <http://localhost:8080> (with `npx serve` the default port is 3000).

Alternatively, in VS Code you can use the **Live Server** extension with "Open with Live Server" on `index.html`.

## Tests

The Model's rules are pure functions and can be tested with no browser and no dependencies (Node ≥ 18):

```bash
npm test
```

The tests also run on GitHub Actions on every push and pull request (`.github/workflows/ci.yml`).

The backend has its own security test (`supabase/tests/security.sql`). It loads the schema into a real Postgres and checks, playing the real roles (anonymous, signed-in DM, database owner), that nobody can read or write other people's sheets, neither between players nor between DMs, that rotated tokens stop working, that a campaign can be claimed only once, and that two people do not overwrite each other. On CI it runs by itself; locally, with any Postgres:

```bash
psql -v ON_ERROR_STOP=1 -f supabase/tests/prepare.sql -f supabase/schema.sql -f supabase/tests/security.sql
```

(`prepare.sql` creates the roles, the `auth` schema and `auth.uid()` that Supabase already provides, so on Supabase it is not needed. `fixtures/` holds the schemas that were actually published in the past (v1 and v2) and `legacy.sql` the data of a campaign with the old admin token. They are used to test upgrading a database that is already in use, and claiming a campaign, on CI as well.)

## Publishing on GitHub Pages

1. Create a repository on GitHub and upload the project:
   ```bash
   git init
   git add .
   git commit -m "First version of the character sheet"
   git branch -M main
   git remote add origin https://github.com/<user>/<repository>.git
   git push -u origin main
   ```
2. On GitHub open **Settings → Pages**.
3. Under **Build and deployment** choose *Source: Deploy from a branch*, branch `main`, folder `/ (root)`, then **Save**.
4. After about a minute the sheet is online at `https://<user>.github.io/<repository>/`.

The `.nojekyll` file tells GitHub Pages to serve the files as they are, without processing them with Jekyll.

## Online collaboration (optional)

DM and players can work on the same sheet. The **DM** signs in with their **email** (a link, no password); **players** sign in with a **token** that the DM gives them.

| Who | How they sign in | What they can do |
|---|---|---|
| **DM** | Account: receives a link by email. It works from any device, so there is nothing to lose | Creates any number of campaigns (each has **a single DM**, its creator); in each one creates sheets, sees and edits everyone's sheet, copies the links, rotates (revokes) tokens, deletes |
| **Player** | Token `PG-XXXX-XXXX-XXXX`, or invite link `…/?t=TOKEN` | One sheet only: their own. They cannot see or touch anyone else's |

The token is removed from the address bar right after signing in, and the device stays signed in. Changes reach the others within a few seconds. Only the fields that changed are exchanged: the DM lowering HP and a player changing their speed do not overwrite each other, even though both fields live in the same section. Only if two people edit *the same field* (or the same list, like the weapons) does the last one to save win. Every few seconds the browser asks only for a revision number (a few bytes) and downloads the sheet only if it has changed. The browser's local sheet is left untouched while you are in a campaign, and if the campaign sheet is empty you can upload your local one to it.

**Without configuration the app stays local-only**, exactly as before.

### Turning it on (about 10 minutes, free)

1. Create a project on [supabase.com](https://supabase.com).
2. In the **SQL Editor** paste and run `supabase/schema.sql` (it can be re-run after every update).
3. In **Authentication → URL Configuration** set **Site URL** to your site's address (e.g. `https://yourname.github.io/repo-name/`) and add it to the **Redirect URLs** too (preferably ending in `/**`; to try it locally also add `http://localhost:8080/**`). Without this the email link does not bring you back to the sheet.
4. In **Project Settings → API** copy the *Project URL* and the *anon / publishable* key into `js/config.js`. They are public by design: security lives in the database. **Never** use the `service_role` / *secret* key.
5. Publish as usual. Open the site → **Sign in / Campaign** → enter your email → open the link you receive → *Create campaign*.
6. *(Recommended)* After your first sign-in, in **Authentication → Sign In / Providers** turn off **Allow new users to sign up**: from then on nobody else can register, or make you send emails to other people's addresses. If you want more DMs, turn it back on for as long as they need to register.
7. *(Recommended)* Set a **creation code**, so that only people who know it can create campaigns. In the SQL Editor:

   ```sql
   select set_creation_code('a long phrase of your own');
   ```

   The *Create campaign* form will then ask for the code and the database rejects creation without the right one. To remove it: `select set_creation_code(null);`. Only the hash is stored in the database; choose a long phrase, because there is no limit on attempts.

**Upgrading an installed schema**: paste `supabase/schema.sql` again and run it; it does not delete campaigns or sheets. If you are coming from the version with the **admin token**, that token no longer signs you in: sign in as DM with your email and, on the *Your campaign* screen, use **Claim campaign** with the old token. This happens only once: from then on the campaign belongs to your account and the old token stops working. Player tokens do not change.

### Email: limits and common problems

- The email service built into Supabase delivers **only to the addresses of members of your organization** and sends **at most 2 emails per hour** ([details](https://supabase.com/docs/guides/auth/rate-limits)). For a single DM (you) that is enough. For other DMs you need an email provider of your own (custom SMTP, under **Authentication → SMTP Settings**, e.g. Resend or Brevo on a free plan): the code does not change.
- *"The link has expired or was already used"*: some mail programs open links as a preview and use them up before you do. Ask for a new link and open it by pasting it into the browser; wait at least a minute between requests.
- *"Too many emails sent"*: you have reached the hourly limit; wait, or set up your own SMTP.

### Security in brief

- Tables have RLS enabled and no policies: with the public key nothing can be read or written directly. Everything goes through functions that check **who is calling**, the account (DM) or the token (player), and restrict access to their own campaign / sheet.
- The DM is a Supabase Auth account with an email; a campaign's only owner is whoever created it. Supabase anonymous sign-ins (should you ever enable them) are not treated as a DM.
- Player tokens are stored in plain text because the DM needs to be able to copy them again: they are readable only by the campaign's owner. Whoever has a sheet's token can edit it, so treat it like a password.
- Tokens carry 60 random bits: they cannot be guessed. There is deliberately no rate limit on attempts: a wait inside the database would keep a connection busy for every attempt and let anyone exhaust them with a few requests. That is adequate for a gaming table, not for sensitive data.
- The DM's session lives in the browser (`localStorage`) and renews itself. The page has a **Content-Security-Policy** that lets it load only its own files and talk only to itself and to `*.supabase.co`, so an injected script could not send the session elsewhere. If the project uses a custom Supabase domain, add it to `connect-src` in the `<meta>` tag of `index.html`. After signing in from the link, the refresh token that was in the address bar is replaced immediately, so it does not stay valid in the browser history.
- Players' invite links contain the token: the page never sends the Referer to other sites and removes the token from the address bar after sign-in. It does stay in the history of the browser where the link was opened; if in doubt, the DM can regenerate the token.
- Without a creation code (see above) anyone who is registered can create campaigns: they cannot see or touch other people's, but they use up your space. In any case the limit is 50 sheets per campaign and 128 KB per sheet (a real sheet takes up very little).
- If an account is deleted from Supabase, its campaigns remain (with no owner) and the players do not lose their sheet.
- Supabase's free plan pauses inactive projects after a few weeks: on the first visit you just need to resume it from the dashboard.

## Data and privacy

Without online collaboration your data stays only in the `localStorage` of the browser in use and is never sent anywhere else; with collaboration on, *campaign* sheets (and only those) are saved to your own Supabase project. To move a character to another device use **Export** and **Import** (JSON file). If the browser blocks storage, for example in some private modes, the sheet still works but does not save.

## Extending the sheet

- **New armor**: add an entry to `js/data/armors.js`; the selector updates by itself.
- **New feature or class**: edit `js/data/classes.js` and `js/data/classFeatures.js`.
- **New field**: add the default value in `characterSchema.js` and an input with `data-bind="path"` in `index.html`. If it needs validation, add a rule to `RULES`.
- **New calculated value**: add it to the object returned by `deriveStats()` and show it with `data-out="path"`.

## Legal notes

An unofficial fan project. *Dungeons & Dragons* is a trademark of Wizards of the Coast. The feature descriptions are short summaries meant as reminders: for the full text, refer to the Player's Handbook.
