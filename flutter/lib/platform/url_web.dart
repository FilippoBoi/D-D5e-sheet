import 'package:web/web.dart' as web;

Uri get launchUri => Uri.base;

void cleanLaunchUrl() {
  final uri = Uri.base;
  final clean = Uri(path: uri.path, queryParameters: {for (final e in uri.queryParameters.entries) if (e.key != 't') e.key: e.value}.isEmpty ? null : {for (final e in uri.queryParameters.entries) if (e.key != 't') e.key: e.value});
  web.window.history.replaceState(null, '', clean.toString());
}
