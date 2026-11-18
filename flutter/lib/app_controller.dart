import 'dart:async';
import 'dart:convert';
import 'dart:ui' as ui;

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:material_ui/material_ui.dart' show ThemeMode;

import 'data/catalog.dart';
import 'i18n.dart';
import 'model/character_model.dart';
import 'sync/character_sync.dart';
import 'sync/diff.dart';
import 'services/storage.dart';

/// Collega modello, storage, lingua e tema (il "controller" dell'app).
class AppController extends ChangeNotifier {
  AppController._(this.storage, this.model, this._lang, this.themeMode, this.panels);

  final Storage storage;
  final CharacterModel model;
  String _lang;
  ThemeMode themeMode;
  final Map<String, dynamic> panels;
  Timer? _saveTimer;
  CharacterSync? _remote;
  StreamSubscription<RemoteChange>? _remoteSub;

  /// Falso quando l'app è in secondo piano: la sincronizzazione periodica si ferma.
  bool isForeground = true;
  Json? _spellText;

  /// Messaggio breve da mostrare all'utente (snackbar); la UI lo legge e lo azzera.
  final ValueNotifier<String?> status = ValueNotifier(null);

  String get language => _lang;

  /// Carica cataloghi e dati salvati.
  static Future<AppController> load() async {
    final files = <String, String>{
      for (final name in catalogFiles) name: await rootBundle.loadString('assets/data/$name'),
    };
    Catalog.instance = Catalog.parse(files);
    setUiDictionary(Catalog.instance.uiEn);

    final storage = await Storage.open();
    final saved = storage.loadString('lang');
    final device = ui.PlatformDispatcher.instance.locales.map((l) => l.languageCode);
    final language = isSupportedLang(saved) ? saved! : detectLang(device);
    setLang(language);

    final theme = switch (storage.loadString('theme')) { 'light' => ThemeMode.light, 'dark' => ThemeMode.dark, _ => ThemeMode.system };
    final model = CharacterModel(storage.loadCharacter(), storage.loadSources());
    final controller = AppController._(storage, model, language, theme, storage.loadUiState());
    model.addListener(controller._scheduleSave);
    return controller;
  }

  void _scheduleSave() {
    // Cambiare lingua non modifica il personaggio: niente salvataggio.
    if (model.lastPath == 'lang') return;
    if (model.lastPath == '*' && _remote != null && _remote!.state == SyncState.revoked) return;
    _saveTimer?.cancel();
    _saveTimer = Timer(const Duration(milliseconds: 400), saveNow);
  }

  /// Salva subito: sul server se si sta modificando una scheda condivisa, altrimenti in locale.
  Future<void> saveNow() async {
    _saveTimer?.cancel();
    _saveTimer = null;
    await storage.saveSources(model.sources.toList());
    final remote = _remote;
    if (remote != null) {
      if (await remote.push(model.snapshot())) status.value = pick('Sincronizzato ✓', 'Synced ✓');
      return;
    }
    await storage.saveCharacter(model.snapshot());
  }

  // ------------------------------------------------- Scheda condivisa

  bool get isRemote => _remote != null;
  bool get hasLocalCharacter => storage.loadCharacter() != null;
  Object? get localCharacter => storage.loadCharacter();

  /// Passa a una scheda condivisa. La scheda locale resta intatta: finché si è collegati i salvataggi vanno solo al server.
  /// Con [upload] `data` è la scheda locale e va inviata (la base resta vuota: il primo invio manda tutto).
  void attachRemote(CharacterSync sync, Json data, {bool upload = false}) {
    detachRemote();
    _remote = sync;
    model.load(data);
    if (!upload) {
      sync.markSynced(model.snapshot());
    } else {
      sync.push(); // prima che il salvataggio ritardato confronti qualcosa
    }
    _remoteSub = sync.onRemote.listen((change) {
      if (_remote != sync) return;
      model.load(deepMerge(model.snapshot(), change.changes) as Json);
      sync.markSynced(model.snapshot());
      status.value = change.updatedBy == 'admin' ? pick('Aggiornata dal Master', 'Updated by the DM') : pick('Aggiornata dal giocatore', 'Updated by the player');
    });
    sync.start();
    notifyListeners();
  }

  /// Torna alla scheda locale.
  void detachRemote() {
    final remote = _remote;
    if (remote == null) return;
    // Invia ciò che era ancora in attesa del salvataggio ritardato.
    if (_saveTimer?.isActive ?? false) remote.push(model.snapshot());
    _saveTimer?.cancel();
    remote.stop();
    _remoteSub?.cancel();
    _remote = null;
    model.load(storage.loadCharacter());
    notifyListeners();
  }

  bool panelOpen(String id, {bool defaultOpen = false}) => (panels[id] as bool?) ?? defaultOpen;

  void setPanelOpen(String id, bool open) {
    panels[id] = open;
    storage.saveUiState(panels);
  }

  /// Cambia a ogni «espandi/comprimi tutto»: i pannelli si ricreano con il nuovo stato iniziale.
  int panelsGeneration = 0;

  void setAllPanels(List<String> ids, bool open) {
    for (final id in ids) {
      panels[id] = open;
    }
    panelsGeneration++;
    storage.saveUiState(panels);
    notifyListeners();
  }

  void setLanguage(String code) {
    if (!setLang(code)) return;
    _lang = code;
    storage.saveString('lang', code);
    model.languageChanged();
    notifyListeners();
  }

  void toggleTheme(bool platformIsDark) {
    final isDark = themeMode == ThemeMode.dark || (themeMode == ThemeMode.system && platformIsDark);
    themeMode = isDark ? ThemeMode.light : ThemeMode.dark;
    storage.saveString('theme', themeMode == ThemeMode.dark ? 'dark' : 'light');
    notifyListeners();
  }

  /// Il personaggio come JSON leggibile (lo stesso formato dell'app web).
  String exportJson() => const JsonEncoder.withIndent('  ').convert(model.snapshot());

  /// Importa un JSON incollato; restituisce false se non è un personaggio valido.
  bool importJson(String text) {
    try {
      final data = jsonDecode(text);
      if (data is! Map) return false;
      model.load(data);
      return true;
    } catch (_) {
      return false;
    }
  }

  void reset() {
    model.reset();
    if (_remote == null) storage.clearCharacter(); // la scheda locale non si tocca mentre si è in campagna
  }

  /// Testi degli incantesimi: ~700 KB, si caricano alla prima apertura di una descrizione.
  Future<Json?> spellText(String id) async {
    _spellText ??= jsonDecode(await rootBundle.loadString('assets/data/spell_text.json')) as Json;
    return _spellText![id] as Json?;
  }

  @override
  void dispose() {
    _saveTimer?.cancel();
    super.dispose();
  }
}
