/**
 * Entry point: crea le tre parti dell'architettura MVC e le collega.
 * È l'unico file che conosce tutte le dipendenze (composition root).
 */
import { ABILITIES, ALIGNMENTS } from './data/abilities.js';
import { ARMORS, ARMOR_CATEGORIES } from './data/armors.js';
import { CLASS_LIST } from './data/classes.js';
import { RACE_LIST } from './data/races.js';
import { SKILLS } from './data/skills.js';
import { CharacterModel } from './model/CharacterModel.js';
import { LocalStorageRepository } from './model/LocalStorageRepository.js';
import { CharacterView } from './view/CharacterView.js';
import { CharacterController } from './controller/CharacterController.js';
import { SessionController } from './controller/SessionController.js';
import { AuthService } from './auth/AuthService.js';
import { AuthView } from './view/AuthView.js';
import { RemoteApi } from './net/RemoteApi.js';
import { REMOTE_CONFIG, isRemoteConfigured } from './config.js';

const repository = new LocalStorageRepository('dnd5e-character-sheet');
const model = new CharacterModel(repository.load());
const view = new CharacterView(document);

const controller = new CharacterController({
  model,
  view,
  repository,
  catalogs: {
    abilities: ABILITIES,
    skills: SKILLS,
    armors: ARMORS,
    armorCategories: ARMOR_CATEGORIES,
    classes: CLASS_LIST,
    races: RACE_LIST,
    alignments: ALIGNMENTS,
  },
});

controller.init();

// Collaborazione online (opzionale): attiva solo se il backend è configurato in js/config.js.
if (isRemoteConfigured()) {
  const api = new RemoteApi(REMOTE_CONFIG);
  const storage = (() => { try { return globalThis.localStorage ?? null; } catch { return null; } })();
  new SessionController({
    auth: new AuthService(api, storage),
    api,
    view: new AuthView(document),
    characters: controller,
    showStatus: (message) => view.showStatus(message),
  }).init();
}
