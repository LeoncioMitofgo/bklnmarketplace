import { deletePushSubscription, savePushSubscription } from "./actions";

// Suscripción push de este navegador (solo cliente). En iPhone solo funciona con la web instalada
// en la pantalla de inicio (fase 2); allí pushSupported() devuelve false y no se ofrece.

export type PushState = "unsupported" | "default" | "denied" | "granted";

const SW_URL = "/sw.js";

export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window &&
    Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY)
  );
}

export function pushState(): PushState {
  if (!pushSupported()) return "unsupported";
  return Notification.permission as PushState;
}

function applicationServerKey(): Uint8Array<ArrayBuffer> {
  const base64 = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");
  const raw = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
  const bytes = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
  return bytes;
}

async function subscribeAndSave(): Promise<boolean> {
  const registration = await navigator.serviceWorker.register(SW_URL);
  await navigator.serviceWorker.ready;
  const subscription =
    (await registration.pushManager.getSubscription()) ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey(),
    }));
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys.auth) return false;
  return savePushSubscription({
    endpoint: json.endpoint,
    p256dh: json.keys.p256dh,
    auth: json.keys.auth,
    userAgent: navigator.userAgent,
  });
}

/** Pide permiso (tiene que llamarse al pulsar un botón) y guarda la suscripción. */
export async function enablePush(): Promise<PushState | "error"> {
  if (!pushSupported()) return "unsupported";
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return permission as PushState;
  try {
    return (await subscribeAndSave()) ? "granted" : "error";
  } catch {
    return "error";
  }
}

/**
 * Con el permiso ya concedido, se asegura de que este navegador sigue suscrito y guardado
 * (por si cambió la suscripción o se entró con otra cuenta). Una vez por sesión del navegador.
 */
export async function ensurePushSubscription(): Promise<void> {
  if (pushState() !== "granted") return;
  try {
    if (sessionStorage.getItem("bkln:push-ok")) return;
    if (await subscribeAndSave()) sessionStorage.setItem("bkln:push-ok", "1");
  } catch {
    // Sin red o sin servicio de push: se volverá a intentar en otra visita.
  }
}

/** Da de baja este navegador (al desactivar los avisos o al cerrar sesión). */
export async function disablePush(): Promise<void> {
  if (!pushSupported()) return;
  const registration = await navigator.serviceWorker.getRegistration(SW_URL);
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return;
  await deletePushSubscription(subscription.endpoint);
  await subscription.unsubscribe();
  try {
    sessionStorage.removeItem("bkln:push-ok");
  } catch {}
}
