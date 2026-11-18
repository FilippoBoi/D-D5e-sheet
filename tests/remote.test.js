import { test } from 'node:test';
import assert from 'node:assert/strict';

import { RemoteApi, RemoteError } from '../js/net/RemoteApi.js';
import { AuthService, buildInviteLink, normalizeToken, readTokenFromUrl, stripTokenFromUrl } from '../js/auth/AuthService.js';
import { AccountError, AccountService, decodeJwt, siteUrl, stripHash } from '../js/auth/AccountService.js';
import { CharacterSync } from '../js/sync/CharacterSync.js';
import { applicableChanges, deepEqual, deepMerge, diffDeep } from '../js/sync/diff.js';
import { isRemoteConfigured } from '../js/config.js';

// ------------------------------------------------------------------ helper

const PLAYER = 'PG-ABCD-EFGH-JKMN';
const LEGACY = 'ADM-ABCD-EFGH-JKMN'; // vecchio token admin: non è più un login, si può solo rivendicare

/**
 * Finto database: stessa semantica delle funzioni SQL (fusione in profondità, revisione).
 * Il Master non ha token: chi chiama con `p_token` nullo è l'account loggato (`state.signedIn`).
 */
function fakeServer() {
  const calls = [];
  const state = {
    data: {}, revision: 0, updatedBy: '', validTokens: new Set([PLAYER]), offline: false, creationCode: null,
    signedIn: true, campaigns: [], legacyClaimable: true,
  };
  const needAccount = () => { if (!state.signedIn) throw new RemoteError('auth_required'); };
  const rpc = async (fn, args = {}) => {
    calls.push([fn, args]);
    if (state.offline) throw new RemoteError('network');
    const token = args.p_token ?? null;
    const master = token === null;

    if (fn === 'creation_requires_code') return state.creationCode !== null;
    if (fn === 'resolve_token') {
      if (token === LEGACY && state.legacyClaimable) throw new RemoteError('legacy_admin_token');
      if (!state.validTokens.has(token)) throw new RemoteError('invalid_token');
      return [{ role: 'player', campaign_id: 'c1', campaign_name: 'Strahd', character_id: 'ch1' }];
    }
    if (fn === 'create_campaign') {
      needAccount();
      if (state.creationCode !== null && args.p_code !== state.creationCode) throw new RemoteError('invalid_code');
      const row = { campaign_id: `c${state.campaigns.length + 2}`, campaign_name: args.p_name };
      state.campaigns.push(row);
      return [row];
    }
    if (fn === 'claim_campaign') {
      needAccount();
      if (args.p_admin_token !== LEGACY || !state.legacyClaimable) throw new RemoteError('invalid_token');
      state.legacyClaimable = false;
      const row = { campaign_id: 'c-legacy', campaign_name: 'Campagna vecchia' };
      state.campaigns.push(row);
      return [row];
    }
    if (fn === 'list_campaigns') {
      needAccount();
      return state.campaigns.map((c) => ({ ...c, character_count: 0 }));
    }

    // scheda: Master (account) o giocatore (token)
    let role = 'player';
    if (master) { needAccount(); role = 'admin'; } else if (!state.validTokens.has(token)) throw new RemoteError('invalid_token');
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
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, String(v)), removeItem: (k) => map.delete(k) };
};

