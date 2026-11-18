/**
 * Privilegi di classe del Manuale del Giocatore, livello per livello.
 * Formato compatto: [livello, nome, descrizione breve].
 *
 * I privilegi delle sottoclassi (Cammino, Dominio, Archetipo...) sono indicati
 * in modo generico perché dipendono dalla scelta del giocatore.
 */

import { getLang } from '../i18n/i18n.js';
import { RAW_FEATURES_EN } from './classFeatures.en.js';

const ASI_NAME = 'Aumento dei Punteggi di Caratteristica';
const ASI_DESC = 'Aumenta una caratteristica di 2 o due caratteristiche di 1 (max 20), oppure scegli un talento.';
const asi = (level) => [level, ASI_NAME, ASI_DESC];

/** Privilegio generico di sottoclasse. */
const sub = (level, name, label) => [level, name, `Ottieni un nuovo privilegio del tuo ${label}.`, 'sub'];

const RAW_FEATURES = {
  barbarian: [
    [1, 'Ira', 'Azione bonus: vantaggio a prove e TS di Forza, bonus ai danni in mischia con Forza, resistenza ai danni contundenti, perforanti e taglienti.'],
    [1, 'Difesa senza Armatura', 'Senza armatura la CA è 10 + mod. DES + mod. COS. Lo scudo è consentito.'],
    [2, 'Attacco Irruento', 'Vantaggio ai tiri per colpire in mischia con Forza in questo turno; fino al tuo prossimo turno i nemici hanno vantaggio contro di te.'],
    [2, 'Percezione del Pericolo', 'Vantaggio ai TS di Destrezza contro effetti che puoi vedere.'],
    [3, 'Cammino Primordiale', 'Scegli un cammino (es. Berserker, Guerriero Totemico) con privilegi al 3°, 6°, 10° e 14° livello.'],
    asi(4),
    [5, 'Attacco Extra', 'Attacchi due volte quando effettui l\'azione di Attacco.'],
    [5, 'Movimento Veloce', '+3 metri di velocità se non indossi un\'armatura pesante.'],
    sub(6, 'Privilegio del Cammino', 'Cammino Primordiale'),
    [7, 'Istinto Ferino', 'Vantaggio all\'iniziativa; se sei sorpreso puoi agire entrando in ira.'],
    asi(8),
    [9, 'Critico Brutale (1 dado)', 'Tira un dado di danno dell\'arma in più sui colpi critici in mischia.'],
    sub(10, 'Privilegio del Cammino', 'Cammino Primordiale'),
    [11, 'Ira Implacabile', 'Se scendi a 0 PF in ira, TS su COS (CD 10, +5 per ogni uso) per restare a 1 PF.'],
    asi(12),
    [13, 'Critico Brutale (2 dadi)', 'Due dadi di danno extra sui colpi critici in mischia.'],
    sub(14, 'Privilegio del Cammino', 'Cammino Primordiale'),
    [15, 'Ira Persistente', 'L\'ira termina prima solo se perdi i sensi o scegli di terminarla.'],
    asi(16),
    [17, 'Critico Brutale (3 dadi)', 'Tre dadi di danno extra sui colpi critici in mischia.'],
    [18, 'Potenza Indomabile', 'Se una prova di Forza è inferiore al tuo punteggio di Forza, puoi usare il punteggio.'],
    asi(19),
    [20, 'Campione Primordiale', 'Forza e Costituzione aumentano di 4 (massimo 24).'],
  ],
  bard: [
    [1, 'Incantesimi', 'Lanci incantesimi da bardo usando il Carisma.'],
    [1, 'Ispirazione Bardica', 'Azione bonus: un alleato ottiene un dado da aggiungere a una prova, un attacco o un TS.'],
    [2, 'Factotum', 'Aggiungi metà bonus di competenza alle prove di caratteristica in cui non sei competente.'],
    [2, 'Canto di Riposo', 'Durante un riposo breve gli alleati recuperano PF extra.'],
    [3, 'Collegio Bardico', 'Scegli un collegio (es. Sapienza, Valore) con privilegi al 3°, 6° e 14° livello.'],
    [3, 'Maestria', 'Raddoppia il bonus di competenza per due abilità in cui sei competente.'],
    asi(4),
    [5, 'Fonte di Ispirazione', 'Recuperi l\'Ispirazione Bardica anche con un riposo breve.'],
    [6, 'Controfascino', 'Azione: tu e gli alleati vicini avete vantaggio ai TS contro paura e charme.'],
    sub(6, 'Privilegio del Collegio', 'Collegio Bardico'),
    asi(8),
    [10, 'Maestria', 'Scegli altre due abilità per la Maestria.'],
    [10, 'Segreti Magici', 'Impari due incantesimi da qualsiasi lista di classe.'],
    asi(12),
    [14, 'Segreti Magici', 'Impari altri due incantesimi da qualsiasi lista.'],
    sub(14, 'Privilegio del Collegio', 'Collegio Bardico'),
    asi(16),
    [18, 'Segreti Magici', 'Impari altri due incantesimi da qualsiasi lista.'],
    asi(19),
    [20, 'Ispirazione Superiore', 'Se tiri l\'iniziativa senza Ispirazione Bardica, ne recuperi un uso.'],
  ],
  cleric: [
    [1, 'Incantesimi', 'Lanci incantesimi da chierico usando la Saggezza.'],
    [1, 'Dominio Divino', 'Scegli un dominio (es. Vita, Luce, Guerra) con incantesimi e privilegi dedicati.'],
    [2, 'Incanalare Divinità', 'Usi l\'energia divina per effetti come Scacciare Non Morti e il potere del dominio.'],
    [2, 'Scacciare Non Morti', 'I non morti entro 9 m che falliscono un TS su SAG sono scacciati per 1 minuto.'],
    sub(2, 'Privilegio del Dominio', 'Dominio Divino'),
    asi(4),
    [5, 'Distruggere Non Morti', 'I non morti di GS basso che falliscono il TS vengono distrutti.'],
    sub(6, 'Privilegio del Dominio', 'Dominio Divino'),
    asi(8),
    sub(8, 'Privilegio del Dominio', 'Dominio Divino'),
    [10, 'Intervento Divino', 'Implori l\'aiuto della tua divinità: riesce se tiri d100 ≤ al tuo livello.'],
    asi(12),
    asi(16),
    sub(17, 'Privilegio del Dominio', 'Dominio Divino'),
    asi(19),
    [20, 'Intervento Divino Migliorato', 'L\'Intervento Divino riesce automaticamente.'],
  ],
  druid: [
    [1, 'Druidico', 'Conosci la lingua segreta dei druidi.'],
    [1, 'Incantesimi', 'Lanci incantesimi da druido usando la Saggezza.'],
    [2, 'Forma Selvatica', 'Azione: assumi la forma di una bestia che hai già visto, due volte per riposo.'],
    [2, 'Circolo Druidico', 'Scegli un circolo (es. Terra, Luna) con privilegi al 2°, 6°, 10° e 14° livello.'],
    [4, 'Forma Selvatica Migliorata', 'Puoi trasformarti in bestie con velocità di nuoto (GS max 1/2).'],
    asi(4),
    sub(6, 'Privilegio del Circolo', 'Circolo Druidico'),
    [8, 'Forma Selvatica Migliorata', 'Puoi trasformarti in bestie con velocità di volo (GS max 1).'],
    asi(8),
    sub(10, 'Privilegio del Circolo', 'Circolo Druidico'),
    asi(12),
    sub(14, 'Privilegio del Circolo', 'Circolo Druidico'),
    asi(16),
    [18, 'Corpo Senza Tempo', 'Invecchi di un anno ogni dieci.'],
    [18, 'Incantesimi Bestiali', 'Puoi lanciare incantesimi mentre sei in Forma Selvatica.'],
    asi(19),
    [20, 'Arcidruido', 'Usi la Forma Selvatica senza limiti e ignori le componenti verbali e somatiche.'],
  ],
  fighter: [
    [1, 'Stile di Combattimento', 'Scegli uno stile (es. Difesa, Duellare, Tiro) che ti dà un bonus permanente.'],
    [1, 'Recuperare Energie', 'Azione bonus: recuperi 1d10 + livello da guerriero PF, una volta per riposo.'],
    [2, 'Azione Impetuosa', 'Nel tuo turno puoi effettuare un\'azione aggiuntiva, una volta per riposo.'],
    [3, 'Archetipo Marziale', 'Scegli un archetipo (es. Campione, Maestro di Battaglia, Cavaliere Mistico).'],
    asi(4),
    [5, 'Attacco Extra', 'Attacchi due volte quando effettui l\'azione di Attacco.'],
    asi(6),
    sub(7, 'Privilegio dell\'Archetipo', 'Archetipo Marziale'),
    asi(8),
    [9, 'Indomito', 'Puoi ripetere un tiro salvezza fallito, una volta per riposo lungo.'],
    sub(10, 'Privilegio dell\'Archetipo', 'Archetipo Marziale'),
    [11, 'Attacco Extra (2)', 'Attacchi tre volte quando effettui l\'azione di Attacco.'],
    asi(12),
    [13, 'Indomito (2 usi)', 'Puoi usare Indomito due volte per riposo lungo.'],
    asi(14),
    sub(15, 'Privilegio dell\'Archetipo', 'Archetipo Marziale'),
    asi(16),
    [17, 'Azione Impetuosa (2 usi)', 'Due usi per riposo, ma solo uno per turno.'],
    [17, 'Indomito (3 usi)', 'Puoi usare Indomito tre volte per riposo lungo.'],
    sub(18, 'Privilegio dell\'Archetipo', 'Archetipo Marziale'),
    asi(19),
    [20, 'Attacco Extra (3)', 'Attacchi quattro volte quando effettui l\'azione di Attacco.'],
  ],
  rogue: [
    [1, 'Maestria', 'Raddoppia il bonus di competenza per due abilità (o una e gli arnesi da scasso).'],
    [1, 'Attacco Furtivo', 'Una volta per turno infliggi danni extra se hai vantaggio o un alleato è vicino al bersaglio.'],
    [1, 'Gergo Ladresco', 'Conosci il linguaggio segreto dei ladri.'],
    [2, 'Azione Scaltra', 'Azione bonus: Scattare, Disimpegno o Nascondersi.'],
    [3, 'Archetipo Ladresco', 'Scegli un archetipo (es. Ladro, Assassino, Mistificatore Arcano).'],
    asi(4),
    [5, 'Schivata Prodigiosa', 'Reazione: dimezzi i danni di un attacco che ti colpisce.'],
    [6, 'Maestria', 'Scegli altre due competenze per la Maestria.'],
    [7, 'Elusione', 'Nei TS su DES per dimezzare i danni: nessun danno se riesci, metà se fallisci.'],
    asi(8),
    sub(9, 'Privilegio dell\'Archetipo', 'Archetipo Ladresco'),
    asi(10),
    [11, 'Talento Affidabile', 'Nelle prove con competenza, un risultato di 9 o meno sul d20 conta come 10.'],
    asi(12),
    sub(13, 'Privilegio dell\'Archetipo', 'Archetipo Ladresco'),
    [14, 'Percezione Cieca', 'Percepisci le creature nascoste o invisibili entro 3 metri.'],
    [15, 'Mente Sfuggente', 'Ottieni competenza nei tiri salvezza su Saggezza.'],
    asi(16),
    sub(17, 'Privilegio dell\'Archetipo', 'Archetipo Ladresco'),
    [18, 'Inafferrabile', 'Nessun attacco ha vantaggio contro di te finché non sei incapacitato.'],
    asi(19),
    [20, 'Colpo di Fortuna', 'Trasformi un attacco mancato in un colpo o una prova fallita in un 20, una volta per riposo.'],
  ],
  wizard: [
    [1, 'Incantesimi', 'Lanci incantesimi da mago usando l\'Intelligenza, dal tuo libro degli incantesimi.'],
    [1, 'Recupero Arcano', 'Durante un riposo breve recuperi slot per un totale pari a metà livello da mago.'],
    [2, 'Tradizione Arcana', 'Scegli una scuola di magia (es. Evocazione, Abiurazione).'],
    asi(4),
    sub(6, 'Privilegio della Tradizione', 'Tradizione Arcana'),
    asi(8),
    sub(10, 'Privilegio della Tradizione', 'Tradizione Arcana'),
    asi(12),
    sub(14, 'Privilegio della Tradizione', 'Tradizione Arcana'),
    asi(16),
    [18, 'Padronanza degli Incantesimi', 'Lanci a volontà un incantesimo di 1° e uno di 2° livello.'],
    asi(19),
    [20, 'Incantesimi Distintivi', 'Due incantesimi di 3° livello sempre preparati, lanciabili gratis una volta per riposo.'],
  ],
  monk: [
    [1, 'Difesa senza Armatura', 'Senza armatura né scudo la CA è 10 + mod. DES + mod. SAG.'],
    [1, 'Arti Marziali', 'Usi DES per i colpi senz\'armi e le armi da monaco; colpo senz\'armi come azione bonus.'],
    [2, 'Ki', 'Spendi punti ki per Raffica di Colpi, Difesa Paziente e Passo del Vento.'],
    [2, 'Movimento senza Armatura', 'La tua velocità aumenta se non indossi armatura né scudo.'],
    [3, 'Tradizione Monastica', 'Scegli una tradizione (es. Mano Aperta, Ombra, Quattro Elementi).'],
    [3, 'Deviare Proiettili', 'Reazione: riduci i danni di un attacco a distanza e puoi rilanciare il proiettile.'],
    asi(4),
    [4, 'Caduta Lenta', 'Reazione: riduci i danni da caduta di 5 × il tuo livello da monaco.'],
    [5, 'Attacco Extra', 'Attacchi due volte quando effettui l\'azione di Attacco.'],
    [5, 'Colpo Stordente', 'Spendi 1 ki: il bersaglio colpito deve superare un TS su COS o è stordito.'],
    [6, 'Colpi Potenziati dal Ki', 'I tuoi colpi senz\'armi contano come magici.'],
    sub(6, 'Privilegio della Tradizione', 'Tradizione Monastica'),
    [7, 'Elusione', 'Nei TS su DES per dimezzare i danni: nessun danno se riesci, metà se fallisci.'],
    [7, 'Quiete della Mente', 'Azione: termini un effetto di charme o paura su di te.'],
    asi(8),
    [9, 'Movimento senza Armatura Migliorato', 'Puoi muoverti su superfici verticali e sui liquidi.'],
    [10, 'Purezza del Corpo', 'Sei immune a malattie e veleno.'],
    sub(11, 'Privilegio della Tradizione', 'Tradizione Monastica'),
    asi(12),
    [13, 'Lingua del Sole e della Luna', 'Comprendi tutte le lingue parlate e ti fai capire da chiunque.'],
    [14, 'Anima di Diamante', 'Competenza in tutti i TS; spendi 1 ki per ritirare un TS fallito.'],
    [15, 'Corpo Senza Tempo', 'Non soffri gli effetti dell\'età e non hai bisogno di cibo né acqua.'],
    asi(16),
    sub(17, 'Privilegio della Tradizione', 'Tradizione Monastica'),
    [18, 'Corpo Vuoto', 'Spendi ki per diventare invisibile o proiettarti nel Piano Astrale.'],
    asi(19),
    [20, 'Perfezione Interiore', 'Se tiri l\'iniziativa senza punti ki, ne recuperi 4.'],
  ],
  paladin: [
    [1, 'Percezione del Divino', 'Percepisci celestiali, immondi e non morti entro 18 metri.'],
    [1, 'Imposizione delle Mani', 'Riserva di guarigione pari a 5 × livello da paladino.'],
    [2, 'Stile di Combattimento', 'Scegli uno stile (es. Difesa, Duellare, Protezione).'],
    [2, 'Incantesimi', 'Lanci incantesimi da paladino usando il Carisma.'],
    [2, 'Punizione Divina', 'Spendi uno slot quando colpisci: +2d8 radiosi (+1d8 per livello di slot).'],
    [3, 'Salute Divina', 'Sei immune alle malattie.'],
    [3, 'Giuramento Sacro', 'Presti un giuramento (es. Devozione, Antichi, Vendetta) con Incanalare Divinità.'],
    asi(4),
    [5, 'Attacco Extra', 'Attacchi due volte quando effettui l\'azione di Attacco.'],
    [6, 'Aura di Protezione', 'Tu e gli alleati entro 3 m aggiungete il tuo mod. CAR ai tiri salvezza.'],
    sub(7, 'Privilegio del Giuramento', 'Giuramento Sacro'),
    asi(8),
    [10, 'Aura di Coraggio', 'Tu e gli alleati entro 3 m non potete essere spaventati.'],
    [11, 'Punizione Divina Migliorata', 'I tuoi attacchi in mischia infliggono 1d8 danni radiosi extra.'],
    asi(12),
    [14, 'Tocco Purificatore', 'Azione: termini un incantesimo su una creatura toccata.'],
    sub(15, 'Privilegio del Giuramento', 'Giuramento Sacro'),
    asi(16),
    [18, 'Miglioramenti dell\'Aura', 'Le tue aure si estendono a 9 metri.'],
    asi(19),
    sub(20, 'Privilegio del Giuramento', 'Giuramento Sacro'),
  ],
  ranger: [
    [1, 'Nemico Prescelto', 'Vantaggio a seguire le tracce e ricordare informazioni sui nemici scelti.'],
    [1, 'Esploratore Nato', 'Vantaggi di viaggio ed esplorazione nel terreno prescelto.'],
    [2, 'Stile di Combattimento', 'Scegli uno stile (es. Tiro, Difesa, Combattere con Due Armi).'],
    [2, 'Incantesimi', 'Lanci incantesimi da ranger usando la Saggezza.'],
    [3, 'Archetipo Ranger', 'Scegli un archetipo (es. Cacciatore, Signore delle Bestie).'],
    [3, 'Consapevolezza Primordiale', 'Spendi uno slot per percepire certi tipi di creature nei dintorni.'],
    asi(4),
    [5, 'Attacco Extra', 'Attacchi due volte quando effettui l\'azione di Attacco.'],
    [6, 'Nemico Prescelto ed Esploratore Nato Migliorati', 'Scegli un nemico prescelto e un terreno prescelto aggiuntivi.'],
    sub(7, 'Privilegio dell\'Archetipo', 'Archetipo Ranger'),
    asi(8),
    [8, 'Andatura sul Territorio', 'Il terreno difficile non magico non ti rallenta.'],
    [10, 'Nascondersi in Piena Vista', 'Ti mimetizzi ottenendo +10 alle prove di Furtività.'],
    sub(11, 'Privilegio dell\'Archetipo', 'Archetipo Ranger'),
    asi(12),
    [14, 'Svanire', 'Nasconderti è un\'azione bonus e non puoi essere seguito con mezzi non magici.'],
    sub(15, 'Privilegio dell\'Archetipo', 'Archetipo Ranger'),
    asi(16),
    [18, 'Sensi Ferini', 'Percepisci le creature invisibili entro 9 metri.'],
    asi(19),
    [20, 'Sterminatore di Nemici', 'Una volta per turno aggiungi il mod. SAG a un attacco o ai danni contro un nemico prescelto.'],
  ],
  sorcerer: [
    [1, 'Incantesimi', 'Lanci incantesimi da stregone usando il Carisma.'],
    [1, 'Origine Stregonesca', 'Scegli l\'origine del tuo potere (es. Discendenza Draconica, Magia Selvaggia).'],
    [2, 'Fonte della Magia', 'Usi i punti stregoneria e puoi convertirli in slot e viceversa.'],
    [3, 'Metamagia', 'Scegli due opzioni di Metamagia per modificare gli incantesimi.'],
    asi(4),
    sub(6, 'Privilegio dell\'Origine', 'Origine Stregonesca'),
    asi(8),
    [10, 'Metamagia', 'Impari un\'altra opzione di Metamagia.'],
    asi(12),
    sub(14, 'Privilegio dell\'Origine', 'Origine Stregonesca'),
    asi(16),
    [17, 'Metamagia', 'Impari un\'altra opzione di Metamagia.'],
    sub(18, 'Privilegio dell\'Origine', 'Origine Stregonesca'),
    asi(19),
    [20, 'Ripristino Stregonesco', 'Recuperi 4 punti stregoneria con un riposo breve.'],
  ],
  warlock: [
    [1, 'Patrono Ultraterreno', 'Stringi un patto con un patrono (es. Arcifata, Immondo, Grande Antico).'],
    [1, 'Magia del Patto', 'Slot tutti dello stesso livello, recuperati con un riposo breve. Usi il Carisma.'],
    [2, 'Suppliche Occulte', 'Impari suppliche che conferiscono capacità magiche permanenti.'],
    [3, 'Dono del Patto', 'Scegli il Patto della Catena, della Lama o del Tomo.'],
    asi(4),
    sub(6, 'Privilegio del Patrono', 'Patrono Ultraterreno'),
    asi(8),
    sub(10, 'Privilegio del Patrono', 'Patrono Ultraterreno'),
    [11, 'Arcanum Mistico (6° livello)', 'Lanci un incantesimo di 6° livello una volta per riposo lungo.'],
    asi(12),
    [13, 'Arcanum Mistico (7° livello)', 'Lanci un incantesimo di 7° livello una volta per riposo lungo.'],
    sub(14, 'Privilegio del Patrono', 'Patrono Ultraterreno'),
    [15, 'Arcanum Mistico (8° livello)', 'Lanci un incantesimo di 8° livello una volta per riposo lungo.'],
    asi(16),
    [17, 'Arcanum Mistico (9° livello)', 'Lanci un incantesimo di 9° livello una volta per riposo lungo.'],
    asi(19),
    [20, 'Maestro dell\'Occulto', 'Con 1 minuto di suppliche al patrono recuperi tutti gli slot del patto.'],
  ],
};

