/// Risorse di classe che scalano con il livello (porting di js/data/classResources.js).
library;

import 'dart:math' as math;

import '../i18n.dart';
import 'utils.dart';

/// Valore della riga più alta con livello minimo <= level (null se nessuna).
T? byLevel<T>(int level, List<(int, T)> table) {
  T? value;
  for (final (min, v) in table) {
    if (level >= min) value = v;
  }
  return value;
}

String _wildShapeMaxCr(int lvl, String subclass) => subclass == 'moon'
    ? (lvl < 6 ? 1 : (lvl / 3).floor()).toString()
    : (byLevel<String>(lvl, [(2, '1/4'), (4, '1/2'), (8, '1')]) ?? 'null');

Json _uses(String id, int max, String recharge) => {'id': id, 'max': max, 'recharge': recharge};

String _metres(num n) => '${pick(numStr(n).replaceAll('.', ','), numStr(n))} m';

typedef _Builder = List<Json> Function(int lvl, Map<String, int> mods, Map<String, Object?> ctx);

final Map<String, _Builder> _builders = {
  'barbarian': (lvl, mods, ctx) {
    final rages = byLevel<int>(lvl, [(1, 2), (3, 3), (6, 4), (12, 5), (17, 6)])!;
    return [
      {
        'label': pick('Ire per riposo lungo', 'Rages per long rest'),
        'value': lvl >= 20 ? pick('Illimitate', 'Unlimited') : '$rages',
        if (lvl < 20) 'use': _uses('rage', rages, 'long'),
      },
      {'label': pick('Danni da ira', 'Rage damage'), 'value': '+${byLevel<int>(lvl, [(1, 2), (9, 3), (16, 4)])}'},
    ];
  },
  'bard': (lvl, mods, ctx) => [
        {
          'label': pick('Ispirazione Bardica', 'Bardic Inspiration'),
          'value': '${math.max(1, mods['cha']!)} × ${byLevel<String>(lvl, [(1, 'd6'), (5, 'd8'), (10, 'd10'), (15, 'd12')])}',
          // Dal 5° livello (Fonte di Ispirazione) torna con un riposo breve.
          'use': _uses('bardicInspiration', math.max(1, mods['cha']!), lvl >= 5 ? 'short' : 'long'),
        },
        if (lvl >= 2)
          {'label': pick('Canto di Riposo', 'Song of Rest'), 'value': byLevel<String>(lvl, [(2, 'd6'), (9, 'd8'), (13, 'd10'), (17, 'd12')])},
      ],
  'cleric': (lvl, mods, ctx) => [
        if (lvl >= 2)
          {
            'label': pick('Incanalare Divinità', 'Channel Divinity'),
            'value': '${byLevel<int>(lvl, [(2, 1), (6, 2), (18, 3)])} ${pick('/ riposo', '/ rest')}',
            'use': _uses('channelDivinity', byLevel<int>(lvl, [(2, 1), (6, 2), (18, 3)])!, 'short'),
          },
        if (lvl >= 5)
          {
            'label': pick('Distruggere Non Morti', 'Destroy Undead'),
            'value': '${pick('GS', 'CR')} ${byLevel<String>(lvl, [(5, '1/2'), (8, '1'), (11, '2'), (14, '3'), (17, '4')])}',
          },
      ],
  'druid': (lvl, mods, ctx) => [
        if (lvl >= 2)
          {
            'label': pick('Forma Selvatica', 'Wild Shape'),
            'value': lvl >= 20
                ? pick('Illimitata', 'Unlimited')
                : '${pick('2 / riposo · GS max', '2 / rest · max CR')} ${_wildShapeMaxCr(lvl, (ctx['subclass'] as String?) ?? '')}',
            if (lvl < 20) 'use': _uses('wildShape', 2, 'short'),
          },
      ],
  'fighter': (lvl, mods, ctx) {
    final sub = ctx['subclass'];
    final prof = (ctx['profBonus'] as int?) ?? 2;
    final dice = byLevel<int>(lvl, [(3, 4), (7, 5), (15, 6)]);
    return [
      {'label': pick('Recuperare Energie', 'Second Wind'), 'value': '1d10 + $lvl', 'use': _uses('secondWind', 1, 'short')},
      // Maestro di Battaglia: dadi di superiorità e CD delle manovre.
      if (sub == 'battleMaster' && lvl >= 3) ...[
        {
          'label': pick('Dadi di superiorità', 'Superiority dice'),
          'value': '$dice × ${byLevel<String>(lvl, [(3, 'd8'), (10, 'd10'), (18, 'd12')])}',
          'use': _uses('superiorityDice', dice!, 'short'),
        },
        {'label': pick('CD delle manovre', 'Maneuver save DC'), 'value': '${8 + prof + math.max(mods['str']!, mods['dex']!)}'},
      ],
      if (lvl >= 2)
        {
          'label': pick('Azione Impetuosa', 'Action Surge'),
          'value': '${lvl >= 17 ? 2 : 1} ${pick('/ riposo', '/ rest')}',
          'use': _uses('actionSurge', lvl >= 17 ? 2 : 1, 'short'),
        },
      if (lvl >= 5) {'label': pick('Attacchi per azione', 'Attacks per action'), 'value': '${byLevel<int>(lvl, [(5, 2), (11, 3), (20, 4)])}'},
      if (lvl >= 9)
        {
          'label': pick('Indomito', 'Indomitable'),
          'value': '${byLevel<int>(lvl, [(9, 1), (13, 2), (17, 3)])} ${pick('/ riposo lungo', '/ long rest')}',
          'use': _uses('indomitable', byLevel<int>(lvl, [(9, 1), (13, 2), (17, 3)])!, 'long'),
        },
    ];
  },
  'monk': (lvl, mods, ctx) => [
        {'label': pick('Dado Arti Marziali', 'Martial Arts die'), 'value': byLevel<String>(lvl, [(1, 'd4'), (5, 'd6'), (11, 'd8'), (17, 'd10')])},
        if (lvl >= 2) {'label': pick('Punti Ki', 'Ki points'), 'value': '$lvl', 'use': _uses('ki', lvl, 'short')},
        if (lvl >= 2)
          {
            'label': pick('Movimento senza Armatura', 'Unarmored Movement'),
            'value': '+${_metres(byLevel<num>(lvl, [(2, 3), (6, 4.5), (10, 6), (14, 7.5), (18, 9)])!)}',
          },
      ],
  'paladin': (lvl, mods, ctx) => [
        {'label': pick('Imposizione delle Mani', 'Lay on Hands'), 'value': '${5 * lvl} ${pick('PF', 'HP')}', 'use': _uses('layOnHands', 5 * lvl, 'long')},
        {
          'label': pick('Percezione del Divino', 'Divine Sense'),
          'value': '${math.max(1, 1 + mods['cha']!)} ${pick('/ riposo lungo', '/ long rest')}',
          'use': _uses('divineSense', math.max(1, 1 + mods['cha']!), 'long'),
        },
        if (lvl >= 3) {'label': pick('Incanalare Divinità', 'Channel Divinity'), 'value': pick('1 / riposo', '1 / rest'), 'use': _uses('channelDivinity', 1, 'short')},
      ],
  'rogue': (lvl, mods, ctx) => [
        {'label': pick('Attacco Furtivo', 'Sneak Attack'), 'value': '${(lvl / 2).ceil()}d6'},
      ],
  'sorcerer': (lvl, mods, ctx) => [
        if (lvl >= 2) {'label': pick('Punti Stregoneria', 'Sorcery points'), 'value': '$lvl', 'use': _uses('sorceryPoints', lvl, 'long')},
      ],
  'warlock': (lvl, mods, ctx) => [
        if (lvl >= 2)
          {
            'label': pick('Suppliche Occulte', 'Eldritch Invocations'),
            'value': '${byLevel<int>(lvl, [(2, 2), (5, 3), (7, 4), (9, 5), (12, 6), (15, 7), (18, 8)])}',
          },
      ],
  'wizard': (lvl, mods, ctx) => [
        {
          'label': pick('Recupero Arcano', 'Arcane Recovery'),
          'value': '${(lvl / 2).ceil()} ${pick('livelli di slot', 'slot levels')}',
          'use': _uses('arcaneRecovery', 1, 'long'),
        },
      ],
};

/// Risorse di una classe: `use` è presente se hanno usi limitati da spuntare.
List<Json> getClassResources(String classId, int level, Map<String, int> mods, {String subclass = '', int profBonus = 2}) {
  final builder = _builders[classId];
  return builder == null ? [] : builder(level, mods, {'subclass': subclass, 'profBonus': profBonus});
}
