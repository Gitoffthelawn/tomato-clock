import browser from "webextension-polyfill";

import Settings from "../utils/settings";
import Badge from "./badge";
import Notifications from "./notifications";
import Timeline from "../utils/timeline";
import {
  getMillisecondsToMinutesAndSeconds,
  getTimerTypeMilliseconds,
} from "../utils/utils";
import {
  RUNTIME_ACTION,
  TIMER_TYPE,
  BADGE_BACKGROUND_COLOR_BY_TIMER_TYPE,
  STORAGE_KEY,
} from "../utils/constants";

export default class Timer {
  constructor() {
    this.settings = new Settings();
    this.badge = new Badge();
    this.notifications = new Notifications(this.settings);
    this.timeline = new Timeline();

    this.timeline.switchStorageFromSyncToLocal();

    this.setListeners();
    this.initAlarms();
  }

  async getTimerState() {
    const result = await browser.storage.local.get(STORAGE_KEY.TIMER);
    return (
      result[STORAGE_KEY.TIMER] || {
        status: "idle",
        type: null,
        scheduledTime: null,
        totalTime: 0,
      }
    );
  }

  async setTimerState(state) {
    await browser.storage.local.set({ [STORAGE_KEY.TIMER]: state });
  }

  async clearTimerState() {
    await browser.storage.local.remove(STORAGE_KEY.TIMER);
  }

  async resetTimer() {
    await browser.alarms.clearAll();
    await this.clearTimerState();
    this.badge.setBadgeText("");
  }

  setTimer(type) {
    this.resetTimer().then(() => {
      const badgeBackgroundColor = BADGE_BACKGROUND_COLOR_BY_TIMER_TYPE[type];
      this.settings.getSettings().then(async (settings) => {
        const milliseconds = getTimerTypeMilliseconds(type, settings);
        const scheduledTime = Date.now() + milliseconds;

        const state = {
          status: "running",
          scheduledTime,
          totalTime: milliseconds,
          type,
        };

        await this.setTimerState(state);
        await browser.alarms.create("timer", { when: scheduledTime });
        await browser.alarms.create("badge", { periodInMinutes: 1 });

        // Initial badge of timer to match the panel minute digits (e.g. "25" badge to "25:00" panel time)
        const { minutes } = getMillisecondsToMinutesAndSeconds(milliseconds);
        this.badge.setBadgeText(minutes.toString(), badgeBackgroundColor);
        // After 1 second, update badge to different panel minute digits (e.g. "24" badge to "24:59" panel time
        setTimeout(() => {
          this.updateBadge();
        }, 1000);
      });
    });
  }

  async updateBadge() {
    const state = await this.getTimerState();
    if (state.status !== "running") return;

    const badgeBackgroundColor =
      BADGE_BACKGROUND_COLOR_BY_TIMER_TYPE[state.type];
    const timeLeft = state.scheduledTime - Date.now();

    if (timeLeft <= 0) {
      // Should be handled by 'timer' alarm, but just in case
      this.badge.setBadgeText("");
      return;
    }

    const { minutes, seconds } = getMillisecondsToMinutesAndSeconds(timeLeft);
    const minutesLeft = minutes.toString();
    console.log(timeLeft);
    console.log(minutesLeft);
    console.log(seconds);

    // Check if we need to update
    const currentText = await this.badge.getBadgeText();
    if (currentText !== minutesLeft) {
      if (minutesLeft === "0" && seconds < 60) {
        this.badge.setBadgeText("<1", badgeBackgroundColor);
      } else {
        this.badge.setBadgeText(minutesLeft, badgeBackgroundColor);
      }
    }
  }

  initAlarms() {
    browser.alarms.onAlarm.addListener(async (alarm) => {
      switch (alarm.name) {
        case "timer": {
          // const delayInSeconds = (Date.now() - alarm.scheduledTime) / 1000;
          // console.log(`Alarm delay: ${delayInSeconds} seconds`);

          const state = await this.getTimerState();
          if (state.status === "running") {
            this.notifications.createBrowserNotification(state.type);
            this.timeline.addAlarmToTimeline(state.type, state.totalTime);
            await this.resetTimer();
          }
          break;
        }
        case "badge":
          await this.updateBadge();
          setTimeout(() => {
            this.updateBadge();
          }, 1000);
          break;
      }
    });
  }

  async getTimerScheduledTime() {
    const state = await this.getTimerState();
    return state.scheduledTime;
  }

  setListeners() {
    browser.runtime.onMessage.addListener((request, sender, sendResponse) => {
      switch (request.action) {
        case RUNTIME_ACTION.RESET_TIMER:
          this.resetTimer();
          break;
        case RUNTIME_ACTION.SET_TIMER:
          this.setTimer(request.data.type);
          break;
        case RUNTIME_ACTION.GET_TIMER_SCHEDULED_TIME:
          return this.getTimerScheduledTime(); // Returns promise
        default:
          break;
      }
    });

    browser.commands.onCommand.addListener((command) => {
      switch (command) {
        case "start-tomato":
          this.setTimer(TIMER_TYPE.TOMATO);
          break;
        case "start-short-break":
          this.setTimer(TIMER_TYPE.SHORT_BREAK);
          break;
        case "start-long-break":
          this.setTimer(TIMER_TYPE.LONG_BREAK);
          break;
        case "reset-timer":
          this.resetTimer();
          break;
        default:
          break;
      }
    });
  }
}
