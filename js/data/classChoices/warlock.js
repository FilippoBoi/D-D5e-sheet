/**
 * Scelte del Warlock: Patrono Ultraterreno (1°), Suppliche Occulte (2°, numero crescente con prerequisiti),
 * Dono del Patto (3°) e Arcanum Mistico (11°-17°, testo breve: gli incantesimi non sono strutturati).
 *
 * Prerequisiti verificati sulla fonte (PHB): livello di warlock, Patto (4 suppliche) e, per tre
 * suppliche, il trucchetto Esplosione Occulta (non verificabile: resta una nota). Nessuna supplica
 * richiede un Patrono. Le suppliche con prerequisito non soddisfatto non si possono scegliere; se
 * lo perdono dopo (calo di livello, altro Patto) restano memorizzate, non contano e sono segnalate.
 *
 * Da verificare i nomi italiani di tutte le suppliche e di "Esplosione Occulta" (Eldritch Blast).
 *
 * Confermati dal progetto: "Arcifata", "Immondo", "Grande Antico", "Benedizione dell'Oscuro".
 * Da verificare: "Presenza Fatata", "Fuga Nebbiosa", "Difese Ammaliatrici", "Delirio Oscuro",
 * "Fortuna dell'Oscuro", "Resilienza Immonda", "Scagliare Attraverso l'Inferno", "Mente Risvegliata",
 * "Barriera Entropica", "Scudo Mentale", "Creare Thrall".
 */
const inv = (value, label, labelEn, description, descriptionEn, extra = {}) => ({
  value, label, labelEn, description, descriptionEn, ...extra,
});
const NONE = { group: 'Senza prerequisiti', groupEn: 'No prerequisites' };
const BLAST = {
  group: 'Richiedono Esplosione Occulta', groupEn: 'Require Eldritch Blast',
  prereqNote: 'Richiede il trucchetto Esplosione Occulta', prereqNoteEn: 'Requires the Eldritch Blast cantrip',
};
const lvl = (level) => ({ group: 'Richiedono un livello', groupEn: 'Require a level', prereq: { level } });
const pact = (value, level) => ({
  group: 'Richiedono un Patto', groupEn: 'Require a Pact',
  prereq: { ...(level ? { level } : {}), choice: { key: 'pactBoon', value } },
});

