/**
 * Settings Sync Utility
 * 
 * Syncs user settings from the backend (currentUser.settings) to localStorage
 * on login, and resets them to defaults on signout.
 */

// All localStorage keys used by the Settings page
const SETTINGS_KEYS = [
  'theme',
  'fontSize',
  'language',
  'timezone',
  'dateFormat',
  'emailNotifications',
  'inAppNotifications',
  'notificationSound',
  'showEmail',
  'showPhone',
  'dataSharing',
  'allowLocationAccess',
  'profileVisibility',
];

// Default values for settings (matches Settings.jsx defaults)
const SETTING_DEFAULTS = {
  theme: 'system',
  fontSize: 'medium',
  language: 'en',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  dateFormat: 'MM/DD/YYYY',
  emailNotifications: true,
  inAppNotifications: true,
  notificationSound: 'default',
  showEmail: false,
  showPhone: false,
  dataSharing: true,
  allowLocationAccess: false,
  profileVisibility: 'friends',
};

/**
 * Sync user settings from the backend user object to localStorage.
 * Called after successful login (from finalizeLogin).
 * 
 * @param {Object} user - The user object from the backend (contains .settings and .profileVisibility)
 */
export const syncSettingsFromUser = (user) => {
  if (!user) return;

  const settings = user.settings || {};

  // Sync each setting from user.settings to localStorage
  // Only set if the value exists in the user's settings (don't overwrite with undefined)

  // Theme
  if (settings.theme) {
    localStorage.setItem('theme', settings.theme);
    applyTheme(settings.theme);
  }

  // Font Size
  if (settings.fontSize) {
    localStorage.setItem('fontSize', settings.fontSize);
    applyFontSize(settings.fontSize);
  }

  // Language
  if (settings.language) {
    localStorage.setItem('language', settings.language);
  }

  // Timezone
  if (settings.timezone) {
    localStorage.setItem('timezone', settings.timezone);
  }

  // Date Format
  if (settings.dateFormat) {
    localStorage.setItem('dateFormat', settings.dateFormat);
  }

  // Notification settings (boolean values - check for explicit existence)
  if (settings.emailNotifications !== undefined) {
    localStorage.setItem('emailNotifications', settings.emailNotifications.toString());
  }
  if (settings.inAppNotifications !== undefined) {
    localStorage.setItem('inAppNotifications', settings.inAppNotifications.toString());
  }
  if (settings.notificationSound) {
    localStorage.setItem('notificationSound', settings.notificationSound);
  }

  // Privacy settings
  if (settings.showEmail !== undefined) {
    localStorage.setItem('showEmail', settings.showEmail.toString());
  }
  if (settings.showPhone !== undefined) {
    localStorage.setItem('showPhone', settings.showPhone.toString());
  }
  if (settings.dataSharing !== undefined) {
    localStorage.setItem('dataSharing', settings.dataSharing.toString());
  }
  if (settings.allowLocationAccess !== undefined) {
    localStorage.setItem('allowLocationAccess', settings.allowLocationAccess.toString());
  }

  // Profile visibility (stored on user directly, not in settings)
  if (user.profileVisibility) {
    localStorage.setItem('profileVisibility', user.profileVisibility);
  }
};

/**
 * Reset all user settings in localStorage to their default values.
 * Called on signout.
 */
export const resetSettingsToDefaults = () => {
  // Remove all settings keys from localStorage
  SETTINGS_KEYS.forEach(key => {
    localStorage.removeItem(key);
  });

  // Apply default theme and font size visually
  applyTheme(SETTING_DEFAULTS.theme);
  applyFontSize(SETTING_DEFAULTS.fontSize);
};

/**
 * Apply theme to the document (dark mode class toggle)
 */
const applyTheme = (theme) => {
  if (theme === 'dark') {
    document.documentElement.classList.add('dark');
  } else if (theme === 'light') {
    document.documentElement.classList.remove('dark');
  } else {
    // System theme
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }

  // Dispatch theme-change event for ThemeToggle and other components
  window.dispatchEvent(new CustomEvent('theme-change', { detail: { theme } }));
};

/**
 * Apply font size to the document
 */
const applyFontSize = (fontSize) => {
  const sizeMap = { small: '14px', medium: '16px', large: '18px' };
  document.documentElement.style.fontSize = sizeMap[fontSize] || '16px';
};
