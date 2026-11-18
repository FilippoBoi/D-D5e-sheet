import { test } from 'node:test';
import assert from 'node:assert/strict';

import { RemoteApi, RemoteError } from '../js/net/RemoteApi.js';
import { AuthService, buildInviteLink, normalizeToken, readTokenFromUrl, stripTokenFromUrl } from '../js/auth/AuthService.js';
import { CharacterSync } from '../js/sync/CharacterSync.js';
import { applicableChanges, deepEqual, deepMerge, diffDeep } from '../js/sync/diff.js';
import { isRemoteConfigured } from '../js/config.js';

// ------------------------------------------------------------------ helper

const PLAYER = 'PG-ABCD-EFGH-JKMN';
const ADMIN = 'ADM-ABCD-EFGH-JKMN';

/** Finto database: stessa semantica delle funzioni SQL (fusione in profondità, revisione). */
function fakeServer() {
  const calls = [];
  const state = { data: {}, revision: 0, updatedBy: '', validTokens: new Set([PLAYER, ADMIN]), offline: false };
  const rpc = async (fn, args) => {
    calls.push([fn, args]);
    if (state.offline) { const e = new RemoteError('network'); throw e; }
    const token = args.p_token;
    if (fn !== 'create_campaign' && !state.validTokens.has(token)) throw new RemoteError('invalid_token');
    const role = token === ADMIN ? 'admin' : 'player';
    if (fn === 'resolve_token') return [{ role, campaign_id: 'c1', campaign_name: 'Strahd', character_id: role === 'player' ? 'ch1' : null }];
    if (fn === 'create_campaign') return [{ campaign_id: 'c1', campaign_name: args.p_name, admin_token: ADMIN }];
    if (fn === 'get_character') return [{ id: 'ch1', data: structuredClone(state.data), revision: state.revision, updated_by: state.updatedBy }];
    if (fn === 'character_revision') return state.revision;
    if (fn === 'save_character') {
      state.data = deepMerge(state.data, args.p_changes);
      state.revision += 1;
      state.updatedBy = role;
      return [{ data: structuredClone(state.data), revision: state.revision, updated_by: role }];
    }
    throw new Error(`rpc non gestita: ${fn}`);
  };
  return { rpc, state, calls };
}

const memoryStorage = () => {
  const map = new Map();
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, String(v)) };
};

// --------------------------------------------------------------- RemoteApi

test('RemoteApi: chiama la funzione giusta con la chiave anon e restituisce il JSON', async () => {
  let seen;
  const api = new RemoteApi({ url: 'https://x.supabase.co/', anonKey: 'KEY' }, async (url, init) => {
    seen = { url, init };
    return { ok: true, status: 200, text: async () => '[{"a":1}]' };
  });
  assert.deepEqual(await api.rpc('get_character', { p_token: 'T' }), [{ a: 1 }]);
  assert.equal(seen.url, 'https://x.supabase.co/rest/v1/rpc/get_character');
  assert.equal(seen.init.headers.apikey, 'KEY');
  assert.deepEqual(JSON.parse(seen.init.body), { p_token: 'T' });
});

test('RemoteApi: errori del database → RemoteError con codice; rete assente → network', async () => {
  const failing = (status, body) => new RemoteApi({ url: 'https://x', anonKey: 'K' }, async () => ({ ok: false, status, text: async () => body }));
  await assert.rejects(failing(400, '{"message":"invalid_token"}').rpc('f'), (e) => e.code === 'invalid_token' && e.isAuthFailure);
  await assert.rejects(failing(400, '{"message":"limit_reached"}').rpc('f'), (e) => e.code === 'limit_reached' && !e.isAuthFailure);
  await assert.rejects(failing(500, 'boom').rpc('f'), (e) => e.code === 'unknown');
  const down = new RemoteApi({ url: 'https://x', anonKey: 'K' }, async () => { throw new TypeError('fetch failed'); });
  await assert.rejects(down.rpc('f'), (e) => e.code === 'network' && !e.isAuthFailure);
});

test('RemoteApi: corpo vuoto (funzioni void) → null', async () => {
  const api = new RemoteApi({ url: 'https://x', anonKey: 'K' }, async () => ({ ok: true, status: 204, text: async () => '' }));
  assert.equal(await api.rpc('delete_character'), null);
});

