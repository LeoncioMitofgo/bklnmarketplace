"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { subscribePrivate } from "@/lib/chat/realtime";
import { createClient } from "@/lib/supabase/client";

/**
 * Bandeja en directo: escucha el canal privado user:{id} y, cuando llega un mensaje, vuelve a
 * pedir la bandeja al servidor. También al volver a la pestaña, por si se perdió algún aviso.
 */
export function InboxLive({ userId }: { userId: string }) {
  const router = useRouter();

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const update = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        router.refresh();
        window.dispatchEvent(new Event("bkln:unread"));
      }, 400);
    };

    // Al quedar suscrito se refresca una vez: por si llegó algo entre que se pintó la página y ahora.
    const unsubscribe = subscribePrivate(
      createClient(),
      `user:${userId}`,
      { inbox: update },
      update,
    );
    const onVisible = () => {
      if (document.visibilityState === "visible") update();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      unsubscribe();
    };
  }, [router, userId]);

  return null;
}
