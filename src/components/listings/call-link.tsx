"use client";

import { PhoneIcon } from "@/components/icons";
import { registerCall } from "@/lib/stores/call-action";

/**
 * «Llamar» al teléfono para llamadas de una tienda (D-081). Es un enlace tel: normal, visible sin
 * sesión; al pulsarlo se apunta la llamada sin esperar respuesta.
 */
export function CallLink({
  phone,
  storeUserId,
  listingId = null,
  label,
  className,
  showLabel = true,
}: {
  phone: string;
  storeUserId: string;
  listingId?: string | null;
  label: string;
  className: string;
  showLabel?: boolean;
}) {
  return (
    <a
      href={`tel:${phone}`}
      aria-label={showLabel ? undefined : label}
      className={className}
      onClick={() => {
        registerCall(storeUserId, listingId).catch(() => {
          // Una llamada que no se cuenta no es un error para el usuario.
        });
      }}
    >
      <PhoneIcon className="size-5 shrink-0" />
      {showLabel ? label : null}
    </a>
  );
}