test('config: senza url/chiave il remoto è disattivato', () => {
  assert.equal(isRemoteConfigured({ url: '', anonKey: '' }), false);
  assert.equal(isRemoteConfigured({ url: 'https://x', anonKey: 'k' }), true);
});

// ------------------------------------------------------------------- Token

test('normalizeToken: accetta minuscole, spazi e link di invito; rifiuta il resto', () => {
  assert.equal(normalizeToken(' pg-abcd-efgh-jkmn '), PLAYER);
  assert.equal(normalizeToken('PG ABCD EFGH JKMN'.replace(/ /g, '-')), PLAYER);
  assert.equal(normalizeToken(`https://site.example/sheet/?t=${PLAYER}#x`), PLAYER);
  assert.equal(normalizeToken('PG-ABCD-EFGH-JKM'), null, 'troppo corto');
  assert.equal(normalizeToken('PG-ABCD-EFGH-JKM0'), null, 'carattere ambiguo (0)');
  assert.equal(normalizeToken('XX-ABCD-EFGH-JKMN'), null, 'prefisso sconosciuto');
  assert.equal(normalizeToken(null), null);
});

test('URL: legge il token da ?t= e lo toglie dall\'indirizzo', () => {
  assert.equal(readTokenFromUrl(`https://s.io/app/?t=${PLAYER}`), PLAYER);
  assert.equal(readTokenFromUrl('https://s.io/app/?t=nope'), null);
  assert.equal(readTokenFromUrl('https://s.io/app/'), null);
  assert.equal(stripTokenFromUrl(`https://s.io/app/?t=${PLAYER}&x=1#a`), '/app/?x=1#a');
  assert.equal(buildInviteLink('https://s.io/app/?old=1#h', PLAYER), `https://s.io/app/?t=${PLAYER}`);
});

// ------------------------------------------------------------- AuthService

test('AuthService: login, persistenza tra ricaricamenti e logout', async () => {
  const { rpc } = fakeServer();
  const storage = memoryStorage();
  const auth = new AuthService({ rpc }, storage);
  assert.equal(auth.active, null);

  const session = await auth.login(PLAYER.toLowerCase());
  assert.deepEqual([session.role, session.characterId, session.campaignName], ['player', 'ch1', 'Strahd']);

  const reloaded = new AuthService({ rpc }, storage);
  assert.equal(reloaded.active?.token, PLAYER);

  reloaded.logout();
  assert.equal(reloaded.active, null);
  assert.equal(new AuthService({ rpc }, storage).active, null);
});

test('AuthService: token non valido → errore; più campagne admin e cambio attiva', async () => {
  const { rpc, state } = fakeServer();
  const auth = new AuthService({ rpc }, memoryStorage());
  await assert.rejects(auth.login('garbage'), (e) => e.code === 'invalid_token');
  state.validTokens.clear();
  await assert.rejects(auth.login(PLAYER), (e) => e.code === 'invalid_token');

  state.validTokens.add(ADMIN);
  state.validTokens.add(PLAYER);
  await auth.createCampaign('Strahd');
  await auth.login(PLAYER);
  assert.equal(auth.active.role, 'player');
  assert.equal(auth.adminSessions.length, 1);
  auth.switchTo(ADMIN);
  assert.equal(auth.active.role, 'admin');
  auth.updateCampaignName(ADMIN, 'Nuovo nome');
  assert.equal(auth.active.campaignName, 'Nuovo nome');
});

test('AuthService: sessioni corrotte nello storage vengono scartate', () => {
  const storage = memoryStorage();
  storage.setItem('dnd5e-character-sheet:sessions', JSON.stringify({ sessions: [{ token: 'x', role: 'admin' }, { token: PLAYER, role: 'player' }], active: PLAYER }));
  const auth = new AuthService({ rpc: async () => [] }, storage);
  assert.equal(auth.active?.token, PLAYER);
  assert.equal(auth.adminSessions.length, 0);
  const broken = memoryStorage();
  broken.setItem('dnd5e-character-sheet:sessions', '{not json');
  assert.equal(new AuthService({ rpc: async () => [] }, broken).active, null);
});

