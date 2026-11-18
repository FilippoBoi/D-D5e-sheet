import 'dart:io';

import 'package:dnd5e_sheet/data/catalog.dart';
import 'package:dnd5e_sheet/i18n.dart';

/// Carica il catalogo dai file in assets/data (i test girano con la cartella flutter/ come corrente).
Catalog loadTestCatalog() {
  final files = {for (final name in catalogFiles) name: File('assets/data/$name').readAsStringSync()};
  final catalog = Catalog.parse(files);
  Catalog.instance = catalog;
  setUiDictionary(catalog.uiEn);
  return catalog;
}
