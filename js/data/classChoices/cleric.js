/**
 * Scelte del Chierico: Dominio Divino (1° livello), 7 domini del PHB (5e.tools).
 *
 * `features`: [livello, nome, descrizione, nameEn, descriptionEn]. Le descrizioni sono sintesi.
 * Gli incantesimi di dominio sono citati nel testo, non strutturati (fuori ambito).
 *
 * Termini italiani da verificare sul PHB italiano: i nomi dei privilegi di dominio
 * (es. "Lampo Difensivo", "Colpo Divino", "Nato dalla Tempesta", "Benedizione dell'Ingannatore").
 */
const CHANNEL = 'Incanalare Divinità';
const CHANNEL_EN = 'Channel Divinity';
const DIVINE_STRIKE = ['Colpo Divino', 'Divine Strike'];

const divineStrike = (type, typeEn) => [8, DIVINE_STRIKE[0],
  `Una volta per turno un colpo con arma infligge 1d8 danni da ${type} extra (2d8 dal 14°).`,
  DIVINE_STRIKE[1], `Once per turn a weapon hit deals an extra 1d8 ${typeEn} damage (2d8 from 14th level).`];
const potent = [8, 'Incantesimi Potenti', 'Aggiungi il mod. SAG ai danni dei trucchetti da chierico.',
  'Potent Spellcasting', 'Add your Wisdom modifier to the damage of your cleric cantrips.'];

