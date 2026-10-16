// Tipos del chat compartidos por servidor y cliente.

export type ChatMessage = {
  id: number;
  sender_id: string | null;
  body: string | null;
  image_path: string | null;
  created_at: string;
  /** URL firmada de la foto (bucket privado), si la tiene. */
  image_url?: string | null;
};

export type ConversationRole = "buyer" | "seller";

export const CHAT_IMAGES_BUCKET = "chat-images";

/** Mensajes por página de la conversación ("Ver anteriores" pide más). */
export const MESSAGES_PAGE = 50;