/** JWT finto: header.payload.firma, con i campi che il client legge. */
const makeJwt = ({ sub = 'user-1', email = 'master@example.com', exp = Math.floor(Date.now() / 1000) + 3600 } = {}) => {
  const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub, email, exp })}.firma`;
};

/** Account finto per AuthService: stesso contratto di AccountService, senza rete. */
function fakeAccount({ signedIn = false, email = 'master@example.com' } = {}) {
  const account = {
    isSignedIn: signedIn, email: signedIn ? email : '', signOuts: 0, links: [],
    async requestLink(e, redirectTo) { account.links.push([e, redirectTo]); },
    consumeUrlHash(hash) {
      if (hash === '#ok') { account.isSignedIn = true; account.email = email; return { status: 'signedIn' }; }
      return { status: 'none' };
    },
    async signOut() { account.signOuts += 1; account.isSignedIn = false; account.email = ''; },
  };
  return account;
}

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
  await assert.rejects(failing(400, '{"message":"invalid_code"}').rpc('f'), (e) => e.code === 'invalid_code' && !e.isAuthFailure);
  await assert.rejects(failing(400, '{"message":"limit_reached"}').rpc('f'), (e) => e.code === 'limit_reached' && !e.isAuthFailure);
  await assert.rejects(failing(500, 'boom').rpc('f'), (e) => e.code === 'unknown');
  const down = new RemoteApi({ url: 'https://x', anonKey: 'K' }, async () => { throw new TypeError('fetch failed'); });
  await assert.rejects(down.rpc('f'), (e) => e.code === 'network' && !e.isAuthFailure);
});

test('RemoteApi: corpo vuoto (funzioni void) → null', async () => {
  const api = new RemoteApi({ url: 'https://x', anonKey: 'K' }, async () => ({ ok: true, status: 204, text: async () => '' }));
  assert.equal(await api.rpc('delete_character'), null);
});

test('RemoteApi: con il Master loggato manda il JWT; senza, solo la chiave pubblica', async () => {
  const seen = [];
  const fetchImpl = async (url, init) => { seen.push(init.headers); return { ok: true, status: 200, text: async () => '[]' }; };
  await new RemoteApi({ url: 'https://x', anonKey: 'K', getAccessToken: async () => 'JWT-1' }, fetchImpl).rpc('list_campaigns');
  await new RemoteApi({ url: 'https://x', anonKey: 'K', getAccessToken: async () => null }, fetchImpl).rpc('get_character');
  await new RemoteApi({ url: 'https://x', anonKey: 'K' }, fetchImpl).rpc('get_character');
  assert.equal(seen[0].Authorization, 'Bearer JWT-1');
  assert.equal(seen[0].apikey, 'K');
  assert.equal(seen[1].Authorization, undefined);
  assert.equal(seen[2].Authorization, undefined);
});

test('RemoteApi: login scaduto (401) → rinnova il JWT e riprova una sola volta', async () => {
  const attempts = [];
  const fetchImpl = async (url, init) => {
    attempts.push(init.headers.Authorization);
    return init.headers.Authorization === 'Bearer vecchio'
      ? { ok: false, status: 401, text: async () => '{"code":"PGRST303","message":"JWT expired"}' }
      : { ok: true, status: 200, text: async () => '[{"ok":1}]' };
  };
  const forced = [];
  const api = new RemoteApi({ url: 'https://x', anonKey: 'K', getAccessToken: async ({ force } = {}) => { forced.push(Boolean(force)); return force ? 'nuovo' : 'vecchio'; } }, fetchImpl);
  assert.deepEqual(await api.rpc('list_campaigns'), [{ ok: 1 }]);
  assert.deepEqual(attempts, ['Bearer vecchio', 'Bearer nuovo']);
  assert.deepEqual(forced, [false, true]);

  // se il rinnovo non cambia nulla, non si riprova all'infinito
  let stuckAttempts = 0;
  const stuck = new RemoteApi({ url: 'https://x', anonKey: 'K', getAccessToken: async () => 'vecchio' },
    async () => { stuckAttempts += 1; return { ok: false, status: 401, text: async () => '{"code":"PGRST303","message":"JWT expired"}' }; });
  await assert.rejects(stuck.rpc('list_campaigns'), (e) => e.code === 'auth_required' && e.isAuthFailure);
  assert.equal(stuckAttempts, 1, 'se il rinnovo non cambia il token, non si rimanda la stessa richiesta');
});

test('RemoteApi: funzione riservata agli account (42501) e codici del Master', async () => {
  const failing = (status, body) => new RemoteApi({ url: 'https://x', anonKey: 'K' }, async () => ({ ok: false, status, text: async () => body }));
  await assert.rejects(failing(401, '{"code":"42501","message":"permission denied for function create_campaign"}').rpc('f'), (e) => e.code === 'auth_required');
  await assert.rejects(failing(400, '{"message":"legacy_admin_token"}').rpc('f'), (e) => e.code === 'legacy_admin_token' && !e.isAuthFailure);
  await assert.rejects(failing(400, '{"message":"auth_required"}').rpc('f'), (e) => e.code === 'auth_required');
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

const SESSIONS_KEY = 'dnd5e-character-sheet:sessions';

test('AuthService (giocatore): login, persistenza tra ricaricamenti e logout', async () => {
  const { rpc } = fakeServer();
  const storage = memoryStorage();
  const auth = new AuthService({ rpc }, storage, fakeAccount());
  assert.equal(auth.active, null);

  const session = await auth.login(PLAYER.toLowerCase());
  assert.deepEqual([session.role, session.characterId, session.campaignName, session.token], ['player', 'ch1', 'Strahd', PLAYER]);

  const reloaded = new AuthService({ rpc }, storage, fakeAccount());
  assert.equal(reloaded.active?.token, PLAYER);
  reloaded.logout();
  assert.equal(reloaded.active, null);
  assert.equal(new AuthService({ rpc }, storage, fakeAccount()).active, null);
});

test('AuthService (giocatore): token sbagliato → errore; il vecchio token admin non è un login', async () => {
  const { rpc, state } = fakeServer();
  const auth = new AuthService({ rpc }, memoryStorage(), fakeAccount());
  await assert.rejects(auth.login('garbage'), (e) => e.code === 'invalid_token');
  await assert.rejects(auth.login('PG-AAAA-AAAA-AAAA'), (e) => e.code === 'invalid_token');
  await assert.rejects(auth.login(LEGACY), (e) => e.code === 'legacy_admin_token', 'va rivendicato, non usato per entrare');
  assert.equal(auth.active, null);
  state.legacyClaimable = false;
  await assert.rejects(auth.login(LEGACY), (e) => e.code === 'invalid_token', 'dopo il claim non esiste più');
});

test('AuthService (Master): campagne, creazione con codice, selezione', async () => {
  const { rpc, state } = fakeServer();
  const auth = new AuthService({ rpc }, memoryStorage(), fakeAccount({ signedIn: true }));

  assert.deepEqual(auth.active, { role: 'admin', token: null, campaignId: null, campaignName: '', characterId: null }, 'Master senza campagne');
  assert.equal(auth.isMaster, true);
  assert.equal(auth.email, 'master@example.com');
  assert.deepEqual(await auth.refreshCampaigns(), []);

  assert.equal(await auth.creationRequiresCode(), false);
  const first = await auth.createCampaign('Strahd');
  assert.deepEqual([first.role, first.campaignName, first.token], ['admin', 'Strahd', null]);

  state.creationCode = 'la-mia-frase';
  assert.equal(await auth.creationRequiresCode(), true);
  await assert.rejects(auth.createCampaign('Intrusa'), (e) => e.code === 'invalid_code');
  await assert.rejects(auth.createCampaign('Intrusa', 'sbagliato'), (e) => e.code === 'invalid_code');
  assert.equal(auth.campaigns.length, 1, 'i rifiutati non creano nulla');
  const second = await auth.createCampaign('Altra', '  la-mia-frase ');
  assert.equal(second.campaignName, 'Altra');
  assert.equal(auth.campaigns.length, 2);

  auth.selectCampaign(first.campaignId);
  assert.equal(auth.active.campaignName, 'Strahd');
  auth.selectCampaign('non-mia');
  assert.equal(auth.active.campaignName, 'Strahd', 'una campagna sconosciuta non si seleziona');
  auth.updateCampaignName(first.campaignId, 'Nuovo nome');
  assert.equal(auth.active.campaignName, 'Nuovo nome');
  assert.equal(await new AuthService({ rpc: async () => { throw new RemoteError('network'); } }, memoryStorage(), fakeAccount()).creationRequiresCode(), false);
});

test('AuthService (Master): rivendicare una campagna della versione precedente, una volta sola', async () => {
  const { rpc } = fakeServer();
  const auth = new AuthService({ rpc }, memoryStorage(), fakeAccount({ signedIn: true }));
  await assert.rejects(auth.claimCampaign('rubbish'), (e) => e.code === 'invalid_token');
  await assert.rejects(auth.claimCampaign('PG-AAAA-AAAA-AAAA'), (e) => e.code === 'invalid_token');
  const session = await auth.claimCampaign(` ${LEGACY.toLowerCase()} `);
  assert.deepEqual([session.campaignId, session.campaignName], ['c-legacy', 'Campagna vecchia']);
  assert.equal(auth.campaigns.length, 1);
  await assert.rejects(auth.claimCampaign(LEGACY), (e) => e.code === 'invalid_token', 'una volta sola');
});

test('AuthService: ricarica la pagina → il Master ritrova campagna e ultima scheda; il logout chiude l\'account', async () => {
  const { rpc } = fakeServer();
  const storage = memoryStorage();
  const account = fakeAccount({ signedIn: true });
  const auth = new AuthService({ rpc }, storage, account);
  const mine = await auth.createCampaign('Strahd');
  await auth.createCampaign('Altra');
  auth.selectCampaign(mine.campaignId);
  assert.equal(auth.lastOpened, null);
  auth.rememberOpened({ id: 'ch1', label: 'Mario' });

  const reloaded = new AuthService({ rpc }, storage, account);
  await reloaded.refreshCampaigns();
  assert.equal(reloaded.active.campaignId, mine.campaignId, 'stessa campagna dopo il ricaricamento');
  assert.deepEqual(reloaded.lastOpened, { id: 'ch1', label: 'Mario' });
  reloaded.selectCampaign(reloaded.campaigns.find((c) => c.name === 'Altra').id);
  assert.equal(reloaded.lastOpened, null, 'l\'ultima scheda è per campagna');
  reloaded.rememberOpened({ id: 'x', label: 'y' });
  reloaded.rememberOpened(null);
  assert.equal(reloaded.lastOpened, null);

  reloaded.logout();
  assert.equal(account.signOuts, 1, 'il Master esce dall\'account');
  assert.equal(reloaded.active, null);
  assert.deepEqual(reloaded.campaigns, []);
  assert.equal(new AuthService({ rpc }, storage, account).lastOpened, null, 'logout: nulla resta');
});

test('AuthService (Master): se la campagna selezionata non esiste più si passa a un\'altra (o a nessuna)', async () => {
  const { rpc, state } = fakeServer();
  const auth = new AuthService({ rpc }, memoryStorage(), fakeAccount({ signedIn: true }));
  await auth.createCampaign('Prima');
  const second = await auth.createCampaign('Seconda');
  assert.equal(auth.active.campaignId, second.campaignId);

  state.campaigns = state.campaigns.filter((c) => c.campaign_id !== second.campaignId);   // eliminata altrove
  await auth.refreshCampaigns();
  assert.equal(auth.active.campaignName, 'Prima');
  state.campaigns = [];
  await auth.refreshCampaigns();
  assert.deepEqual([auth.active.role, auth.active.campaignId], ['admin', null], 'nessuna campagna: resta Master, senza selezione');
});

test('AuthService: un Master che apre il link di un giocatore ci lavora, e uscendo torna Master', async () => {
  const { rpc } = fakeServer();
  const account = fakeAccount({ signedIn: true });
  const auth = new AuthService({ rpc }, memoryStorage(), account);
  const mine = await auth.createCampaign('Strahd');

  assert.equal((await auth.login(PLAYER)).role, 'player');
  assert.equal(auth.active.role, 'player');
  auth.logout();                                   // esce dal giocatore, NON dall'account
  assert.equal(account.signOuts, 0);
  assert.deepEqual([auth.active.role, auth.active.campaignId], ['admin', mine.campaignId]);
});

test('AuthService: link di accesso e ritorno dall\'email', async () => {
  const { rpc } = fakeServer();
  const account = fakeAccount();
  const auth = new AuthService({ rpc }, memoryStorage(), account);
  await auth.requestLink('master@example.com', 'https://s.io/app/');
  assert.deepEqual(account.links, [['master@example.com', 'https://s.io/app/']]);

  await auth.login(PLAYER);
  assert.equal(auth.active.role, 'player');
  assert.deepEqual(auth.completeSignInFromUrl('#niente'), { status: 'none' });
  assert.equal(auth.active.role, 'player');
  assert.deepEqual(auth.completeSignInFromUrl('#ok'), { status: 'signedIn' });
  assert.equal(auth.active.role, 'admin', 'chi arriva dal link dell\'email lavora da Master');
});

test('AuthService: sessioni corrotte o del formato precedente', async () => {
  const { rpc } = fakeServer();
  const storage = memoryStorage();
  // formato precedente: i giocatori si mantengono, i token admin (non più validi come login) si scartano
  storage.setItem(SESSIONS_KEY, JSON.stringify({
    sessions: [
      { token: 'x', role: 'admin' },
      { token: LEGACY, role: 'admin', campaignId: 'c', campaignName: 'v', characterId: null },
      { token: PLAYER, role: 'player', campaignId: 'c1', campaignName: 'Strahd', characterId: 'ch1' },
    ],
    active: PLAYER,
  }));
  const auth = new AuthService({ rpc }, storage, fakeAccount());
  assert.equal(auth.active?.token, PLAYER);
  assert.equal(auth.active?.characterId, 'ch1');

  const broken = memoryStorage();
  broken.setItem(SESSIONS_KEY, '{not json');
  assert.equal(new AuthService({ rpc }, broken, fakeAccount()).active, null);
  const odd = memoryStorage();
  odd.setItem(SESSIONS_KEY, JSON.stringify({ players: [{ token: 'PG-AAAA-AAAA-AAAA' }, 5, null], campaignId: 7, lastOpened: { c: { id: 3 } } }));
  assert.equal(new AuthService({ rpc }, odd, fakeAccount()).active, null);
});

// ---------------------------------------------------------- AccountService

/** Server di login finto: registra le richieste e risponde come GoTrue. */
function fakeAuthServer() {
  const log = [];
  const state = { otp: { status: 200, body: {} }, refresh: null, refreshCalls: 0, network: false };
  const fetchImpl = async (url, init = {}) => {
    if (state.network) throw new TypeError('fetch failed');
    const u = new URL(url);
    const body = init.body ? JSON.parse(init.body) : null;
    log.push({ path: u.pathname, search: u.search, body, headers: init.headers });
    const reply = (status, payload) => ({ ok: status < 400, status, text: async () => (payload === undefined ? '' : JSON.stringify(payload)) });
    if (u.pathname === '/auth/v1/otp') return reply(state.otp.status, state.otp.body);
    if (u.pathname === '/auth/v1/token') {
      state.refreshCalls += 1;
      await new Promise((r) => setTimeout(r, 5));
      return state.refresh ? reply(200, state.refresh(body)) : reply(400, { error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' });
    }
    if (u.pathname === '/auth/v1/logout') return reply(204);
    return reply(404, {});
  };
  return { fetchImpl, state, log };
}

const CONFIG = { url: 'https://x.supabase.co/', anonKey: 'KEY' };

test('JWT e indirizzi: lettura del contenuto, indirizzo di ritorno senza parametri', () => {
  assert.deepEqual(decodeJwt(makeJwt({ sub: 'u', email: 'a@b.it', exp: 5 })), { sub: 'u', email: 'a@b.it', exp: 5 });
  assert.equal(decodeJwt('rubbish'), null);
  assert.equal(decodeJwt(null), null);
  assert.equal(siteUrl('https://u.github.io/D-D5e-sheet/?t=PG-X#access_token=1'), 'https://u.github.io/D-D5e-sheet/');
  assert.equal(stripHash('https://u.github.io/app/?x=1#access_token=1'), '/app/?x=1');
});

test('AccountService: il link di accesso parte con l\'email e l\'indirizzo di ritorno', async () => {
  const { fetchImpl, log } = fakeAuthServer();
  const account = new AccountService(CONFIG, memoryStorage(), { fetchImpl });
  await account.requestLink('  master@example.com ', 'https://u.github.io/app/');
  assert.equal(log[0].path, '/auth/v1/otp');
  assert.equal(new URLSearchParams(log[0].search).get('redirect_to'), 'https://u.github.io/app/');
  assert.deepEqual(log[0].body, { email: 'master@example.com', create_user: true });
  assert.equal(log[0].headers.apikey, 'KEY');
  assert.equal(log[0].headers.Authorization, undefined, 'senza sessione, solo la chiave pubblica');
  await assert.rejects(account.requestLink('non-una-email', 'x'), (e) => e instanceof AccountError && e.code === 'email_invalid');
  assert.equal(log.length, 1, 'un\'email non valida non arriva al server');
});

test('AccountService: errori di Supabase tradotti in codici stabili', async () => {
  const { fetchImpl, state } = fakeAuthServer();
  const account = new AccountService(CONFIG, memoryStorage(), { fetchImpl });
  const code = async () => account.requestLink('a@b.it', 'x').then(() => 'ok', (e) => e.code);
  state.otp = { status: 429, body: { code: 429, error_code: 'over_email_send_rate_limit', msg: 'rate limit' } };
  assert.equal(await code(), 'email_rate_limit');
  state.otp = { status: 429, body: {} };
  assert.equal(await code(), 'email_rate_limit', '429 generico');
  state.otp = { status: 400, body: { code: 400, error_code: 'email_address_not_authorized', msg: 'x' } };
  assert.equal(await code(), 'email_not_authorized');
  state.otp = { status: 422, body: { error_code: 'signup_disabled' } };
  assert.equal(await code(), 'signup_disabled');
  state.otp = { status: 500, body: {} };
  assert.equal(await code(), 'unknown');
  state.network = true;
  assert.equal(await code(), 'network');
});

test('AccountService: il ritorno dall\'email salva la sessione; al ricaricamento si resta collegati', () => {
  const storage = memoryStorage();
  const account = new AccountService(CONFIG, storage, { fetchImpl: async () => { throw new Error('nessuna rete'); } });
  assert.equal(account.isSignedIn, false);
  assert.deepEqual(account.consumeUrlHash(''), { status: 'none' });
  assert.deepEqual(account.consumeUrlHash('#foo=bar'), { status: 'none' });
  assert.deepEqual(account.consumeUrlHash('#access_token=solo'), { status: 'none' }, 'serve anche il refresh token');
  assert.deepEqual(account.consumeUrlHash('#access_token=rotto&refresh_token=r'), { status: 'error', code: 'unknown' });

  const jwt = makeJwt({ sub: 'u-42', email: 'master@example.com' });
  assert.deepEqual(account.consumeUrlHash(`#access_token=${jwt}&refresh_token=R1&expires_in=3600&token_type=bearer&type=magiclink`), { status: 'signedIn' });
  assert.deepEqual([account.isSignedIn, account.email, account.userId], [true, 'master@example.com', 'u-42']);

  const reloaded = new AccountService(CONFIG, storage, { fetchImpl: async () => { throw new Error('nessuna rete'); } });
  assert.equal(reloaded.isSignedIn, true);
});

