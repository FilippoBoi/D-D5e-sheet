/// MODEL — unica fonte di verità sullo stato del personaggio (porting di js/model/CharacterModel.js).
///
/// Non conosce la UI né lo storage; ogni modifica passa da metodi che validano i dati
/// e, a modifica avvenuta, notifica gli ascoltatori.
library;

import 'dart:math' as math;

import 'package:flutter/foundation.dart';

import '../data/catalog.dart';
import '../i18n.dart';
import 'calculations.dart';
import 'class_choices.dart';
import 'derive_stats.dart';
import 'schema.dart';
import 'spell_text.dart';
import 'utils.dart';

class CharacterModel extends ChangeNotifier {
  CharacterModel([Object? initialData, Object? sources])
      : _state = normalizeCharacter(initialData),
        _sources = normalizeSources(sources);

  Json _state;
  Set<String> _sources;
  Json? _derivedCache;
  String? _derivedLang;

  /// Percorso dell'ultima modifica (utile per capire cosa è cambiato).
  String lastPath = '*';

  Set<String> get sources => {..._sources};

  /// Copia profonda dello stato: chi la riceve non può modificarlo per errore.
  Json snapshot() => deepCopy(_state);

  /// Stato in sola lettura per la UI (non modificarlo: usa i metodi del modello).
  Json get state => _state;

  /// Valori calcolati (modificatori, CA, CD...), con cache fino alla modifica successiva o al cambio lingua.
  Json get derived {
    if (_derivedCache == null || _derivedLang != lang) {
      _derivedCache = deriveStats(_state, sources: _sources);
      _derivedLang = lang;
    }
    return _derivedCache!;
  }

  Object? get(String path) => deepCopy(getByPath(_state, path));

  void _emit(String path) {
    lastPath = path;
    _derivedCache = null;
    notifyListeners();
  }

  /// Dopo un cambio lingua i derivati vanno ricalcolati.
  void languageChanged() => _emit('lang');

  bool toggleSource(String id) {
    final next = {..._sources};
    if (!next.remove(id)) next.add(id);
    final valid = normalizeSources(next.toList());
    if (valid.length == _sources.length && valid.every(_sources.contains)) return false;
    _sources = valid;
    _emit('sources');
    return true;
  }

  void setSources(Object? raw) {
    _sources = normalizeSources(raw);
    _emit('sources');
  }

  // ------------------------------------------------------------- Scritture

  /// Aggiorna un singolo campo tramite percorso puntato ("abilities.str", "weapons.0.name").
  bool set(String path, Object? rawValue) {
    const choicePrefix = 'info.classChoices.';
    if (path.startsWith(choicePrefix)) return _setClassChoice(path.substring(choicePrefix.length), rawValue);
    final current = getByPath(_state, path);
    if (current == null || current is Map || current is List) {
      debugPrint('[CharacterModel] percorso non valido: $path');
      return false;
    }
    final value = sanitizeValue(path, rawValue, current);
    if (value == current) return false;
    setByPath(_state, path, value);

    final info = _state['info'] as Json;
    if (path == 'info.classId') {
      // Cambiando classe si applicano i suoi tiri salvezza; scelte, abilità e incantesimi ripartono.
      _state['saveProficiencies'] = classSaveProficiencies(value as String);
      _state['classSkills'] = createDefaultCharacter()['classSkills'];
      info['classChoices'] = defaultChoiceValues();
      final spells = _state['spells'] as Json;
      spells['cantripIds'] = <String>[];
      spells['spellIds'] = <String>[];
    }
    if (path == 'info.raceId') {
      _applyRace(value as String);
      info['raceChoices'] = createDefaultCharacter()['info']['raceChoices'];
    }
    _emit(path);
    return true;
  }

  /// Aggiunge o toglie un valore da una scelta multipla o di abilità (si toglie sempre; si aggiunge se ammesso).
  bool toggleChoice(String key, String value) {
    final info = _state['info'] as Json;
    final classId = info['classId'] as String;
    final def = Catalog.instance.getChoiceDefs(classId).where((d) => d['key'] == key).firstOrNull;
    if (def == null || !isListType(def['type'] as String) || !allowedValues(def).contains(value)) return false;
    final choices = info['classChoices'] as Json;
    final list = (choices[key] as List).cast<String>();
    if (list.contains(value)) {
      choices[key] = list.where((v) => v != value).toList();
    } else {
      final group = (derived['classChoices'] as List).cast<Json>().where((g) => g['key'] == key).firstOrNull;
      final option = group == null ? null : (group['options'] as List).cast<Json>().where((o) => o['value'] == value).firstOrNull;
      if (group == null || option == null || option['disabled'] == true) return false;
      choices[key] = [...list, value];
    }
    _emit('info.classChoices.$key');
    return true;
  }

