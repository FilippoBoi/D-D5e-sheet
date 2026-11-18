/**
 * Scelte del Warlock: Patrono Ultraterreno (1° livello), 3 patroni del PHB.
 * Invocazioni (2°), Dono del Patto (3°) e Arcana Mistica arrivano nelle fasi B e C.
 *
 * Confermati dal progetto: "Arcifata", "Immondo", "Grande Antico", "Benedizione dell'Oscuro".
 * Da verificare: "Presenza Fatata", "Fuga Nebbiosa", "Difese Ammaliatrici", "Delirio Oscuro",
 * "Fortuna dell'Oscuro", "Resilienza Immonda", "Scagliare Attraverso l'Inferno", "Mente Risvegliata",
 * "Barriera Entropica", "Scudo Mentale", "Creare Thrall".
 */
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
  ],
};