test('AccountService: link scaduto o rifiutato → errore leggibile, nessuna sessione', () => {
  const account = new AccountService(CONFIG, memoryStorage());
  assert.deepEqual(account.consumeUrlHash('#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired'), { status: 'error', code: 'link_expired' });
  assert.deepEqual(account.consumeUrlHash('#error=server_error'), { status: 'error', code: 'unknown' });
  assert.equal(account.isSignedIn, false);
});

test('AccountService: il JWT valido si usa com\'è; se sta per scadere si rinnova una volta sola anche con richieste insieme', async () => {
  const { fetchImpl, state, log } = fakeAuthServer();
  let now = Date.now();
  const storage = memoryStorage();
  const account = new AccountService(CONFIG, storage, { fetchImpl, now: () => now });
  const first = makeJwt({ exp: Math.floor(now / 1000) + 3600 });
  account.consumeUrlHash(`#access_token=${first}&refresh_token=R1`);

  assert.equal(await account.getAccessToken(), first);
  assert.equal(state.refreshCalls, 0, 'ancora valido: nessuna chiamata');

  const second = makeJwt({ exp: Math.floor(now / 1000) + 7200 });
  state.refresh = (body) => { assert.equal(body.refresh_token, 'R1'); return { access_token: second, refresh_token: 'R2' }; };
  now += 3570 * 1000; // mancano 30 secondi: si rinnova
  const results = await Promise.all([account.getAccessToken(), account.getAccessToken(), account.getAccessToken()]);
  assert.deepEqual(results, [second, second, second]);
  assert.equal(state.refreshCalls, 1, 'un solo rinnovo condiviso');
  assert.equal(log.find((l) => l.path === '/auth/v1/token').search, '?grant_type=refresh_token');
  assert.equal(JSON.parse(storage.getItem('dnd5e-character-sheet:account')).refreshToken, 'R2', 'il nuovo refresh token viene salvato');
});

