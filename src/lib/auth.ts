import { findUserByUsername, PublicUser } from "./users";

const SESSION_KEY = "crm-demo-session";

export function loadSessionUser(): PublicUser | null {
  if (typeof window === "undefined") return null;
  try {
    const username = window.localStorage.getItem(SESSION_KEY);
    if (!username) return null;
    return findUserByUsername(username);
  } catch {
    return null;
  }
}

export function saveSessionUser(username: string) {
  window.localStorage.setItem(SESSION_KEY, username);
}

export function clearSessionUser() {
  window.localStorage.removeItem(SESSION_KEY);
}
