/**
 * Scelte del Bardo: Collegio Bardico (3° livello). La Maestria (3° e 10°) arriva nella fase C.
 * Sapienza: tre abilità a scelta, concesse come competenze (calcolato).
 *
 * Da verificare: "Competenze Bonus", "Parole Taglienti", "Segreti Magici Aggiuntivi",
 * "Abilità Impareggiabile", "Ispirazione in Combattimento", "Magia da Battaglia".
 */
export default {
  choices: [
    {
      key: 'subclass', type: 'single', minLevel: 3, subclass: true,
      label: 'Collegio Bardico', labelEn: 'Bard College',
      options: [
        {
          value: 'lore', label: 'Sapienza', labelEn: 'Lore',
          description: 'Bardi eruditi, raccoglitori di sapere.', descriptionEn: 'Scholarly bards who collect knowledge.',
          features: [
            [3, 'Competenze Bonus', 'Competenza in tre abilità a tua scelta.', 'Bonus Proficiencies', 'Proficiency in three skills of your choice.'],
            [3, 'Parole Taglienti', 'Reazione: sottrai un dado di Ispirazione Bardica a un attacco, prova di caratteristica o danni di una creatura entro 18 m.',
              'Cutting Words', 'Reaction: subtract a Bardic Inspiration die from a creature\'s attack, check or damage within 60 feet.'],
            [6, 'Segreti Magici Aggiuntivi', 'Impari due incantesimi da qualsiasi classe.', 'Additional Magical Secrets', 'Learn two spells from any class.'],
            [14, 'Abilità Impareggiabile', 'Aggiungi un dado di Ispirazione Bardica a una tua prova di caratteristica.', 'Peerless Skill', 'Add a Bardic Inspiration die to one of your ability checks.'],
          ],
        },
        {
          value: 'valor', label: 'Valore', labelEn: 'Valor',
          description: 'Bardi guerrieri che cantano le gesta degli eroi.', descriptionEn: 'Warrior bards who sing of heroes.',
          features: [
            [3, 'Competenze Bonus', 'Competenza con armature medie, scudi e armi da guerra.', 'Bonus Proficiencies', 'Proficiency with medium armor, shields and martial weapons.'],
            [3, 'Ispirazione in Combattimento', 'Un alleato ispirato può aggiungere il dado ai danni di un\'arma o alla CA contro un attacco.',
              'Combat Inspiration', 'An inspired ally can add the die to weapon damage or to AC against an attack.'],
            [6, 'Attacco Extra', 'Attacchi due volte quando effettui l\'azione di Attacco.', 'Extra Attack', 'You attack twice when you take the Attack action.'],
            [14, 'Magia da Battaglia', 'Dopo aver lanciato un incantesimo da bardo con un\'azione, puoi attaccare con un\'arma come azione bonus.',
              'Battle Magic', 'After casting a bard spell with an action, make a weapon attack as a bonus action.'],
          ],
        },
      ],
    },
    {
      key: 'loreSkills', type: 'skills', mode: 'proficiency', minLevel: 3, count: 3,
      when: { key: 'subclass', in: ['lore'] },
      featureName: 'Competenze Bonus', featureNameEn: 'Bonus Proficiencies',
      label: 'Sapienza: competenze bonus', labelEn: 'Lore: bonus proficiencies',
      hint: 'Tre abilità a tua scelta.', hintEn: 'Three skills of your choice.',
    },
  ],
};