test('AccountService: rinnovo forzato; sessione rifiutata → scollegato; rete assente → resta collegato', async () => {
  const { fetchImpl, state } = fakeAuthServer();
  const now = Date.now();
  const account = new AccountService(CONFIG, memoryStorage(), { fetchImpl, now: () => now });
  const jwt = makeJwt({ exp: Math.floor(now / 1000) + 3600 });
  account.consumeUrlHash(`#access_token=${jwt}&refresh_token=R1`);

  state.network = true;
  assert.equal(await account.getAccessToken({ force: true }), jwt, 'senza rete si tiene il JWT ancora valido');
  assert.equal(account.isSignedIn, true);
  state.network = false;

  const renewed = makeJwt({ sub: 'user-1', exp: Math.floor(now / 1000) + 9000 });
  state.refresh = () => ({ access_token: renewed, refresh_token: 'R2' });
  assert.equal(await account.getAccessToken({ force: true }), renewed);

  state.refresh = null; // il server non riconosce più il refresh token
  assert.equal(await account.getAccessToken({ force: true }), null);
  assert.equal(account.isSignedIn, false, 'sessione rifiutata: si è scollegati');
  assert.equal(await account.getAccessToken(), null);
});

test('AccountService: JWT scaduto e rete assente → nessun token (meglio che mandarne uno morto)', async () => {
  const { fetchImpl, state } = fakeAuthServer();
  let now = Date.now();
  const account = new AccountService(CONFIG, memoryStorage(), { fetchImpl, now: () => now });
  account.consumeUrlHash(`#access_token=${makeJwt({ exp: Math.floor(now / 1000) + 100 })}&refresh_token=R1`);
  now += 200 * 1000;
  state.network = true;
  assert.equal(await account.getAccessToken(), null);
  assert.equal(account.isSignedIn, true, 'ma non si è scollegati: appena torna la rete si rinnova');
});

