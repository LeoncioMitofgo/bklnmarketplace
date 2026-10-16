import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";

type Handlers = Record<string, (payload: Record<string, unknown>) => void>;

/**
 * Se suscribe a un canal privado de Realtime (MODELO-DATOS §8). Primero pasa el token de la
 * sesión: el cliente del navegador la lee de las cookies de forma asíncrona y, si se suscribe
 * antes, entra sin usuario y la política de realtime.messages lo rechaza.
 * `onSubscribed` se llama cada vez que queda suscrito (también al reconectar tras perder la red),
 * para ponerse al día con lo que llegó mientras tanto.
 * Devuelve la función para darse de baja.
 */
export function subscribePrivate(
  supabase: SupabaseClient,
  topic: string,
  handlers: Handlers,
  onSubscribed?: () => void,
): () => void {
  let channel: RealtimeChannel | null = null;
  let cancelled = false;

  supabase.realtime
    .setAuth()
    .catch(() => {})
    .then(() => {
      if (cancelled) return;
      channel = supabase.channel(topic, { config: { private: true } });
      for (const [event, handler] of Object.entries(handlers)) {
        channel.on("broadcast", { event }, ({ payload }) => handler(payload));
      }
      channel.subscribe((status) => {
        if (status === "SUBSCRIBED") onSubscribed?.();
      });
    });

  return () => {
    cancelled = true;
    if (channel) void supabase.removeChannel(channel);
  };
}
