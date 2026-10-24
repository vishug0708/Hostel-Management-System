/**
 * sessionBridge.js
 * 
 * Provides transparent, per-tab session isolation for multi-tab support.
 * HTML5 localStorage is shared across all tabs of the same origin.
 * HTML5 sessionStorage is strictly scoped to the individual browser tab.
 * 
 * By routing authentication session keys (tokens, user objects, profile keys)
 * through sessionStorage:
 * 1. Tab A and Tab B can be logged into different accounts simultaneously.
 * 2. Refreshing Tab A restores Tab A's account without being overwritten by Tab B.
 * 3. Logging out of Tab B does not affect Tab A.
 * 4. All existing components calling localStorage or sessionStorage work seamlessly
 *    without requiring risky changes to dozens of files.
 */

const AUTH_KEYS = new Set([
  "adminToken",
  "admin",
  "studentToken",
  "student",
  "studentId",
  "student_id",
  "studentPhoto",
  "staffToken",
  "staff",
  "staffPhoto",
  "currentStaffId",
  "rectorToken",
  "rector",
  "securityToken",
  "security",
  "token"
]);

export function isAuthKey(key) {
  if (typeof key !== "string") return false;
  if (AUTH_KEYS.has(key)) return true;
  if (
    key.startsWith("staffToken_") ||
    key.startsWith("staff_") ||
    key.startsWith("staffPhoto_")
  ) {
    return true;
  }
  return false;
}

export function initSessionBridge() {
  if (typeof window === "undefined" || !window.localStorage || !window.sessionStorage) {
    return;
  }

  // Prevent double installation
  if (window.__SESSION_BRIDGE_INITIALIZED__) {
    return;
  }
  window.__SESSION_BRIDGE_INITIALIZED__ = true;

  const originalGetItem = localStorage.getItem.bind(localStorage);
  const originalSetItem = localStorage.setItem.bind(localStorage);
  const originalRemoveItem = localStorage.removeItem.bind(localStorage);
  const originalClear = localStorage.clear.bind(localStorage);

  // Wrap localStorage.getItem
  localStorage.getItem = function (key) {
    if (isAuthKey(key)) {
      const sessionVal = sessionStorage.getItem(key);
      if (sessionVal !== null) {
        return sessionVal;
      }
      return null;
    }
    return originalGetItem(key);
  };

  // Wrap localStorage.setItem
  localStorage.setItem = function (key, value) {
    if (isAuthKey(key)) {
      sessionStorage.setItem(key, String(value));
      return;
    }
    originalSetItem(key, value);
  };

  // Wrap localStorage.removeItem
  localStorage.removeItem = function (key) {
    if (isAuthKey(key)) {
      sessionStorage.removeItem(key);
      return;
    }
    originalRemoveItem(key);
  };

  // Wrap localStorage.clear
  localStorage.clear = function () {
    for (const key of AUTH_KEYS) {
      sessionStorage.removeItem(key);
    }
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i);
      if (k && isAuthKey(k)) {
        sessionStorage.removeItem(k);
      }
    }
    originalClear();
  };
}

// Auto-initialize when imported
initSessionBridge();