test('AccountService: l\'uscita dimentica la sessione e avvisa il server (se raggiungibile)', async () => {
  const { fetchImpl, log, state } = fakeAuthServer();
  const storage = memoryStorage();
  const account = new AccountService(CONFIG, storage, { fetchImpl });
  const jwt = makeJwt();
  account.consumeUrlHash(`#access_token=${jwt}&refresh_token=R1`);
  await account.signOut();
  assert.equal(account.isSignedIn, false);
  assert.equal(new AccountService(CONFIG, storage, { fetchImpl }).isSignedIn, false);
  const logout = log.find((l) => l.path === '/auth/v1/logout');
  assert.equal(logout.headers.Authorization, `Bearer ${jwt}`);

  account.consumeUrlHash(`#access_token=${jwt}&refresh_token=R1`);
  state.network = true;
  await account.signOut();                       // senza rete: nessun errore, il browser è comunque scollegato
  assert.equal(account.isSignedIn, false);
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
  const admin = client(server, null, 'ch1');
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
  const dm = client(server, null, 'ch1');
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
  const admin = client(server, null, 'ch1');
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

test('AuthService: dopo il ritorno dall\'email il refresh token dell\'indirizzo viene scambiato subito con uno nuovo', async () => {
  const { fetchImpl, state } = fakeAuthServer();
  const storage = memoryStorage();
  const account = new AccountService(CONFIG, storage, { fetchImpl });
  const auth = new AuthService({ rpc: async () => [] }, storage, account);
  account.consumeUrlHash(`#access_token=${makeJwt()}&refresh_token=DALL-INDIRIZZO`);
  const fresh = makeJwt({ exp: Math.floor(Date.now() / 1000) + 7200 });
  state.refresh = (body) => { assert.equal(body.refresh_token, 'DALL-INDIRIZZO'); return { access_token: fresh, refresh_token: 'NUOVO' }; };

  await auth.rotateSession();
  assert.equal(JSON.parse(storage.getItem('dnd5e-character-sheet:account')).refreshToken, 'NUOVO', 'quello nella cronologia non è più quello salvato');
  state.network = true;
  await auth.rotateSession();                                  // senza rete non solleva errori
  assert.equal(account.isSignedIn, true);
});