export default {
  choices: [
    {
      key: 'subclass', type: 'single', minLevel: 1, subclass: true,
      label: 'Patrono Ultraterreno', labelEn: 'Otherworldly Patron',
      options: [
        {
          value: 'archfey', label: 'Arcifata', labelEn: 'The Archfey',
          description: 'Un signore o una signora del Reame Fatato.', descriptionEn: 'A lord or lady of the fey.',
          features: [
            [1, 'Presenza Fatata', 'Azione: le creature in un cubo di 3 m sono affascinate o spaventate (TS su SAG), una volta per riposo.',
              'Fey Presence', 'Action: creatures in a 10-foot cube are charmed or frightened (Wisdom save), once per rest.'],
            [6, 'Fuga Nebbiosa', 'Reazione: dopo aver subito danni, ti teletrasporti di 18 m in una nube di nebbia.',
              'Misty Escape', 'Reaction: when damaged, teleport up to 60 feet in a puff of mist.'],
            [10, 'Difese Ammaliatrici', 'Immunità allo charme; reindirizzi un effetto di charme sull\'incantatore.',
              'Beguiling Defenses', 'Immune to being charmed; turn a charm effect back on its caster.'],
            [14, 'Delirio Oscuro', 'Immergi una creatura in un reame illusorio (charme o paura).',
              'Dark Delirium', 'Plunge a creature into an illusory realm (charmed or frightened).'],
          ],
        },
        {
          value: 'fiend', label: 'Immondo', labelEn: 'The Fiend',
          description: 'Un essere dei piani inferiori.', descriptionEn: 'A being of the lower planes.',
          features: [
            [1, 'Benedizione dell\'Oscuro', 'Se riduci a 0 PF una creatura ostile ottieni PF temporanei pari al mod. CAR + livello da warlock.',
              'Dark One\'s Blessing', 'When you reduce a hostile creature to 0 HP you gain temporary HP equal to Charisma modifier + warlock level.'],
            [6, 'Fortuna dell\'Oscuro', 'Aggiungi 1d10 a una prova di caratteristica o TS, una volta per riposo.',
              'Dark One\'s Own Luck', 'Add 1d10 to an ability check or saving throw, once per rest.'],
            [10, 'Resilienza Immonda', 'Dopo un riposo scegli un tipo di danno cui hai resistenza.',
              'Fiendish Resilience', 'After a rest choose a damage type to resist.'],
            [14, 'Scagliare Attraverso l\'Inferno', 'Quando colpisci, trasporti il bersaglio nei piani inferiori per un turno (10d10 danni psichici se non immune).',
              'Hurl Through Hell', 'When you hit, banish the target through the lower planes for a turn (10d10 psychic damage if not a fiend).'],
          ],
        },
        {
          value: 'greatOldOne', label: 'Grande Antico', labelEn: 'The Great Old One',
          description: 'Un\'entità aliena, oltre la comprensione.', descriptionEn: 'An alien entity beyond comprehension.',
          features: [
            [1, 'Mente Risvegliata', 'Comunichi telepaticamente con creature entro 9 m che capiscono una lingua.',
              'Awakened Mind', 'Communicate telepathically with creatures within 30 feet that understand a language.'],
            [6, 'Barriera Entropica', 'Reazione: svantaggio a un attacco contro di te; se manca ottieni vantaggio sul prossimo contro il bersaglio.',
              'Entropic Ward', 'Reaction: impose disadvantage on an attack against you; if it misses you gain advantage against the attacker.'],
            [10, 'Scudo Mentale', 'I tuoi pensieri non possono essere letti; resistenza ai danni psichici.',
              'Thought Shield', 'Your thoughts can\'t be read; resistance to psychic damage.'],
            [14, 'Creare Thrall', 'Tocchi un umanoide incapacitato: diventa tuo thrall (affascinato).',
              'Create Thrall', 'Touch an incapacitated humanoid: it becomes your thrall (charmed).'],
          ],
        },
      ],
    },
    {
      key: 'pactBoon', type: 'single', minLevel: 3, featureName: 'Dono del Patto', featureNameEn: 'Pact Boon',
      label: 'Dono del Patto', labelEn: 'Pact Boon',
      options: [
        { value: 'chain', label: 'Patto della Catena', labelEn: 'Pact of the Chain', description: 'Familiare speciale (imp, pseudodrago, quasit o folletto).', descriptionEn: 'A special familiar (imp, pseudodragon, quasit or sprite).' },
        { value: 'blade', label: 'Patto della Lama', labelEn: 'Pact of the Blade', description: 'Evochi un\'arma del patto e sei competente con essa.', descriptionEn: 'Summon a pact weapon and be proficient with it.' },
        { value: 'tome', label: 'Patto del Tomo', labelEn: 'Pact of the Tome', description: 'Un Libro delle Ombre con tre trucchetti da qualsiasi classe.', descriptionEn: 'A Book of Shadows with three cantrips from any class.' },
      ],
    },
    {
      key: 'invocations', type: 'multi', minLevel: 2, replacesFeature: true,
      count: [[2, 2], [5, 3], [7, 4], [9, 5], [12, 6], [15, 7], [18, 8]],
      label: 'Suppliche Occulte', labelEn: 'Eldritch Invocations',
      hint: 'Capacità magiche permanenti; alcune richiedono livello, Patto o un trucchetto.',
      hintEn: 'Permanent magical abilities; some require a level, a Pact or a cantrip.',
      options: [
        inv('armorOfShadows', 'Armatura d\'Ombra', 'Armor of Shadows', 'Armatura del Mago a volontà su te stesso.', 'Mage Armor on yourself at will.', NONE),
        inv('beastSpeech', 'Parlare con le Bestie', 'Beast Speech', 'Parlare con gli Animali a volontà.', 'Speak with Animals at will.', NONE),
        inv('beguilingInfluence', 'Influenza Ammaliatrice', 'Beguiling Influence', 'Competenza in Inganno e Persuasione.', 'Proficiency in Deception and Persuasion.', NONE),
        inv('devilsSight', 'Vista del Diavolo', 'Devil\'s Sight', 'Vedi normalmente fino a 36 m, anche nel buio magico.', 'See normally in darkness, magical or not, to 120 feet.', NONE),
        inv('eldritchSight', 'Vista Occulta', 'Eldritch Sight', 'Individuazione della Magia a volontà.', 'Detect Magic at will.', NONE),
        inv('eyesRuneKeeper', 'Occhi del Custode delle Rune', 'Eyes of the Rune Keeper', 'Leggi ogni scrittura.', 'Read all writing.', NONE),
        inv('fiendishVigor', 'Vigore Immondo', 'Fiendish Vigor', 'Falsa Vita su te stesso a volontà, come incantesimo di 1° livello.', 'False Life on yourself at will as a 1st-level spell.', NONE),
        inv('gazeTwoMinds', 'Sguardo di Due Menti', 'Gaze of Two Minds', 'Percepisci attraverso i sensi di un umanoide consenziente toccato.', 'Perceive through the senses of a willing humanoid you touch.', NONE),
        inv('maskManyFaces', 'Maschera dei Mille Volti', 'Mask of Many Faces', 'Camuffare Se Stesso a volontà.', 'Disguise Self at will.', NONE),
        inv('mistyVisions', 'Visioni Nebbiose', 'Misty Visions', 'Immagine Silenziosa a volontà.', 'Silent Image at will.', NONE),
        inv('thiefFiveFates', 'Ladro dei Cinque Fati', 'Thief of Five Fates', 'Anatema una volta per riposo lungo.', 'Bane once per long rest.', NONE),
        inv('agonizingBlast', 'Esplosione Agonizzante', 'Agonizing Blast', 'Aggiungi il mod. CAR ai danni di Esplosione Occulta.', 'Add your Charisma modifier to Eldritch Blast damage.', BLAST),
        inv('eldritchSpear', 'Lancia Occulta', 'Eldritch Spear', 'La gittata di Esplosione Occulta diventa 90 m.', 'Eldritch Blast range becomes 300 feet.', BLAST),
        inv('repellingBlast', 'Esplosione Respingente', 'Repelling Blast', 'Esplosione Occulta spinge il bersaglio di 3 m.', 'Eldritch Blast pushes the target up to 10 feet.', BLAST),
        inv('mireMind', 'Impantanare la Mente', 'Mire the Mind', 'Lentezza una volta per riposo lungo.', 'Slow once per long rest.', lvl(5)),
        inv('oneWithShadows', 'Uno con le Ombre', 'One with Shadows', 'Nella penombra o nel buio diventi invisibile finché non agisci.', 'In dim light or darkness become invisible until you act.', lvl(5)),
        inv('signIllOmen', 'Segno di Malaugurio', 'Sign of Ill Omen', 'Malia una volta per riposo lungo.', 'Bestow Curse once per long rest.', lvl(5)),
        inv('bewitchingWhispers', 'Sussurri Ammalianti', 'Bewitching Whispers', 'Costrizione una volta per riposo lungo.', 'Compulsion once per long rest.', lvl(7)),
        inv('dreadfulWord', 'Parola Terribile', 'Dreadful Word', 'Confusione una volta per riposo lungo.', 'Confusion once per long rest.', lvl(7)),
        inv('sculptorFlesh', 'Scultore di Carne', 'Sculptor of Flesh', 'Metamorfosi una volta per riposo lungo.', 'Polymorph once per long rest.', lvl(7)),
        inv('ascendantStep', 'Passo Ascendente', 'Ascendant Step', 'Levitazione su te stesso a volontà.', 'Levitate on yourself at will.', lvl(9)),
        inv('minionsChaos', 'Servitori del Caos', 'Minions of Chaos', 'Elementale Evocato una volta per riposo lungo.', 'Conjure Elemental once per long rest.', lvl(9)),
        inv('otherworldlyLeap', 'Balzo Ultraterreno', 'Otherworldly Leap', 'Saltare su te stesso a volontà.', 'Jump on yourself at will.', lvl(9)),
        inv('whispersGrave', 'Sussurri della Tomba', 'Whispers of the Grave', 'Parlare con i Morti a volontà.', 'Speak with Dead at will.', lvl(9)),
        inv('masterMyriadForms', 'Maestro delle Mille Forme', 'Master of Myriad Forms', 'Alterare Se Stesso a volontà.', 'Alter Self at will.', lvl(15)),
        inv('visionsDistantRealms', 'Visioni di Reami Lontani', 'Visions of Distant Realms', 'Occhio Arcano a volontà.', 'Arcane Eye at will.', lvl(15)),
        inv('witchSight', 'Vista della Strega', 'Witch Sight', 'Vedi la vera forma di mutaforma e illusioni entro 9 m.', 'See the true form of shapechangers and illusions within 30 feet.', lvl(15)),
        inv('bookAncientSecrets', 'Libro degli Antichi Segreti', 'Book of Ancient Secrets', 'Rituali nel Libro delle Ombre.', 'Ritual spells in your Book of Shadows.', pact('tome')),
        inv('voiceChainMaster', 'Voce del Maestro della Catena', 'Voice of the Chain Master', 'Comunichi con il familiare a distanza e ne percepisci i sensi.', 'Communicate with your familiar at any distance and perceive through it.', pact('chain')),
        inv('thirstingBlade', 'Lama Assetata', 'Thirsting Blade', 'Attacchi due volte con l\'arma del patto.', 'Attack twice with your pact weapon.', pact('blade', 5)),
        inv('lifedrinker', 'Bevitore di Vita', 'Lifedrinker', 'L\'arma del patto infligge danni necrotici extra pari al mod. CAR.', 'Your pact weapon deals extra necrotic damage equal to your Charisma modifier.', pact('blade', 12)),
        inv('chainsCarceri', 'Catene di Carceri', 'Chains of Carceri', 'Immobilizzare Mostri a volontà su celestiali, immondi o elementali.', 'Hold Monster at will on celestials, fiends or elementals.', pact('chain', 15)),
      ],
    },
    ...[[11, 6], [13, 7], [15, 8], [17, 9]].map(([minLevel, spellLevel]) => ({
      key: `arcanum${spellLevel}`, type: 'text', minLevel, featureName: `Arcanum Mistico (${spellLevel}° livello)`,
      featureNameEn: `Mystic Arcanum (${spellLevel}th level)`,
      label: `Arcanum Mistico (${spellLevel}° livello)`, labelEn: `Mystic Arcanum (${spellLevel}th level)`,
      hint: 'Annota l\'incantesimo scelto (non è verificato).', hintEn: 'Note the chosen spell (not validated).',
    })),
  ],
};
