import browser from "webextension-polyfill";

import { DEFAULT_SETTINGS, STORAGE_KEY } from "./constants";

export default class Settings {
  constructor() {
    // Sync storage limits (approximately 100 KB, 8 KB per item)
    // Firefox: https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/storage/sync
    // Chrome: https://developer.chrome.com/docs/extensions/reference/storage/#sync
    this.storage = browser.storage.sync || browser.storage.local;
  }

  getSettings() {
    return new Promise((resolve) => {
      const onSuccess = (storageResults) => {
        const settings = Object.assign(
          {},
          DEFAULT_SETTINGS,
          storageResults[STORAGE_KEY.SETTINGS],
        );

        resolve(settings);
      };

      const onError = () => {
        resolve(DEFAULT_SETTINGS);
      };

      this.storage.get(STORAGE_KEY.SETTINGS).then(onSuccess, onError);
    });
  }

  saveSettings(settings) {
    return this.storage.set({
      [STORAGE_KEY.SETTINGS]: settings,
    });
  }

  resetSettings() {
    return this.storage.set({
      [STORAGE_KEY.SETTINGS]: DEFAULT_SETTINGS,
    });
  }
}