// -------------------------------------------------------------------- diff

test('diff: deepEqual ignora l\'ordine delle chiavi', () => {
  assert.equal(deepEqual({ a: 1, b: [1, { c: 2 }] }, { b: [1, { c: 2 }], a: 1 }), true);
  assert.equal(deepEqual({ a: [1] }, { a: { 0: 1 } }), false);
  assert.equal(deepEqual(null, {}), false);
});

test('diffDeep: restituisce solo le foglie cambiate, con la forma del documento', () => {
  const base = { combat: { hp: 10, speed: 9 }, weapons: [{ name: 'A' }], notes: { traits: 'x' } };
  assert.equal(diffDeep(base, structuredClone(base)), undefined);
  assert.deepEqual(diffDeep(base, { ...base, combat: { hp: 3, speed: 9 } }), { combat: { hp: 3 } });
  assert.deepEqual(diffDeep(base, { ...base, weapons: [{ name: 'A' }, { name: 'B' }] }), { weapons: [{ name: 'A' }, { name: 'B' }] }, 'gli array si scambiano interi');
  assert.deepEqual(diffDeep({}, { a: { b: 1 } }), { a: { b: 1 } }, 'documento nuovo: tutto');
  assert.deepEqual(diffDeep({ a: 1 }, { a: { b: 1 } }), { a: { b: 1 } }, 'da foglia a oggetto');
});

test('deepMerge: gli oggetti si fondono, array e valori si sostituiscono, l\'input non cambia', () => {
  const target = { combat: { hp: 3, speed: 9 }, w: [1, 2], n: { a: 1 } };
  const merged = deepMerge(target, { combat: { speed: 12 }, w: [9], n: null, x: { y: 1 } });
  assert.deepEqual(merged, { combat: { hp: 3, speed: 12 }, w: [9], n: null, x: { y: 1 } });
  assert.deepEqual(target, { combat: { hp: 3, speed: 9 }, w: [1, 2], n: { a: 1 } });
  assert.deepEqual(deepMerge({ a: { b: 1 } }, {}), { a: { b: 1 } });
});

test('applicableChanges: scarta le foglie uguali o toccate anche in locale', () => {
  const base = { combat: { hp: 10, speed: 9 } };
  const remote = { combat: { hp: 3, speed: 12 } };
  assert.deepEqual(applicableChanges(remote, { combat: { hp: 10, speed: 9 } }, base), remote);
  assert.deepEqual(applicableChanges(remote, { combat: { hp: 10, speed: 15 } }, base), { combat: { hp: 3 } }, 'la velocità locale vince');
  assert.equal(applicableChanges(remote, { combat: { hp: 3, speed: 12 } }, base), undefined, 'già uguale');
});

// ----------------------------------------------------------- CharacterSync

/** Crea una "postazione" (browser) collegata al finto server, con il suo stato locale. */
function client(server, token = PLAYER, characterId = null) {
  const local = { doc: {} };
  const sync = new CharacterSync({ api: { rpc: server.rpc }, token, characterId, getLocal: () => structuredClone(local.doc), pollMs: 10 });
  const received = [];
  sync.on('remote', (e) => { received.push(e); Object.assign(local.doc, structuredClone(e.changes)); });
  return { sync, local, received };
}

test('sync: dopo il caricamento non rispedisce ciò che il server già ha', async () => {
  const server = fakeServer();
  server.state.data = { info: { name: 'Mario' }, hp: { cur: 5 } };
  const c = client(server);
  const { data } = await c.sync.load();
  c.local.doc = structuredClone(data);
  c.sync.markSynced(c.local.doc);
  assert.deepEqual(await c.sync.push(), { pushed: false });
  assert.equal(server.calls.filter(([fn]) => fn === 'save_character').length, 0);
});

