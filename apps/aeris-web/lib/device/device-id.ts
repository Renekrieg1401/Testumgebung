const DEVICE_ID_STORAGE_KEY = 'aeris.deviceId';

/** Stabile, rein lokale Geräte-ID für die Vektoruhr — kein Personenbezug. */
export function getOrCreateDeviceId(): string {
  const existing = window.localStorage.getItem(DEVICE_ID_STORAGE_KEY);
  if (existing) return existing;
  const generated = crypto.randomUUID();
  window.localStorage.setItem(DEVICE_ID_STORAGE_KEY, generated);
  return generated;
}
