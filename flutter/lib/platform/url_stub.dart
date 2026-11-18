/// Indirizzo di avvio dell'app: sul web contiene il frammento del link dell'email (#access_token=…) e il token (?t=…).
Uri get launchUri => Uri.base;

/// Sul web toglie dalla barra degli indirizzi token e sessione (restano nella cronologia del browser); altrove non fa nulla.
void cleanLaunchUrl() {}
