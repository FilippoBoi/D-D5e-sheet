/// Confronto e fusione di documenti JSON, ignorando l'ordine delle chiavi (porting di js/sync/diff.js).
///
/// Granularità: le *foglie*. Gli oggetti si attraversano; numeri, stringhe, booleani e array
/// (es. l'elenco delle armi) sono foglie e si scambiano interi. `deepMerge` ha la stessa semantica
/// di `_jsonb_deep_merge` in supabase/schema.sql.
library;

import '../model/utils.dart';

bool deepEqual(Object? a, Object? b) {
  if (identical(a, b)) return true;
  if (a is Map && b is Map) {
    if (a.length != b.length) return false;
    return a.keys.every((k) => b.containsKey(k) && deepEqual(a[k], b[k]));
  }
  if (a is List && b is List) {
    if (a.length != b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }
  return a == b;
}

/// Cosa serve a [base] per diventare [next]: un parziale con le sole foglie diverse, o null se uguali.
Object? diffDeep(Object? base, Object? next) {
  if (next is Map && base is Map) {
    final changes = <String, dynamic>{};
    for (final key in next.keys) {
      final change = diffDeep(base[key], next[key]);
      if (change != null || (next[key] == null && base[key] != null)) {
        changes[key as String] = change;
      }
    }
    return changes.isEmpty ? null : changes;
  }
  return deepEqual(base, next) ? null : deepCopy<Object?>(next);
}

/// Applica [patch] a [target] senza modificarlo: gli oggetti si fondono, il resto si sostituisce.
Object? deepMerge(Object? target, Object? patch) {
  if (target is! Map || patch is! Map) return deepCopy<Object?>(patch);
  final result = <String, dynamic>{...target.cast<String, dynamic>()};
  for (final key in patch.keys) {
    result[key as String] = target.containsKey(key) ? deepMerge(target[key], patch[key]) : deepCopy<Object?>(patch[key]);
  }
  return deepCopy<Object?>(result);
}

/// Tra le modifiche arrivate dal server tiene solo quelle applicabili qui: scarta una foglia se è già
/// uguale a quella locale o se è stata toccata anche qui rispetto a [base] (la modifica locale vince).
Object? applicableChanges(Object? change, Object? local, Object? base) {
  if (change is Map && local is Map) {
    final out = <String, dynamic>{};
    for (final key in change.keys) {
      final part = applicableChanges(change[key], local[key], base is Map ? base[key] : null);
      if (part != null) out[key as String] = part;
    }
    return out.isEmpty ? null : out;
  }
  if (deepEqual(change, local)) return null;
  if (!deepEqual(local, base)) return null;
  return change;
}
