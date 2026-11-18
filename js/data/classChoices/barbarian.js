/**
 * Scelte del Barbaro: Cammino Primordiale (3° livello), PHB, da 5e.tools.
 * Guerriero Totemico: spirito totemico (3°), aspetto della bestia (6°) e sintonia totemica (14°),
 * ciascuno a scelta tra orso, aquila e lupo (anche lo stesso animale), descrittivi.
 *
 * Termini da verificare sul PHB italiano: "Frenesia", "Ira Irrazionale", "Presenza Intimidatoria",
 * "Rappresaglia", "Cercatore di Spiriti", "Spirito Totemico", "Aspetto della Bestia",
 * "Camminatore degli Spiriti", "Sintonia Totemica". Confermati dal progetto: "Cammino Primordiale",
 * "Berserker", "Guerriero Totemico".
 */
const animal = (value, label, labelEn, description, descriptionEn) => ({ value, label, labelEn, description, descriptionEn });
const totem = (key, minLevel, featureName, featureNameEn, label, labelEn, options) => ({
  key, type: 'single', minLevel, when: { key: 'subclass', in: ['totemWarrior'] },
  featureName, featureNameEn, label, labelEn, options,
});

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
    totem('totemSpirit', 3, 'Spirito Totemico', 'Totem Spirit', 'Spirito totemico', 'Totem spirit', [
      animal('bear', 'Orso', 'Bear', 'In ira hai resistenza a tutti i danni tranne psichici.', 'While raging, resistance to all damage except psychic.'),
      animal('eagle', 'Aquila', 'Eagle', 'In ira, senza armatura pesante: gli attacchi di opportunità contro di te hanno svantaggio e Scattare è un\'azione bonus.', 'While raging without heavy armor: opportunity attacks against you have disadvantage and you can Dash as a bonus action.'),
      animal('wolf', 'Lupo', 'Wolf', 'In ira, i tuoi alleati hanno vantaggio in mischia contro i nemici entro 1,5 m da te.', 'While raging, allies have advantage on melee attacks against enemies within 5 feet of you.'),
    ]),
    totem('totemAspect', 6, 'Aspetto della Bestia', 'Aspect of the Beast', 'Aspetto della bestia', 'Aspect of the beast', [
      animal('bear', 'Orso', 'Bear', 'Capacità di carico raddoppiata e vantaggio alle prove di FOR per spingere, tirare, sollevare o rompere.', 'Doubled carrying capacity and advantage on Strength checks to push, pull, lift or break.'),
      animal('eagle', 'Aquila', 'Eagle', 'Vedi fino a 1,6 km nei dettagli e penombra non ti dà svantaggio a Percezione.', 'See up to 1 mile in detail and dim light doesn\'t impose disadvantage on Perception.'),
      animal('wolf', 'Lupo', 'Wolf', 'Segui le tracce a passo veloce e ti muovi furtivo a passo normale.', 'Track at a fast pace and move stealthily at a normal pace.'),
    ]),
    totem('totemAttunement', 14, 'Sintonia Totemica', 'Totemic Attunement', 'Sintonia totemica', 'Totemic attunement', [
      animal('bear', 'Orso', 'Bear', 'In ira i nemici entro 1,5 m hanno svantaggio ad attaccare chiunque tranne te.', 'While raging, enemies within 5 feet have disadvantage attacking anyone but you.'),
      animal('eagle', 'Aquila', 'Eagle', 'In ira hai velocità di volo pari alla velocità a terra (a brevi tratti).', 'While raging, flying speed equal to your walking speed (short bursts).'),
      animal('wolf', 'Lupo', 'Wolf', 'In ira, azione bonus: atterri una creatura Grande o più piccola che colpisci in mischia.', 'While raging, bonus action: knock a Large or smaller creature prone when you hit it in melee.'),
    ]),
  ],
};
