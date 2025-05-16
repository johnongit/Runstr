// Minimal rewards settings helper – replaces legacy streakRewards.js
// Only provides getRewardsSettings & saveRewardsSettings used by Settings page.

const SETTINGS_KEY = 'rewardsSettings';

export const getRewardsSettings = () => {
  try {
    const str = localStorage.getItem(SETTINGS_KEY);
    if (str) return JSON.parse(str);
  } catch (err) {
    console.error('[rewardsSettings] Failed to load settings', err);
  }
  // Defaults: rewards enabled, auto-claim off, show notifications on
  return {
    enabled: true,
    autoClaimRewards: false,
    showNotifications: true,
  };
};

export const saveRewardsSettings = (settings) => {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    return true;
  } catch (err) {
    console.error('[rewardsSettings] Failed to save settings', err);
    return false;
  }
}; 