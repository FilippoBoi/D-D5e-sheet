import 'package:material_ui/material_ui.dart';

/// Colori della scheda oltre a quelli di Material: oro, rubino, smeraldo e le tre soglie dei PF.
class SheetColors extends ThemeExtension<SheetColors> {
  const SheetColors({
    required this.accent, required this.accentStrong, required this.accentSoft, required this.vermilion,
    required this.emerald, required this.card, required this.cardRaised, required this.border,
    required this.borderStrong, required this.muted, required this.hpHigh, required this.hpMid, required this.hpLow,
  });

  final Color accent, accentStrong, accentSoft, vermilion, emerald, card, cardRaised, border, borderStrong, muted;
  final Color hpHigh, hpMid, hpLow;

  /// «Notte arcana»: scuro, predefinito.
  static const dark = SheetColors(
    accent: Color(0xFFC9A24B), accentStrong: Color(0xFFE8C97A), accentSoft: Color(0x24C9A24B), vermilion: Color(0xFF9B2335),
    emerald: Color(0xFF2F7F63), card: Color(0xFF1B1727), cardRaised: Color(0xFF251F36), border: Color(0xFF35294D),
    borderStrong: Color(0xFF54447A), muted: Color(0xFFAFA5C4), hpHigh: Color(0xFF6FCFA3), hpMid: Color(0xFFE8C97A), hpLow: Color(0xFFFF8FA0),
  );

  /// «Pergamena»: chiaro.
  static const light = SheetColors(
    accent: Color(0xFF9A7220), accentStrong: Color(0xFF6F4E0C), accentSoft: Color(0x249A7220), vermilion: Color(0xFF8E2433),
    emerald: Color(0xFF2E6B4F), card: Color(0xFFF7EFD9), cardRaised: Color(0xFFEFE3C6), border: Color(0xFFD2BD8E),
    borderStrong: Color(0xFFAD935A), muted: Color(0xFF65543A), hpHigh: Color(0xFF1F5A40), hpMid: Color(0xFF6F4E0C), hpLow: Color(0xFF8E2433),
  );

  @override
  SheetColors copyWith() => this;

  @override
  SheetColors lerp(ThemeExtension<SheetColors>? other, double t) => t < 0.5 ? this : (other as SheetColors? ?? this);
}

extension SheetColorsX on BuildContext {
  SheetColors get colors => Theme.of(this).extension<SheetColors>()!;
}

const _display = 'serif';

ThemeData buildTheme(Brightness brightness) {
  final dark = brightness == Brightness.dark;
  final c = dark ? SheetColors.dark : SheetColors.light;
  final bg = dark ? const Color(0xFF120F1C) : const Color(0xFFE9DCBC);
  final input = dark ? const Color(0xFF151120) : const Color(0xFFFCF7E9);
  final text = dark ? const Color(0xFFEFE6D2) : const Color(0xFF2B1F12);
  final scheme = ColorScheme(
    brightness: brightness,
    primary: c.accent, onPrimary: dark ? const Color(0xFF120F1C) : Colors.white,
    secondary: c.emerald, onSecondary: Colors.white,
    error: c.vermilion, onError: Colors.white,
    surface: c.card, onSurface: text,
    outline: c.borderStrong, outlineVariant: c.border,
    surfaceContainerHighest: c.cardRaised,
  );
  final outline = OutlineInputBorder(borderRadius: BorderRadius.circular(6), borderSide: BorderSide(color: c.borderStrong));
  return ThemeData(
    useMaterial3: true,
    colorScheme: scheme,
    scaffoldBackgroundColor: bg,
    extensions: [c],
    visualDensity: VisualDensity.standard,
    // Bersagli di tocco di almeno 48 px anche su web e desktop (tablet con tastiera, S Pen).
    materialTapTargetSize: MaterialTapTargetSize.padded,
    textTheme: Typography.material2021().black.apply(bodyColor: text, displayColor: text, fontFamily: null),
    inputDecorationTheme: InputDecorationTheme(
      filled: true, fillColor: input, isDense: true,
      contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 12),
      border: outline, enabledBorder: outline,
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(6), borderSide: BorderSide(color: c.accentStrong, width: 2)),
      labelStyle: TextStyle(color: c.muted),
    ),
    cardTheme: CardThemeData(
      color: c.card, elevation: 0, margin: EdgeInsets.zero,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10), side: BorderSide(color: c.border)),
    ),
    dividerColor: c.border,
    dialogTheme: DialogThemeData(backgroundColor: c.card, shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10), side: BorderSide(color: c.borderStrong))),
    filledButtonTheme: FilledButtonThemeData(style: FilledButton.styleFrom(minimumSize: const Size(48, 48))),
    outlinedButtonTheme: OutlinedButtonThemeData(style: OutlinedButton.styleFrom(minimumSize: const Size(48, 48), side: BorderSide(color: c.borderStrong))),
    textButtonTheme: TextButtonThemeData(style: TextButton.styleFrom(minimumSize: const Size(48, 48))),
    iconButtonTheme: IconButtonThemeData(style: IconButton.styleFrom(minimumSize: const Size(48, 48))),
    checkboxTheme: CheckboxThemeData(fillColor: WidgetStateProperty.resolveWith((s) => s.contains(WidgetState.selected) ? c.accent : null)),
  );
}

TextStyle displayStyle(BuildContext context, {double size = 18}) =>
    TextStyle(fontFamily: _display, fontSize: size, fontWeight: FontWeight.w700, color: context.colors.accentStrong, letterSpacing: 0.4);
