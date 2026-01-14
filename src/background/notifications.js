import browser from "webextension-polyfill";

import { STORAGE_KEY, TIMER_TYPE } from "../utils/constants";

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
    let message = "";

    switch (timerType) {
      case TIMER_TYPE.TOMATO:
        message = "Your Tomato timer is done!";
        break;
      case TIMER_TYPE.SHORT_BREAK:
        message = "Your short break is done!";
        break;
      case TIMER_TYPE.LONG_BREAK:
        message = "Your long break is done!";
        break;
      default:
        message = "Your timer is done!";
        break;
    }

    browser.notifications.create("", {
      type: "basic",
      iconUrl: "/assets/images/tomato-icon-64.png",
      title: "Tomato Clock",
      message,
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
  }
}
