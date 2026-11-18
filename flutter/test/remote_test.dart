// Collaborazione online: client RPC, account, sessioni e sincronizzazione, contro un backend finto in memoria.
import 'dart:convert';

import 'package:dnd5e_sheet/auth/account_service.dart';
import 'package:dnd5e_sheet/auth/auth_service.dart';
import 'package:dnd5e_sheet/net/remote_api.dart';
import 'package:dnd5e_sheet/services/storage.dart';
import 'package:dnd5e_sheet/sync/character_sync.dart';
import 'package:dnd5e_sheet/sync/diff.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'fake_backend.dart';

void main() {
  group('diff', () {
    test('diffDeep restituisce solo le foglie diverse e deepMerge le riapplica', () {
      final base = {'a': {'x': 1, 'y': 2}, 'list': [1, 2], 's': 'ciao'};
      final next = {'a': {'x': 1, 'y': 3}, 'list': [1, 2, 3], 's': 'ciao'};
      final changes = diffDeep(base, next);
      expect(changes, {'a': {'y': 3}, 'list': [1, 2, 3]});
      expect(deepMerge(base, changes), next);
      expect(diffDeep(base, base), isNull);
    });

    test('applicableChanges scarta ciò che è stato toccato anche in locale', () {
      final base = {'hp': 10, 'speed': 9};
      final local = {'hp': 7, 'speed': 9}; // io ho cambiato i PF
      final remote = {'hp': 5, 'speed': 12}; // gli altri PF e velocità
      final changes = applicableChanges(diffDeep(base, remote), local, base);
      expect(changes, {'speed': 12});
    });
  });

  group('RemoteApi', () {
    test('mappa gli errori del database e la rete assente', () async {
      final api = RemoteApi(url: 'https://x.test/', anonKey: 'k', client: MockClient((r) async => http.Response(jsonEncode({'message': 'invalid_token'}), 400)));
      await expectLater(api.rpc('f'), throwsA(isA<RemoteError>().having((e) => e.code, 'code', 'invalid_token').having((e) => e.isAuthFailure, 'auth', true)));
      final down = RemoteApi(url: 'https://x.test', anonKey: 'k', client: MockClient((r) async => throw http.ClientException('x')));
      await expectLater(down.rpc('f'), throwsA(isA<RemoteError>().having((e) => e.code, 'code', 'network')));
      final denied = RemoteApi(url: 'https://x.test', anonKey: 'k', client: MockClient((r) async => http.Response(jsonEncode({'code': '42501', 'message': 'no'}), 403)));
      await expectLater(denied.rpc('f'), throwsA(isA<RemoteError>().having((e) => e.code, 'code', 'auth_required')));
    });

    test('su 401 rinnova il login una volta e riprova', () async {
      var attempts = 0;
      final seen = <String?>[];
      final api = RemoteApi(
        url: 'https://x.test', anonKey: 'k',
        getAccessToken: ({bool force = false}) async => force ? 'nuovo' : 'vecchio',
        client: MockClient((r) async {
          attempts++;
          seen.add(r.headers['Authorization']);
          return attempts == 1 ? http.Response('{}', 401) : http.Response(jsonEncode('ok'), 200);
        }),
      );
      expect(await api.rpc('f'), 'ok');
      expect(seen, ['Bearer vecchio', 'Bearer nuovo']);
    });
  });

  group('AccountService', () {
    late Storage storage;
    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      storage = await Storage.open();
    });

    test('legge la sessione dal frammento e la ricorda', () {
      final token = jwt({'sub': 'u1', 'email': 'dm@x.it', 'exp': 4102444800});
      final account = AccountService(url: 'https://x.test', anonKey: 'k', storage: storage);
      expect(account.consumeUrlHash('#access_token=$token&refresh_token=r1'), isA<SignedIn>());
      expect(account.isSignedIn, isTrue);
      expect(account.email, 'dm@x.it');
      expect(AccountService(url: 'https://x.test', anonKey: 'k', storage: storage).isSignedIn, isTrue);
      expect(account.consumeUrlHash('#error_code=otp_expired'), isA<SignInError>().having((e) => e.code, 'code', 'link_expired'));
      expect(account.consumeUrlHash(''), isA<SignInNone>());
    });

    test('rinnova il token scaduto e si scollega se il server lo rifiuta', () async {
      final expired = jwt({'sub': 'u1', 'email': 'dm@x.it', 'exp': 100});
      final fresh = jwt({'sub': 'u1', 'email': 'dm@x.it', 'exp': 4102444800});
      var accept = true;
      final account = AccountService(
        url: 'https://x.test', anonKey: 'k', storage: storage, now: () => 1000,
        client: MockClient((r) async => accept
            ? http.Response(jsonEncode({'access_token': fresh, 'refresh_token': 'r2'}), 200)
            : http.Response(jsonEncode({'error_code': 'bad_jwt'}), 400)),
      );
      account.consumeUrlHash('#access_token=$expired&refresh_token=r1');
      expect(await account.getAccessToken(), fresh);
      account.consumeUrlHash('#access_token=$expired&refresh_token=r1');
      accept = false;
      expect(await account.getAccessToken(), isNull);
      expect(account.isSignedIn, isFalse);
    });

    test('requestLink controlla l\'email prima di chiamare il server', () async {
      final account = AccountService(url: 'https://x.test', anonKey: 'k', storage: storage, client: MockClient((r) async => http.Response('{}', 200)));
      await expectLater(account.requestLink('non-una-email', 'https://s'), throwsA(isA<AccountError>().having((e) => e.code, 'code', 'email_invalid')));
      await account.requestLink('dm@x.it', 'https://s');
    });
  });

  group('AuthService', () {
    test('normalizza token scritti a mano e link di invito', () {
      expect(normalizeToken(' pg-aaaa-bbbb-cccc '), 'PG-AAAA-BBBB-CCCC');
      expect(normalizeToken('https://x.it/app/?t=pg-aaaa-bbbb-cccc#x'), 'PG-AAAA-BBBB-CCCC');
      expect(normalizeToken('PG-AAAA-BBBB-CCC'), isNull);
      expect(normalizeToken('PG-AAAA-BBBB-CCC1'), isNull); // 1 non è tra i caratteri ammessi
      expect(buildInviteLink('https://x.it/app/?a=1#h', 'PG-AAAA-BBBB-CCCC'), 'https://x.it/app/?t=PG-AAAA-BBBB-CCCC');
    });

    test('il giocatore entra col token e resta collegato dopo il riavvio', () async {
      SharedPreferences.setMockInitialValues({});
      final storage = await Storage.open();
      final backend = FakeBackend();
      AuthService make() {
        final account = AccountService(url: 'https://x.test', anonKey: 'k', storage: storage);
        return AuthService(api: apiFor(backend), storage: storage, account: account);
      }

      final auth = make();
      final session = await auth.login('pg-aaaa-bbbb-cccc');
      expect(session.role, 'player');
      expect(session.campaignName, 'Campagna');
      expect(make().active?.characterId, 'ch1');
      await expectLater(auth.login('PG-ZZZZ-ZZZZ-ZZZZ'), throwsA(isA<RemoteError>().having((e) => e.code, 'code', 'invalid_token')));
      auth.logout();
      expect(make().active, isNull);
    });
  });

  group('CharacterSync', () {
    Map<String, dynamic> sheet(int hp, num speed) => {'combat': {'hpCurrent': hp, 'speed': speed}, 'notes': 'x'};

    test('due client sullo stesso documento convergono senza pestarsi i piedi', () async {
      final backend = FakeBackend()..doc = sheet(10, 9)..revision = 1;
      var localA = sheet(10, 9);
      var localB = sheet(10, 9);
      final a = CharacterSync(api: apiFor(backend), token: 'PG-A', characterId: 'ch', getLocal: () => localA);
      final b = CharacterSync(api: apiFor(backend), token: null, characterId: 'ch', getLocal: () => localB);
      final remoteForB = <RemoteChange>[];
      b.onRemote.listen(remoteForB.add);
      await a.load();
      await b.load();
      a.markSynced(localA);
      b.markSynced(localB);

      localA = sheet(10, 12); // il giocatore cambia la velocità
      expect(await a.push(), isTrue);
      localB = sheet(6, 9); // il Master cambia i PF (campo diverso, stessa sezione)
      await b.tick();
      expect(backend.doc['combat'], {'hpCurrent': 6, 'speed': 12});
      expect(remoteForB.single.changes, {'combat': {'speed': 12}});
      expect(await a.push(), isFalse); // niente da inviare
    });

    test('offline poi di nuovo online: riprova da solo; un token revocato ferma tutto', () async {
      final backend = FakeBackend()..doc = sheet(10, 9)..revision = 1;
      var local = sheet(10, 9);
      final sync = CharacterSync(api: apiFor(backend), token: 'PG-A', characterId: 'ch', getLocal: () => local);
      final states = <SyncState>[];
      sync.onState.listen(states.add);
      await sync.load();
      sync.markSynced(local);
      backend.offline = true;
      local = sheet(3, 9);
      expect(await sync.push(), isFalse);
      expect(sync.state, SyncState.offline);
      backend.offline = false;
      await sync.tick();
      expect(backend.doc['combat'], {'hpCurrent': 3, 'speed': 9});
      expect(sync.state, SyncState.online);

      final revoked = CharacterSync(
        api: RemoteApi(url: 'https://x.test', anonKey: 'k', client: MockClient((r) async => http.Response(jsonEncode({'message': 'invalid_token'}), 400))),
        token: 'PG-A', characterId: 'ch', getLocal: () => local,
      );
      await revoked.tick();
      expect(revoked.state, SyncState.revoked);
    });
  });
}