  /// Aggiunge o toglie un incantesimo (o trucchetto) dall'elenco scelto. Non blocca chi supera il limite.
  bool toggleSpell(String kind, String id) {
    if (kind != 'cantrips' && kind != 'spells') return false;
    final spell = Catalog.instance.getSpell(id);
    if (spell == null || (spell['level'] == 0) != (kind == 'cantrips')) return false;
    final key = kind == 'cantrips' ? 'cantripIds' : 'spellIds';
    final spells = _state['spells'] as Json;
    final list = (spells[key] as List).cast<String>();
    if (list.contains(id)) {
      spells[key] = list.where((x) => x != id).toList();
    } else {
      if (list.length >= (kind == 'cantrips' ? Catalog.maxCantrips : Catalog.maxSpells)) return false;
      spells[key] = [...list, id];
    }
    _emit('spells.$key');
    return true;
  }

  /// Elenco per il selettore: incantesimi dei manuali attivi (più quelli già scelti), con `own` per la lista della classe.
  List<Json> getSpellOptions(String kind) {
    final listClass = derived['spellcasting']['listClass'] as String;
    final spells = _state['spells'] as Json;
    final chosen = (spells[kind == 'cantrips' ? 'cantripIds' : 'spellIds'] as List).cast<String>().toSet();
    final wantCantrips = kind == 'cantrips';
    final out = [
      for (final sp in Catalog.instance.spells)
        if ((sp['level'] == 0) == wantCantrips && (_sources.contains(sp['source']) || chosen.contains(sp['id'])))
          {...describeSpell(sp), 'own': onClassList(sp, listClass, _sources)},
    ];
    out.sort((a, b) {
      final c = (a['level'] as int).compareTo(b['level'] as int);
      return c != 0 ? c : compareNames(a['name'] as String, b['name'] as String);
    });
    return out;
  }

  void addAcItem() {
    final items = (_state['equipment'] as Json)['acItems'] as List;
    if (items.length >= maxAcItems) return;
    items.add(createAcItem());
    _emit('equipment.acItems');
  }

  void removeAcItem(String id) {
    final eq = _state['equipment'] as Json;
    final before = (eq['acItems'] as List).length;
    eq['acItems'] = (eq['acItems'] as List).where((i) => i['id'] != id).toList();
    if ((eq['acItems'] as List).length != before) _emit('equipment.acItems');
  }

  // ------------------------------------------------------------- Note libere

  List<Json> get _notes => ((_state['notes'] as Json)['items'] as List).cast<Json>();

  /// Indice della nota con questo id, o -1.
  int noteIndex(String id) => _notes.indexWhere((n) => n['id'] == id);

  /// Aggiunge una nota in fondo (o in [at]); restituisce l'id, o null se si è al limite.
  String? addNote({String title = '', String text = '', int? at}) {
    final notes = _notes;
    if (notes.length >= maxNotes) return null;
    final note = createNote();
    note['title'] = sanitizeValue('notes.items.${notes.length}.title', title, '');
    note['text'] = sanitizeValue('notes.items.${notes.length}.text', text, '');
    notes.insert((at ?? notes.length).clamp(0, notes.length), note);
    _emit('notes.items');
    return note['id'] as String;
  }

  void removeNote(String id) {
    final i = noteIndex(id);
    if (i < 0) return;
    _notes.removeAt(i);
    _emit('notes.items');
  }

  /// Sposta la nota di [delta] posizioni (-1 su, +1 giù).
  void moveNote(String id, int delta) {
    final notes = _notes;
    final from = noteIndex(id);
    final to = from + delta;
    if (from < 0 || to < 0 || to >= notes.length) return;
    notes.insert(to, notes.removeAt(from));
    _emit('notes.items');
  }

  /// Sposta la nota all'indice [to] (per il trascinamento: indice finale nella lista già senza di lei).
  void reorderNote(int from, int to) {
    final notes = _notes;
    if (from < 0 || from >= notes.length || to < 0 || to >= notes.length || from == to) return;
    notes.insert(to, notes.removeAt(from));
    _emit('notes.items');
  }

  void addWeapon() {
    final weapons = _state['weapons'] as List;
    if (weapons.length >= maxWeapons) return;
    weapons.add(createWeapon());
    _emit('weapons');
  }

  void removeWeapon(String id) {
    final before = (_state['weapons'] as List).length;
    _state['weapons'] = (_state['weapons'] as List).where((w) => w['id'] != id).toList();
    if ((_state['weapons'] as List).length != before) _emit('weapons');
  }

  /// I danni consumano prima i PF temporanei, poi quelli attuali.
  void applyDamage(num amount) {
    final n = amount.truncate();
    if (n <= 0) return;
    final c = _state['combat'] as Json;
    final absorbed = math.min(c['hpTemp'] as int, n);
    c['hpTemp'] = (c['hpTemp'] as int) - absorbed;
    c['hpCurrent'] = math.max(0, (c['hpCurrent'] as int) - (n - absorbed));
    _emit('combat');
  }

  /// La cura non supera i PF massimi; tornare sopra 0 azzera i TS contro morte.
  void heal(num amount) {
    final n = amount.truncate();
    if (n <= 0) return;
    final c = _state['combat'] as Json;
    c['hpCurrent'] = math.min(c['hpMax'] as int, (c['hpCurrent'] as int) + n);
    c['deathSuccesses'] = 0;
    c['deathFailures'] = 0;
    _emit('combat');
  }

