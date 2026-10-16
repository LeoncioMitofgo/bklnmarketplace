"use client";

import { useEffect } from "react";
import { registerListingView } from "@/lib/listings/view-action";

/** Cuenta una vista al abrir la ficha, una vez por anuncio y sesión del navegador. No pinta nada. */
export function ViewTracker({ listingId }: { listingId: string }) {
  useEffect(() => {
    const key = `bkln:visto:${listingId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // Sin sessionStorage (modo privado estricto) se cuenta igualmente.
    }
    registerListingView(listingId).catch(() => {
      // Una vista que no se cuenta no es un error para el usuario.
    });
  }, [listingId]);
  return null;
}
