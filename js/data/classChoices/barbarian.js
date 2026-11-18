/**
 * Scelte del Barbaro: Cammino Primordiale (3° livello), PHB, da 5e.tools.
 * Spirito totemico (3°), aspetto (6°) e sintonia (14°) arrivano nella fase C:
 * qui compaiono come privilegi descrittivi.
 *
 * Termini da verificare sul PHB italiano: "Frenesia", "Ira Irrazionale", "Presenza Intimidatoria",
 * "Rappresaglia", "Cercatore di Spiriti", "Spirito Totemico", "Aspetto della Bestia",
 * "Camminatore degli Spiriti", "Sintonia Totemica". Confermati dal progetto: "Cammino Primordiale",
 * "Berserker", "Guerriero Totemico".
 */
export default {
  choices: [
    {
      key: 'subclass', type: 'single', minLevel: 3, subclass: true,
      label: 'Cammino Primordiale', labelEn: 'Primal Path',
      options: [
        {
          value: 'berserker', label: 'Berserker', labelEn: 'Berserker',
          description: 'Un cammino di furia incontrollata.', descriptionEn: 'A path of untrammeled fury.',
          features: [
            [3, 'Frenesia', 'Durante l\'ira puoi attaccare in mischia come azione bonus a ogni turno; alla fine dell\'ira subisci un livello di indebolimento.',
              'Frenzy', 'While raging you can make a melee attack as a bonus action each turn; when the rage ends you gain a level of exhaustion.'],
            [6, 'Ira Irrazionale', 'Durante l\'ira non puoi essere affascinato né spaventato.', 'Mindless Rage', 'You can\'t be charmed or frightened while raging.'],
            [10, 'Presenza Intimidatoria', 'Azione: spaventi una creatura entro 9 m (TS su SAG, CD 8 + competenza + mod. CAR).',
              'Intimidating Presence', 'Action: frighten a creature within 30 feet (Wisdom save, DC 8 + proficiency + Charisma modifier).'],
            [14, 'Rappresaglia', 'Reazione: attacco in mischia contro chi ti infligge danni entro 1,5 m.', 'Retaliation', 'Reaction: melee attack against a creature within 5 feet that damages you.'],
          ],
        },
        {
          value: 'totemWarrior', label: 'Guerriero Totemico', labelEn: 'Totem Warrior',
          description: 'Un cammino di spiriti animali.', descriptionEn: 'A path of animal spirits.',
          features: [
            [3, 'Cercatore di Spiriti', 'Puoi lanciare Senso delle Bestie e Parlare con gli Animali come rituali.',
              'Spirit Seeker', 'You can cast Beast Sense and Speak with Animals as rituals.'],
            [3, 'Spirito Totemico', 'Scegli un animale totemico (orso, aquila o lupo) e ottieni il suo beneficio durante l\'ira.',
              'Totem Spirit', 'Choose a totem animal (bear, eagle or wolf) and gain its benefit while raging.'],
            [6, 'Aspetto della Bestia', 'Beneficio magico di un animale totemico a scelta.', 'Aspect of the Beast', 'A magical benefit from a totem animal of your choice.'],
            [10, 'Camminatore degli Spiriti', 'Puoi lanciare Comunione con la Natura come rituale.', 'Spirit Walker', 'You can cast Commune with Nature as a ritual.'],
            [14, 'Sintonia Totemica', 'Beneficio di un animale totemico a scelta durante l\'ira.', 'Totemic Attunement', 'A benefit from a totem animal of your choice while raging.'],
          ],
        },
      ],
    },
  ],
};
