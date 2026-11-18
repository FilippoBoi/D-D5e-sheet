/**
 * Scelte del Ladro: Maestria (1° livello; 2 → 4 al 6°) e Archetipo Ladresco (3° livello).
 *
 * `thievesTools`: la Maestria può cadere sugli arnesi da scasso; conta nel numero
 * di scelte ma non ha effetto sui valori (gli strumenti non sono modellati).
 *
 * Effetti calcolabili: Mistificatore Arcano, incantatore "a un terzo" (INT) dal 3°.
 *
 * Da verificare: "Mani Rapide", "Lavoro al Secondo Piano", "Furtività Suprema", "Usare Oggetti Magici",
 * "Riflessi del Ladro", "Assassinare", "Competenze Bonus", "Maestria nell'Infiltrazione", "Impostore",
 * "Colpo Mortale", "Mano Magica Ingannevole", "Imboscata Magica", "Mistificatore Versatile",
 * "Ladro di Incantesimi". Confermati dal progetto: "Ladro", "Assassino", "Mistificatore Arcano".
 */
export default {
  choices: [
    {
      key: 'expertise', type: 'skills', mode: 'expertise', minLevel: 1, replacesFeature: true,
      count: [[1, 2], [6, 4]],
      extra: [{ value: 'thievesTools', label: 'Arnesi da scasso', labelEn: 'Thieves\' tools' }],
      label: 'Maestria', labelEn: 'Expertise',
      hint: 'Abilità in cui sei competente (o arnesi da scasso).',
      hintEn: 'Skills you are proficient in (or thieves\' tools).',
    },
    {
      key: 'subclass', type: 'single', minLevel: 3, subclass: true,
      label: 'Archetipo Ladresco', labelEn: 'Roguish Archetype',
      options: [
        {
          value: 'thief', label: 'Ladro', labelEn: 'Thief',
          description: 'Scasso, furto e agilità.', descriptionEn: 'Burglary, theft and agility.',
          features: [
            [3, 'Mani Rapide', 'L\'azione bonus di Azione Scaltra può essere una prova di Rapidità di Mano, usare arnesi da scasso o l\'azione Usare un Oggetto.',
              'Fast Hands', 'Cunning Action\'s bonus action can be a Sleight of Hand check, thieves\' tools use, or Use an Object.'],
            [3, 'Lavoro al Secondo Piano', 'Arrampicarti non costa movimento extra; il salto in lungo aumenta con la DES.', 'Second-Story Work', 'Climbing costs no extra movement; running jumps grow with Dexterity.'],
            [9, 'Furtività Suprema', 'Vantaggio a Furtività se ti muovi al massimo di metà velocità.', 'Supreme Sneak', 'Advantage on Stealth if you move at most half your speed.'],
            [13, 'Usare Oggetti Magici', 'Ignori i requisiti di classe, razza e livello degli oggetti magici.', 'Use Magic Device', 'Ignore class, race and level requirements of magic items.'],
            [17, 'Riflessi del Ladro', 'Due turni nel primo round di combattimento.', 'Thief\'s Reflexes', 'Take two turns in the first round of combat.'],
          ],
        },
        {
          value: 'assassin', label: 'Assassino', labelEn: 'Assassin',
          description: 'L\'arte oscura della morte.', descriptionEn: 'The grim art of death.',
          features: [
            [3, 'Competenze Bonus', 'Competenza con il kit del camuffamento e il kit da avvelenatore.', 'Bonus Proficiencies', 'Proficiency with the disguise kit and poisoner\'s kit.'],
            [3, 'Assassinare', 'Vantaggio contro chi non ha ancora agito; i colpi a creature sorprese sono critici.', 'Assassinate', 'Advantage against creatures that haven\'t acted; hits on surprised creatures are critical.'],
            [9, 'Maestria nell\'Infiltrazione', 'Crei identità false (7 giorni, 25 mo).', 'Infiltration Expertise', 'Create false identities (7 days, 25 gp).'],
            [13, 'Impostore', 'Imiti voce, scrittura e comportamento di un\'altra persona.', 'Impostor', 'Mimic another person\'s speech, writing and behavior.'],
            [17, 'Colpo Mortale', 'Un colpo a una creatura sorpresa le impone un TS su COS: se fallisce i danni raddoppiano.', 'Death Strike', 'A hit on a surprised creature forces a Constitution save; on a failure damage is doubled.'],
          ],
        },
        {
          value: 'arcaneTrickster', label: 'Mistificatore Arcano', labelEn: 'Arcane Trickster',
          description: 'Magia di ammaliamento e illusione (Intelligenza).', descriptionEn: 'Enchantment and illusion magic (Intelligence).',
          effects: { spellcasting: { ability: 'int', progression: 'third', minLevel: 3 } },
          features: [
            [3, 'Incantesimi', 'Lanci incantesimi da mago (soprattutto ammaliamento e illusione) usando l\'Intelligenza: slot, CD e bonus sono nel pannello Incantesimi.',
              'Spellcasting', 'Cast wizard spells (mostly enchantment and illusion) using Intelligence: slots, DC and bonus are in the Spells panel.'],
            [3, 'Mano Magica Ingannevole', 'La Mano Magica è invisibile e può rubare, riporre oggetti e usare arnesi da scasso.', 'Mage Hand Legerdemain', 'Your Mage Hand is invisible and can steal, stow items and use thieves\' tools.'],
            [9, 'Imboscata Magica', 'Se sei nascosto quando lanci un incantesimo, il bersaglio ha svantaggio al TS.', 'Magical Ambush', 'If hidden when you cast a spell, the target has disadvantage on its save.'],
            [13, 'Mistificatore Versatile', 'Azione bonus: con la Mano Magica ottieni vantaggio sugli attacchi contro una creatura.', 'Versatile Trickster', 'Bonus action: use Mage Hand to gain advantage on attacks against a creature.'],
            [17, 'Ladro di Incantesimi', 'Reazione: rubi la conoscenza di un incantesimo lanciato contro di te.', 'Spell Thief', 'Reaction: steal the knowledge of a spell cast at you.'],
          ],
        },
      ],
    },
  ],
};