  void applySuggestedHp() {
    final suggested = clampInt(derived['hp']['suggested'] as num, 1, 999);
    final c = _state['combat'] as Json;
    c['hpMax'] = suggested;
    c['hpCurrent'] = suggested;
    _emit('combat');
  }

  /// Riposo breve: tornano le risorse "a riposo breve" e, per il Warlock, gli slot del Patto.
  void shortRest() {
    final d = derived;
    final used = _state['resourcesUsed'] as Json;
    for (final u in (d['usables'] as List).cast<Json>()) {
      if (u['recharge'] == 'short') used[u['id'] as String] = 0;
    }
    if (d['spellcasting']['isPact'] == true) {
      final slots = (_state['spells'] as Json)['slotsUsed'] as Json;
      for (final key in slots.keys.toList()) {
        slots[key] = 0;
      }
    }
    _emit('rest');
  }

  /// Riposo lungo: PF al massimo, slot e risorse recuperati, TS contro morte azzerati.
  void longRest() {
    final c = _state['combat'] as Json;
    c['hpCurrent'] = c['hpMax'];
    c['hpTemp'] = 0;
    c['deathSuccesses'] = 0;
    c['deathFailures'] = 0;
    final slots = (_state['spells'] as Json)['slotsUsed'] as Json;
    for (final key in slots.keys.toList()) {
      slots[key] = 0;
    }
    final used = _state['resourcesUsed'] as Json;
    for (final key in used.keys.toList()) {
      used[key] = 0;
    }
    _emit('rest');
  }

  /// PF guadagnati salendo di `levels` livelli: media, tiro virtuale o somma dei dadi già tirati.
  ({int gain, List<int> rolls}) applyLevelUpHp(int levels, {required String mode, int total = 0, math.Random? rng}) {
    if (levels <= 0) return (gain: 0, rolls: <int>[]);
    final hp = derived['hp'] as Json;
    final die = hp['hitDieSides'] as int;
    final conMod = hp['conMod'] as int;
    final perLevel = hp['perLevelBonus'] as int;
    var gain = 0;
    var rolls = <int>[];
    if (mode == 'average') {
      gain = (averageHpGain(die, conMod, perLevel) * levels).round();
    } else if (mode == 'roll') {
      final r = rng ?? math.Random();
      rolls = List.generate(levels, (_) => 1 + r.nextInt(die));
      gain = rolls.fold(0, (sum, roll) => sum + rolledHpGain(roll, conMod, perLevel));
    } else if (mode == 'manual') {
      final rolled = clampInt(total, levels, levels * die);
      gain = math.max(levels, rolled + levels * conMod) + levels * perLevel;
    } else {
      return (gain: 0, rolls: <int>[]);
    }
    final c = _state['combat'] as Json;
    final hpMax = math.min(999, (c['hpMax'] as int) + gain);
    c['hpCurrent'] = math.min(hpMax, (c['hpCurrent'] as int) + (hpMax - (c['hpMax'] as int)));
    c['hpMax'] = hpMax;
    _emit('combat');
    return (gain: gain, rolls: rolls);
  }

  /// Sostituisce l'intero personaggio (import JSON). I dati vengono validati.
  void load(Object? data) {
    _state = normalizeCharacter(data);
    _emit('*');
  }

  void reset() {
    _state = createDefaultCharacter();
    _emit('*');
  }

  // --------------------------------------------------------------- Interni

  bool _setClassChoice(String key, Object? rawValue) {
    final info = _state['info'] as Json;
    final classId = info['classId'] as String;
    final value = validateChoiceValue(classId, key, rawValue);
    final choices = info['classChoices'] as Json;
    if (value == null || value == choices[key]) return false;
    final defs = Catalog.instance.getChoiceDefs(classId);
    final own = defs.where((d) => d['key'] == key).firstOrNull;
    final differs = own?['differsFrom'] as String?;
    if (value.isNotEmpty && differs != null && value == choices[differs]) return false;
    choices[key] = value;
    // Chi deve differire da questa scelta e ora è uguale si azzera.
    for (final d in defs) {
      if (d['differsFrom'] == key && value.isNotEmpty && choices[d['key']] == value) choices[d['key'] as String] = '';
    }
    void reset(String parent) {
      for (final child in dependentKeys(classId, parent)) {
        final def = defs.firstWhere((d) => d['key'] == child);
        choices[child] = isListType(def['type'] as String) ? <String>[] : '';
        reset(child);
      }
    }

    reset(key);
    _emit('info.classChoices.$key');
    return true;
  }

  /// Applica i valori automatici della razza: velocità e abilità con competenza fissa.
  void _applyRace(String raceId) {
    final race = Catalog.instance.getRace(raceId);
    if (race == null) return;
    (_state['combat'] as Json)['speed'] = feetToMeters(race['speedFt'] as num);
    for (final skillId in (race['skills'] as List).cast<String>()) {
      ((_state['skills'] as Json)[skillId] as Json)['proficient'] = true;
    }
  }
}