test('sync: invia solo i campi modificati', async () => {
  const server = fakeServer();
  server.state.data = { info: { name: 'Mario' }, hp: { cur: 5 }, weapons: [] };
  const c = client(server);
  c.local.doc = structuredClone((await c.sync.load()).data);
  c.sync.markSynced(c.local.doc);

  c.local.doc.hp = { cur: 9 };
  assert.deepEqual(await c.sync.push(), { pushed: true });
  const save = server.calls.find(([fn]) => fn === 'save_character');
  assert.deepEqual(save[1].p_changes, { hp: { cur: 9 } }, 'solo il campo cambiato, non l\'intera sezione');
  assert.equal(server.state.updatedBy, 'player');
  assert.deepEqual(await c.sync.push(), { pushed: false }, 'secondo invio: niente da mandare');
  assert.equal(c.received.length, 0, 'le proprie modifiche non tornano indietro come "remote"');
});

test('sync: due persone su campi diversi si ritrovano entrambe le modifiche', async () => {
  const server = fakeServer();
  server.state.data = { info: { name: 'Mario' }, hp: { cur: 5 } };
  const player = client(server, PLAYER);
  const admin = client(server, ADMIN, 'ch1');
  for (const c of [player, admin]) {
    c.local.doc = structuredClone((await c.sync.load()).data);
    c.sync.markSynced(c.local.doc);
  }

  admin.local.doc.hp = { cur: 1 };          // il DM danneggia
  player.local.doc.info = { name: 'Mario II' }; // il giocatore rinomina
  await admin.sync.push();
  await player.sync.push();                  // il server risponde già con l'hp dell'admin

  assert.deepEqual(player.received.at(-1).changes, { hp: { cur: 1 } });
  assert.equal(player.received.at(-1).updatedBy, 'player', 'chi ha scritto per ultimo, come riportato dal server');
  await admin.sync.pull();
  assert.deepEqual(admin.received.at(-1).changes, { info: { name: 'Mario II' } });
  assert.deepEqual(server.state.data, { info: { name: 'Mario II' }, hp: { cur: 1 } });
  assert.deepEqual(player.local.doc, server.state.data);
  assert.deepEqual(admin.local.doc, server.state.data);
});

test('sync: REGRESSIONE — il Master toglie PF mentre il giocatore cambia la velocità nella stessa sezione', async () => {
  const server = fakeServer();
  server.state.data = { combat: { hpCurrent: 10, hpMax: 10, speed: 9 } };
  const dm = client(server, ADMIN, 'ch1');
  const player = client(server, PLAYER);
  for (const c of [dm, player]) {
    c.local.doc = structuredClone((await c.sync.load()).data);
    c.sync.markSynced(c.local.doc);
  }
  dm.local.doc.combat.hpCurrent = 3;      // Master: 10 → 3 PF
  await dm.sync.push();
  player.local.doc.combat.speed = 12;     // giocatore, prima che il polling lo aggiorni
  await player.sync.push();

  assert.deepEqual(server.state.data.combat, { hpCurrent: 3, hpMax: 10, speed: 12 }, 'nessuno dei due perde la modifica');
  assert.equal(player.local.doc.combat.hpCurrent, 3, 'il giocatore ora vede i PF del Master');
  await dm.sync.pull();
  assert.equal(dm.local.doc.combat.speed, 12, 'il Master vede la velocità');
});

test('sync: il polling chiede solo la revisione finché non cambia nulla', async () => {
  const server = fakeServer();
  server.state.data = { hp: { cur: 5 } };
  const c = client(server);
  c.local.doc = structuredClone((await c.sync.load()).data);
  c.sync.markSynced(c.local.doc);
  server.calls.length = 0;
  await c.sync.tick(); await c.sync.tick(); await c.sync.tick();
  assert.deepEqual([...new Set(server.calls.map(([fn]) => fn))], ['character_revision'], 'nessun download della scheda');
  server.state.data = { hp: { cur: 1 } }; server.state.revision += 1;   // cambia qualcuno
  await c.sync.tick();
  assert.ok(server.calls.some(([fn]) => fn === 'get_character'), 'ora scarica');
  assert.equal(c.local.doc.hp.cur, 1);
});