/** Converte le tuple compatte in oggetti immutabili, una sola volta al caricamento. */
const freezeFeatures = (raw) => Object.freeze(
  Object.fromEntries(
    Object.entries(raw).map(([classId, list]) => [
      classId,
      Object.freeze(list.map(([level, name, description, kind]) => Object.freeze(
        kind === 'sub' ? { level, name, description, generic: true } : { level, name, description },
      ))),
    ]),
  ),
);

export const CLASS_FEATURES = freezeFeatures(RAW_FEATURES);
export const CLASS_FEATURES_EN = freezeFeatures(RAW_FEATURES_EN);
export { RAW_FEATURES };

/**
 * Privilegi sbloccati da una classe fino al livello indicato (incluso),
 * nella lingua corrente.
 *
 * Con `subclassFeatures` (sottoclasse nota) i privilegi generici "del Cammino / Dominio..."
 * sono sostituiti da quelli dell'opzione scelta. Le `picks` sostituiscono o integrano la riga
 * di classe con lo stesso nome (es. "Stile di Combattimento: Difesa"); se non c'è, si aggiungono.
 * @param {string} classId
 * @param {number} level
 * @param {{ subclassFeatures?: Array | null, picks?: Array }} [choices]
 */
export function getClassFeatures(classId, level, { subclassFeatures = null, picks = [] } = {}) {
  const source = getLang() === 'en' ? CLASS_FEATURES_EN : CLASS_FEATURES;
  const rows = (source[classId] ?? [])
    .filter((f) => f.level <= level && !(subclassFeatures && f.generic))
    .map((f) => ({ ...f }));
  if (subclassFeatures) rows.push(...subclassFeatures.filter((f) => f.level <= level));
  const used = new Set();
  for (const p of picks) {
    const target = p.replaces
      ? rows.find((r) => r.level === p.level && r.name === p.replaces && !used.has(r))
      : null;
    if (target) {
      used.add(target);
      if (p.append) target.description = `${target.description} ${p.description}`;
      else { target.name = p.name; target.description = p.description; }
    } else {
      rows.push({ level: p.level, name: p.name, description: p.description });
    }
  }
  return rows.sort((a, b) => a.level - b.level);
}
