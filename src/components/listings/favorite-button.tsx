"use client";

import { useFormStatus } from "react-dom";
import { HeartIcon } from "@/components/icons";
import { toggleFavorite } from "@/lib/favorites/actions";

type Labels = { save: string; remove: string };

/**
 * Guardar en favoritos. Es un formulario con Server Action: funciona sin JavaScript y,
 * sin sesión, lleva a entrar y vuelve al anuncio. Mientras se guarda ya muestra el estado nuevo.
 */
export function FavoriteButton({
  listingId,
  returnTo,
  saved,
  labels,
  className,
}: {
  listingId: string;
  returnTo: string;
  saved: boolean;
  labels: Labels;
  className?: string;
}) {
  return (
    <form action={toggleFavorite}>
      <input type="hidden" name="listingId" value={listingId} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <input type="hidden" name="save" value={saved ? "0" : "1"} />
      <HeartSubmit saved={saved} labels={labels} className={className} />
    </form>
  );
}

function HeartSubmit({
  saved,
  labels,
  className,
}: {
  saved: boolean;
  labels: Labels;
  className?: string;
}) {
  const { pending } = useFormStatus();
  const shown = pending ? !saved : saved;
  return (
    <button
      type="submit"
      aria-pressed={shown}
      aria-label={shown ? labels.remove : labels.save}
      className={className}
    >
      <HeartIcon filled={shown} className={`size-5 ${shown ? "text-primary" : ""}`} />
    </button>
  );
}