test('sync: se lo stesso campo è stato toccato anche qui, la modifica locale non viene sovrascritta', async () => {
  const server = fakeServer();
  server.state.data = { hp: { cur: 5 } };
  const player = client(server, PLAYER);
  const admin = client(server, ADMIN, 'ch1');
  for (const c of [player, admin]) {
    c.local.doc = structuredClone((await c.sync.load()).data);
    c.sync.markSynced(c.local.doc);
  }
  admin.local.doc.hp = { cur: 1 };
  await admin.sync.push();

  player.local.doc.hp = { cur: 7 };          // modifica locale non ancora inviata
  await player.sync.pull();
  assert.equal(player.received.length, 0, 'il mio campo modificato non viene sostituito');
  assert.deepEqual(player.local.doc.hp, { cur: 7 });
  await player.sync.push();                  // poi invio: vince l'ultimo
  assert.deepEqual(server.state.data.hp, { cur: 7 });
});

test('sync: errore di rete → stato offline, poi riprova da sola e torna online', async () => {
  const server = fakeServer();
  const c = client(server);
  c.local.doc = structuredClone((await c.sync.load()).data);
  c.sync.markSynced(c.local.doc);
  const states = [];
  c.sync.on('state', (s) => states.push(s));

  server.state.offline = true;
  c.local.doc.info = { name: 'Mario' };
  assert.deepEqual(await c.sync.push(), { pushed: false });
  assert.equal(c.sync.state, 'offline');

  server.state.offline = false;
  await c.sync.tick();                        // il ciclo rimanda ciò che era rimasto indietro
  assert.deepEqual(server.state.data.info, { name: 'Mario' });
  assert.deepEqual(states, ['offline', 'online']);
});

test('sync: token revocato → stato revoked e il polling si ferma da solo', async () => {
  const server = fakeServer();
  const c = client(server);
  c.local.doc = structuredClone((await c.sync.load()).data);
  c.sync.markSynced(c.local.doc);
  const states = [];
  c.sync.on('state', (s) => states.push(s));

  c.sync.start();                            // polling ogni 10 ms
  await new Promise((r) => setTimeout(r, 25));
  server.state.validTokens.delete(PLAYER);   // l'admin ha ruotato il token
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(c.sync.state, 'revoked');
  assert.deepEqual(states, ['revoked']);

  const settled = server.calls.length;
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(server.calls.length, settled, 'nessuna richiesta dopo la revoca');
  c.sync.stop();
});

test('sync: le operazioni sono serializzate (nessun invio in parallelo)', async () => {
  const server = fakeServer();
  let active = 0, maxActive = 0;
  const slow = async (fn, args) => {
    active += 1; maxActive = Math.max(maxActive, active);
    await new Promise((r) => setTimeout(r, 5));
    try { return await server.rpc(fn, args); } finally { active -= 1; }
  };
  const doc = { hp: { cur: 1 } };
  const sync = new CharacterSync({ api: { rpc: slow }, token: PLAYER, getLocal: () => structuredClone(doc) });
  await sync.load();
  sync.markSynced({});
  await Promise.all([sync.push(), sync.pull(), sync.tick(), sync.push()]);
  assert.equal(maxActive, 1);
});

test('AuthService: ricorda l\'ultima scheda aperta dall\'admin, per campagna, e la dimentica al logout', async () => {
  const { rpc } = fakeServer();
  const storage = memoryStorage();
  const auth = new AuthService({ rpc }, storage);
  await auth.createCampaign('Strahd');
  assert.equal(auth.lastOpened, null);
  auth.rememberOpened({ id: 'ch1', label: 'Mario' });
  assert.deepEqual(auth.lastOpened, { id: 'ch1', label: 'Mario' });

  const reloaded = new AuthService({ rpc }, storage);
  assert.deepEqual(reloaded.lastOpened, { id: 'ch1', label: 'Mario' }, 'sopravvive al ricaricamento');
  reloaded.rememberOpened(null);
  assert.equal(reloaded.lastOpened, null);

  reloaded.rememberOpened({ id: 'ch2', label: 'Lia' });
  reloaded.logout();
  assert.equal(new AuthService({ rpc }, storage).lastOpened, null, 'logout: niente resta');
  // voci orfane (campagna dimenticata) nello storage vengono scartate
  storage.setItem('dnd5e-character-sheet:sessions', JSON.stringify({ sessions: [], active: null, lastOpened: { [ADMIN]: { id: 'x', label: 'y' } } }));
  assert.equal(new AuthService({ rpc }, storage).lastOpened, null);
});
