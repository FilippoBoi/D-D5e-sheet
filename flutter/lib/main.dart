import 'package:flutter_web_plugins/url_strategy.dart';
import 'package:material_ui/material_ui.dart';

import 'app_controller.dart';
import 'auth/account_service.dart';
import 'auth/auth_service.dart';
import 'config.dart';
import 'i18n.dart';
import 'net/remote_api.dart';
import 'session_controller.dart';
import 'ui/sheet_page.dart';
import 'ui/theme.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  // Indirizzi senza "#/": il frammento resta libero per il link di accesso dell'email.
  usePathUrlStrategy();
  runApp(SheetApp(app: await AppController.load()));
}

class SheetApp extends StatefulWidget {
  const SheetApp({super.key, required this.app, this.session, this.enableRemote = true});
  final AppController app;

  /// Per i test: un controller di sessione già pronto.
  final SessionController? session;
  final bool enableRemote;

  @override
  State<SheetApp> createState() => _SheetAppState();
}

class _SheetAppState extends State<SheetApp> with WidgetsBindingObserver {
  final GlobalKey<NavigatorState> _navigator = GlobalKey<NavigatorState>();
  SessionController? _session;

  AppController get app => widget.app;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _session = widget.session ?? (widget.enableRemote && remoteConfig.isConfigured ? _createSession() : null);
    _session?.askUpload ??= _askUpload;
    if (_session != null && widget.session == null) WidgetsBinding.instance.addPostFrameCallback((_) => _session!.init());
  }

  SessionController _createSession() {
    final account = AccountService(url: remoteConfig.url, anonKey: remoteConfig.anonKey, storage: app.storage);
    final api = RemoteApi(url: remoteConfig.url, anonKey: remoteConfig.anonKey, getAccessToken: account.getAccessToken);
    return SessionController(app: app, auth: AuthService(api: api, storage: app.storage, account: account), api: api);
  }

  Future<bool> _askUpload() async {
    final context = _navigator.currentContext;
    if (context == null) return false;
    return await showDialog<bool>(
          context: context,
          builder: (ctx) => AlertDialog(
            content: Text(pick('La scheda in campagna è vuota. Vuoi caricarci la tua scheda locale?', 'The campaign sheet is empty. Do you want to upload your local sheet to it?')),
            actions: [
              TextButton(onPressed: () => Navigator.pop(ctx, false), child: Text(pick('No', 'No'))),
              FilledButton(onPressed: () => Navigator.pop(ctx, true), child: Text(pick('Sì', 'Yes'))),
            ],
          ),
        ) ??
        false;
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    app.isForeground = state == AppLifecycleState.resumed;
    // Salvataggio immediato se l'app va in secondo piano durante il ritardo di salvataggio.
    if (state == AppLifecycleState.paused || state == AppLifecycleState.inactive || state == AppLifecycleState.hidden) app.saveNow();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    if (widget.session == null) _session?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => ListenableBuilder(
        listenable: app,
        builder: (context, _) => MaterialApp(
          navigatorKey: _navigator,
          title: tr('Scheda Personaggio D&D 5E'),
          debugShowCheckedModeBanner: false,
          theme: buildTheme(Brightness.light),
          darkTheme: buildTheme(Brightness.dark),
          themeMode: app.themeMode,
          locale: Locale(app.language),
          localizationsDelegates: GlobalMaterialLocalizations.delegates,
          supportedLocales: [for (final l in supportedLanguages) Locale(l.code)],
          home: SheetPage(app: app, session: _session),
        ),
      );
}
