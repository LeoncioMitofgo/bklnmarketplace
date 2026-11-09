import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { summarizeValidation, type ValidationMetrics } from "./validation-summary";

// Métricas de validación (ALCANCE §9) que no están en admin_metrics. Se piden con la clave de servicio
// y solo desde el panel, que ya comprobó el rol (requireAdmin). Van en código y no en SQL porque no se
// prueban migraciones en producción hasta tener el proyecto de desarrollo (D-067); entonces conviene
// pasarlas a admin_metrics: con mucho volumen, traer estas listas pesaría (D-072).

const DAY = 86_400_000;
const LIMIT = 10_000;

export async function getValidationMetrics(now = Date.now()): Promise<ValidationMetrics> {
  const db = createAdminClient();
  const since30 = new Date(now - 30 * DAY).toISOString();
  const since7 = new Date(now - 7 * DAY).toISOString();
  const [
    published,
    conversations,
    calls,
    sellers,
    senders,
    publishers,
    newUsers,
    requests,
    activations,
  ] = await Promise.all([
    db.from("listings").select("id").gte("first_published_at", since30).limit(LIMIT),
    db
      .from("conversations")
      .select("listing_id")
      .gte("created_at", since30)
      .not("last_message_at", "is", null)
      .limit(LIMIT),
    db.from("call_clicks").select("listing_id").gte("created_at", since30).limit(LIMIT),
    db
      .from("profiles")
      .select("response_time_minutes")
      .not("response_time_minutes", "is", null)
      .limit(LIMIT),
    db.from("messages").select("sender_id").gte("created_at", since7).limit(LIMIT),
    db.from("listings").select("user_id").gte("published_at", since7).limit(LIMIT),
    db.from("profiles").select("id").gte("created_at", since7).limit(LIMIT),
    db
      .from("premium_requests")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since30),
    db
      .from("premium_activations")
      .select("id", { count: "exact", head: true })
      .gte("created_at", since30),
  ]);
  const failed = [
    published,
    conversations,
    calls,
    sellers,
    senders,
    publishers,
    newUsers,
    requests,
    activations,
  ].find((r) => r.error);
  if (failed?.error) throw new Error(`validation_metrics: ${failed.error.message}`);

  return summarizeValidation({
    publishedIds: (published.data ?? []).map((l) => l.id),
    conversationListingIds: (conversations.data ?? []).map((c) => c.listing_id),
    callListingIds: (calls.data ?? []).map((c) => c.listing_id),
    responseTimes: (sellers.data ?? []).flatMap((p) =>
      p.response_time_minutes === null ? [] : [p.response_time_minutes],
    ),
    activeUserIds: [
      ...(senders.data ?? []).map((m) => m.sender_id),
      ...(publishers.data ?? []).map((l) => l.user_id),
    ],
    newUserIds: (newUsers.data ?? []).map((p) => p.id),
    premiumRequests: requests.count ?? 0,
    premiumActivations: activations.count ?? 0,
  });
}
