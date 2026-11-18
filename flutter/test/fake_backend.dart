// Backend finto in memoria, condiviso dai test della collaborazione online.
import 'dart:convert';

import 'package:dnd5e_sheet/net/remote_api.dart';
import 'package:http/http.dart' as http;
import 'package:http/testing.dart';

String jwt(Map<String, dynamic> claims) {
  String enc(Object o) => base64Url.encode(utf8.encode(jsonEncode(o))).replaceAll('=', '');
  return '${enc({'alg': 'none'})}.${enc(claims)}.sig';
}

/// Backend finto: una scheda condivisa con fusione profonda, come `_jsonb_deep_merge` nel database.
class FakeBackend {
  Map<String, dynamic> doc = {};
  int revision = 0;
  String updatedBy = 'player';
  bool offline = false;
  final calls = <String>[];

  Object? merge(Object? target, Object? patch) {
    if (target is! Map || patch is! Map) return patch;
    final out = <String, dynamic>{...target.cast<String, dynamic>()};
    for (final e in patch.entries) {
      out[e.key as String] = target.containsKey(e.key) ? merge(target[e.key], e.value) : e.value;
    }
    return out;
  }

  http.Response handle(http.Request r) {
    if (offline) throw http.ClientException('offline');
    final fn = r.url.pathSegments.last;
    final args = (jsonDecode(r.body) as Map).cast<String, dynamic>();
    calls.add(fn);
    switch (fn) {
      case 'get_character':
        return json([{'data': doc, 'revision': revision, 'updated_by': updatedBy}]);
      case 'character_revision':
        return json(revision);
      case 'save_character':
        doc = merge(doc, args['p_changes']) as Map<String, dynamic>;
        revision++;
        updatedBy = args['p_token'] == null ? 'admin' : 'player';
        return json([{'data': doc, 'revision': revision, 'updated_by': updatedBy}]);
      case 'resolve_token':
        return args['p_token'] == 'PG-AAAA-BBBB-CCCC'
            ? json([{'campaign_id': 'c1', 'campaign_name': 'Campagna', 'character_id': 'ch1'}])
            : http.Response(jsonEncode({'message': 'invalid_token'}), 400);
      default:
        return http.Response(jsonEncode({'message': 'x'}), 404);
    }
  }

  http.Response json(Object? body) => http.Response(jsonEncode(body), 200, headers: {'content-type': 'application/json'});
}

RemoteApi apiFor(FakeBackend b, {AccessTokenProvider? tokens}) =>
    RemoteApi(url: 'https://x.test', anonKey: 'k', getAccessToken: tokens, client: MockClient((r) async => b.handle(r)));