export default {
  choices: [
    {
      key: 'subclass', type: 'single', minLevel: 1, subclass: true,
      label: 'Dominio Divino', labelEn: 'Divine Domain',
      options: [
        {
          value: 'knowledge', label: 'Conoscenza', labelEn: 'Knowledge',
          description: 'Dèi dello studio e del sapere.', descriptionEn: 'Gods of learning and understanding.',
          features: [
            [1, 'Benedizioni della Conoscenza', 'Impari due lingue e hai competenza in due tra Arcano, Storia, Natura e Religione, con Maestria in quelle abilità.',
              'Blessings of Knowledge', 'You learn two languages and gain proficiency, with expertise, in two of Arcana, History, Nature and Religion.'],
            [2, `${CHANNEL}: Conoscenza dei Secoli`, 'Ottieni per 10 minuti competenza in un\'abilità o strumento a scelta.',
              `${CHANNEL_EN}: Knowledge of the Ages`, 'Gain proficiency in a skill or tool of your choice for 10 minutes.'],
            [6, `${CHANNEL}: Leggere i Pensieri`, 'Leggi i pensieri di una creatura e puoi lanciare Suggestione su di essa.',
              `${CHANNEL_EN}: Read Thoughts`, 'Read a creature\'s thoughts and cast Suggestion on it.'],
            potent,
            [17, 'Visioni del Passato', 'Evochi visioni legate a un oggetto o all\'ambiente circostante.',
              'Visions of the Past', 'Call up visions tied to an object you hold or your surroundings.'],
          ],
        },
        {
          value: 'life', label: 'Vita', labelEn: 'Life',
          description: 'Dèi della guarigione e della vitalità.', descriptionEn: 'Gods of healing and vitality.',
          features: [
            [1, 'Competenza Bonus', 'Competenza con le armature pesanti.', 'Bonus Proficiency', 'Proficiency with heavy armor.'],
            [1, 'Discepolo della Vita', 'Gli incantesimi di guarigione curano 2 + livello dell\'incantesimo PF in più.',
              'Disciple of Life', 'Healing spells restore an extra 2 + the spell\'s level hit points.'],
            [2, `${CHANNEL}: Preservare la Vita`, 'Ripartisci 5 × livello da chierico PF tra le creature vicine.',
              `${CHANNEL_EN}: Preserve Life`, 'Distribute 5 × cleric level hit points among nearby creatures.'],
            [6, 'Guaritore Benedetto', 'Curando altri, curi anche te stesso.', 'Blessed Healer', 'Healing others also heals you.'],
            divineStrike('radianti', 'radiant'),
            [17, 'Guarigione Suprema', 'I dadi di guarigione danno sempre il massimo.', 'Supreme Healing', 'Healing dice always give their maximum.'],
          ],
        },
        {
          value: 'light', label: 'Luce', labelEn: 'Light',
          description: 'Dèi della luce e del fuoco.', descriptionEn: 'Gods of light and fire.',
          features: [
            [1, 'Trucchetto Bonus', 'Impari il trucchetto Luce.', 'Bonus Cantrip', 'You learn the Light cantrip.'],
            [1, 'Lampo Difensivo', 'Reazione: imponi svantaggio a un attacco contro di te (SAG volte per riposo lungo).',
              'Warding Flare', 'Reaction: impose disadvantage on an attack against you (Wisdom modifier times per long rest).'],
            [2, `${CHANNEL}: Radiosità dell'Alba`, 'Dissipi le tenebre magiche e infliggi danni radiosi alle creature vicine.',
              `${CHANNEL_EN}: Radiance of the Dawn`, 'Dispel magical darkness and deal radiant damage to nearby creatures.'],
            [6, 'Lampo Difensivo Migliorato', 'Lo usi anche per proteggere gli alleati entro 9 m.', 'Improved Flare', 'Also usable to protect allies within 30 feet.'],
            potent,
            [17, 'Corona di Luce', 'Aura di luce solare che dà svantaggio ai TS dei nemici contro i tuoi incantesimi di fuoco o radiosi.',
              'Corona of Light', 'Aura of sunlight that gives enemies disadvantage on saves against your fire and radiant spells.'],
          ],
        },
        {
          value: 'nature', label: 'Natura', labelEn: 'Nature',
          description: 'Dèi della natura e della vita selvaggia.', descriptionEn: 'Gods of nature and the wilds.',
          features: [
            [1, 'Accolito della Natura', 'Impari un trucchetto da druido e hai competenza in un\'abilità tra Addestrare Animali, Natura e Sopravvivenza.',
              'Acolyte of Nature', 'Learn a druid cantrip and gain proficiency in Animal Handling, Nature or Survival.'],
            [1, 'Competenza Bonus', 'Competenza con le armature pesanti.', 'Bonus Proficiency', 'Proficiency with heavy armor.'],
            [2, `${CHANNEL}: Affascinare Animali e Piante`, 'Affascini bestie e vegetali che falliscono un TS su SAG.',
              `${CHANNEL_EN}: Charm Animals and Plants`, 'Charm beasts and plants that fail a Wisdom save.'],
            [6, 'Smorzare Elementi', 'Reazione: dai resistenza a un tipo di danno elementale a te o a un alleato vicino.',
              'Dampen Elements', 'Reaction: grant resistance to an elemental damage type to you or a nearby ally.'],
            divineStrike('da freddo, fuoco o fulmine', 'cold, fire or lightning'),
            [17, 'Maestro della Natura', 'Comandi le creature affascinate.', 'Master of Nature', 'Command creatures charmed by you.'],
          ],
        },
        {
          value: 'tempest', label: 'Tempesta', labelEn: 'Tempest',
          description: 'Dèi del tuono e delle tempeste.', descriptionEn: 'Gods of storm and thunder.',
          features: [
            [1, 'Competenze Bonus', 'Competenza con le armi da guerra e le armature pesanti.', 'Bonus Proficiencies', 'Proficiency with martial weapons and heavy armor.'],
            [1, 'Ira della Tempesta', 'Reazione: chi ti colpisce in mischia subisce danni da fulmine o tuono (SAG volte per riposo lungo).',
              'Wrath of the Storm', 'Reaction: a creature that hits you in melee takes lightning or thunder damage (Wisdom modifier times per long rest).'],
            [2, `${CHANNEL}: Ira Distruttiva`, 'Fulmini e tuoni infliggono il massimo dei danni.', `${CHANNEL_EN}: Destructive Wrath`, 'Lightning and thunder damage dice are maximized.'],
            [6, 'Colpo del Fulmine', 'I danni da fulmine possono spingere un bersaglio fino a 3 m.', 'Thunderbolt Strike', 'Lightning damage can push a target up to 10 feet.'],
            divineStrike('da tuono', 'thunder'),
            [17, 'Nato dalla Tempesta', 'Velocità di volo pari alla velocità a terra, all\'aperto.', 'Stormborn', 'Flying speed equal to your walking speed when outdoors.'],
          ],
        },
        {
          value: 'trickery', label: 'Inganno', labelEn: 'Trickery',
          description: 'Dèi dell\'astuzia e degli scherzi.', descriptionEn: 'Gods of mischief and deceit.',
          features: [
            [1, 'Benedizione dell\'Ingannatore', 'Dai vantaggio alle prove di Furtività a una creatura per 1 ora.',
              'Blessing of the Trickster', 'Grant advantage on Stealth checks to a creature for 1 hour.'],
            [2, `${CHANNEL}: Invocare Duplicità`, 'Crei un doppio illusorio con cui puoi lanciare incantesimi e ottenere vantaggio.',
              `${CHANNEL_EN}: Invoke Duplicity`, 'Create an illusory double you can cast spells through and gain advantage with.'],
            [6, `${CHANNEL}: Mantello d'Ombra`, 'Diventi invisibile fino alla fine del tuo prossimo turno.', `${CHANNEL_EN}: Cloak of Shadows`, 'Become invisible until the end of your next turn.'],
            divineStrike('da veleno', 'poison'),
            [17, 'Duplicità Migliorata', 'Crei fino a quattro duplicati.', 'Improved Duplicity', 'Create up to four duplicates.'],
          ],
        },
        {
          value: 'war', label: 'Guerra', labelEn: 'War',
          description: 'Dèi del conflitto e del valore.', descriptionEn: 'Gods of conflict and valor.',
          features: [
            [1, 'Competenze Bonus', 'Competenza con le armi da guerra e le armature pesanti.', 'Bonus Proficiencies', 'Proficiency with martial weapons and heavy armor.'],
            [1, 'Sacerdote della Guerra', 'Azione bonus: un attacco con arma dopo l\'azione di Attacco (SAG volte per riposo lungo).',
              'War Priest', 'Bonus action: make a weapon attack after taking the Attack action (Wisdom modifier times per long rest).'],
            [2, `${CHANNEL}: Colpo Guidato`, '+10 a un tiro per colpire.', `${CHANNEL_EN}: Guided Strike`, '+10 to an attack roll.'],
            [6, `${CHANNEL}: Benedizione del Dio della Guerra`, 'Reazione: +10 al tiro per colpire di un alleato vicino.',
              `${CHANNEL_EN}: War God's Blessing`, 'Reaction: +10 to a nearby ally\'s attack roll.'],
            divineStrike('dello stesso tipo dell\'arma', 'of the weapon\'s type'),
            [17, 'Avatar della Battaglia', 'Resistenza ai danni contundenti, perforanti e taglienti non magici.',
              'Avatar of Battle', 'Resistance to nonmagical bludgeoning, piercing and slashing damage.'],
          ],
        },
      ],
    },
    {
      key: 'domainSkills', type: 'skills', mode: 'both', minLevel: 1, count: 2,
      pool: ['arcana', 'history', 'nature', 'religion'],
      when: { key: 'subclass', in: ['knowledge'] },
      label: 'Benedizioni della Conoscenza: abilità', labelEn: 'Blessings of Knowledge: skills',
      featureName: 'Benedizioni della Conoscenza', featureNameEn: 'Blessings of Knowledge',
      hint: 'Competenza e Maestria in due abilità.', hintEn: 'Proficiency and expertise in two skills.',
    },
    {
      key: 'natureSkill', type: 'skills', mode: 'proficiency', minLevel: 1, count: 1,
      pool: ['animalHandling', 'nature', 'survival'],
      when: { key: 'subclass', in: ['nature'] },
      label: 'Accolito della Natura: abilità', labelEn: 'Acolyte of Nature: skill',
      featureName: 'Accolito della Natura', featureNameEn: 'Acolyte of Nature',
      hint: 'Competenza in un\'abilità.', hintEn: 'Proficiency in one skill.',
    },
  ],
};
