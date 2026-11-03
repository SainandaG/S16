// Customer sign-in state. The token stays in this browser until the customer signs out.
const KEY = "s16-customer-token";
const EVENT = "s16-auth-change";

export function getCustomerToken() {
  try {
    return localStorage.getItem(KEY) || "";
  } catch {
    return "";
  }
}

export function setCustomerToken(token) {
  try {
    if (token) localStorage.setItem(KEY, token);
    else localStorage.removeItem(KEY);
  } catch {
    /* storage blocked: the customer stays signed out after a reload */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function onAuthChange(handler) {
  window.addEventListener(EVENT, handler);
  return () => window.removeEventListener(EVENT, handler);
}
