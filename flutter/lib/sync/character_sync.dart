/// Sincronizzazione di UNA scheda con il database condiviso (porting di js/sync/CharacterSync.js).
///
/// Si scambiano solo i *campi* (foglie del documento) cambiati e il server li fonde in profondità:
/// due persone che toccano campi diversi non si pestano i piedi; sullo stesso campo vince l'ultimo che salva.
///
/// Tre fotografie del documento: `base` (ultimo stato locale concordato col server), `remoteDoc`
/// (ultimo documento visto sul server) e quello locale, letto con [getLocal].
/// Ogni ciclo di polling prima invia le modifiche locali (riprova da solo dopo un errore di rete) e poi
/// legge quelle degli altri; i campi cambiati altrove si applicano solo se localmente non sono stati toccati.
library;

import 'dart:async';

import '../i18n.dart';
import '../model/utils.dart';
import '../net/remote_api.dart';
import 'diff.dart';

enum SyncState { online, offline, revoked }

class RemoteChange {
  const RemoteChange(this.changes, this.updatedBy);
  final Json changes;
  final String? updatedBy;
}

class CharacterSync {
  CharacterSync({required this.api, required this.token, this.characterId, required this.getLocal, this.pollEvery = const Duration(seconds: 5), this.isActive});

  final RemoteApi api;
  final String? token;
  final String? characterId;
  final Json Function() getLocal;
  final Duration pollEvery;

  /// Se restituisce false (app in secondo piano) il ciclo periodico salta.
  final bool Function()? isActive;

  Json _base = {};
  Json _remoteDoc = {};
  int _revision = -1;
  Future<void> _queue = Future.value();
  Timer? _timer;
  SyncState _state = SyncState.online;
  final _remote = StreamController<RemoteChange>.broadcast();
  final _states = StreamController<SyncState>.broadcast();

  SyncState get state => _state;
  Stream<RemoteChange> get onRemote => _remote.stream;
  Stream<SyncState> get onState => _states.stream;

  /// Prima lettura: il documento remoto (può essere vuoto per una scheda nuova).
  Future<({Json data, String? updatedBy})> load() async {
    final row = await _fetch();
    _remoteDoc = _asJson(row['data']);
    _revision = (row['revision'] as num).toInt();
    return (data: _remoteDoc, updatedBy: row['updated_by'] as String?);
  }

  /// Da chiamare dopo aver caricato il documento nel Model: da qui in poi si confronta con questo.
  void markSynced(Json snapshot) => _base = deepCopy(snapshot);

  /// Invia i campi cambiati. Restituisce true se ha mandato qualcosa.
  Future<bool> push([Json? snapshot]) => _enqueue(() => _push(snapshot ?? getLocal()));

  /// Legge le novità degli altri.
  Future<bool> pull() => _enqueue(() async {
        await _pull();
        return false;
      });

  /// Un ciclo completo: invia, poi legge. Mai in parallelo con altre operazioni.
  Future<bool> tick() => _enqueue(() async {
        await _push(getLocal());
        await _pull();
        return false;
      });

  void start() {
    stop();
    _timer = Timer.periodic(pollEvery, (_) {
      if (isActive?.call() ?? true) tick();
    });
  }

  void stop() {
    _timer?.cancel();
    _timer = null;
  }

  Future<void> dispose() async {
    stop();
    await _remote.close();
    await _states.close();
  }

  // ------------------------------------------------------------ Interni

  /// Serializza le operazioni e non lascia mai che un errore blocchi la coda.
  Future<bool> _enqueue(Future<bool> Function() task) {
    final run = _queue.then((_) => task()).catchError((Object error) => _fail(error));
    _queue = run.then((_) {});
    return run;
  }

  bool _fail(Object error) {
    if (error is RemoteError && error.isAuthFailure) {
      stop();
      _setState(SyncState.revoked);
    } else {
      _setState(SyncState.offline);
    }
    return false;
  }

  void _setState(SyncState state) {
    if (state == _state) return;
    _state = state;
    if (!_states.isClosed) _states.add(state);
  }

  static Json _asJson(Object? v) => v is Map ? deepCopy<Json>(v.cast<String, dynamic>()) : <String, dynamic>{};

  Future<Json> _fetch() async {
    final rows = (await api.rpc('get_character', {'p_token': token, 'p_character_id': characterId})) as List?;
    if (rows == null || rows.isEmpty) throw RemoteError('not_found');
    return (rows.first as Map).cast<String, dynamic>();
  }

  Future<bool> _push(Json snapshot) async {
    final changes = diffDeep(_base, snapshot);
    if (changes == null) return false;
    final rows = (await api.rpc('save_character', {'p_token': token, 'p_character_id': characterId, 'p_changes': changes})) as List?;
    if (rows == null || rows.isEmpty) throw StateError('empty response');
    _base = deepMerge(_base, changes) as Json;
    _setState(SyncState.online);
    _integrate((rows.first as Map).cast<String, dynamic>());
    return true;
  }

  /// Chiede solo il numero di revisione (pochi byte) e scarica la scheda se è cambiato.
  Future<void> _pull() async {
    final revision = await api.rpc('character_revision', {'p_token': token, 'p_character_id': characterId});
    _setState(SyncState.online);
    if (revision is num && revision.toInt() == _revision) return;
    _integrate(await _fetch());
  }

  /// Applica al Model i campi cambiati dagli altri e non toccati qui.
  void _integrate(Json row) {
    final remote = _asJson(row['data']);
    final changes = applicableChanges(diffDeep(_remoteDoc, remote), getLocal(), _base);
    _remoteDoc = remote;
    _revision = (row['revision'] as num).toInt();
    if (changes == null) return;
    _base = deepMerge(_base, changes) as Json;
    if (!_remote.isClosed) _remote.add(RemoteChange(changes as Json, row['updated_by'] as String?));
  }
}
