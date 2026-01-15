import browser from "webextension-polyfill";

import { STORAGE_KEY, TIMER_TYPE } from "../utils/constants";

const timerTypeToMessage = {
  [TIMER_TYPE.TOMATO]: "Your Tomato timer is done!",
  [TIMER_TYPE.SHORT_BREAK]: "Your short break is done!",
  [TIMER_TYPE.LONG_BREAK]: "Your long break is done!",
};

const timerTypeToButtons = {
  [TIMER_TYPE.TOMATO]: [{ title: "Short" }, { title: "Long" }],
  [TIMER_TYPE.SHORT_BREAK]: [{ title: "Tomato" }],
  [TIMER_TYPE.LONG_BREAK]: [{ title: "Tomato" }],
};

export default class Notifications {
  constructor(settings) {
    this.settings = settings;

    this.setListeners();
  }

  async playAudio() {
    const settings = await this.settings.getSettings();
    const selectedNotificationSound =
      settings.selectedNotificationSound || "timer-chime.mp3";
    let audioPath;

    if (selectedNotificationSound === "custom") {
      const stored = await browser.storage.local.get(
        STORAGE_KEY.CUSTOM_SOUND_FILE,
      );
      audioPath = stored[STORAGE_KEY.CUSTOM_SOUND_FILE] || "";
    } else {
      audioPath = `/assets/sounds/${selectedNotificationSound}`;
    }

    if (!audioPath) {
      console.log("Audio path not found");
      return;
    }

    // Chrome restricts audio playback to Offscreen documents
    if (typeof chrome !== "undefined" && chrome.offscreen) {
      const hasOffscreen = await chrome.offscreen.hasDocument();
      if (!hasOffscreen) {
        await chrome.offscreen.createDocument({
          url: "offscreen/offscreen.html",
          reasons: ["AUDIO_PLAYBACK"],
          justification: "notification sound",
        });
      }

      try {
        browser.runtime.sendMessage({
          target: "offscreen",
          type: "play-audio",
          src: audioPath,
        });
      } catch (e) {
        console.error("Failed to play audio:", e);
      }
    } else {
      new Audio(audioPath).play();
    }
  }

  createBrowserNotification(timerType) {
    const message = timerTypeToMessage[timerType] || "Your timer is done!";
    const buttons = timerTypeToButtons[timerType];

    browser.notifications.create("", {
      type: "basic",
      iconUrl: "/assets/images/tomato-icon-64.png",
      title: "Tomato Clock",
      message,
      buttons,
    });

    this.settings.getSettings().then((settings) => {
      if (settings.isNotificationSoundEnabled) {
        this.playAudio();
      }
    });
  }

  async createStorageLimitNotification() {
    await browser.notifications.create(null, {
      type: "basic",
      iconUrl: "/assets/images/tomato-icon-inactive-64.png",
      title: "Error! - Tomato Clock",
      message:
        "The storage limit was hit. Consider exporting and resetting stats.",
    });
  }

  setListeners() {
    browser.notifications.onClicked.addListener((notificationId) => {
      browser.notifications.clear(notificationId);
    });

    browser.notifications.onButtonClicked.addListener(
      (notificationId, buttonIndex) => {
        console.log(notificationId, buttonIndex);
      }
    );
  }
}
