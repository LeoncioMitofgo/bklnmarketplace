import type { Instrumentation } from "next";
import { describeError } from "@/lib/monitoring/report";
import { captureError } from "@/lib/monitoring/sentry";

// Errores del servidor (pantallas, Server Actions, rutas de la API y proxy) a Sentry (D-072).
// Next ya descarta las redirecciones, los notFound() y las peticiones que corta el navegador.
export const onRequestError: Instrumentation.onRequestError = (err, request, context) =>
  captureError({
    source: "server",
    ...describeError(err),
    path: request.path,
    method: request.method,
    route: context.routePath,
    userAgent: [request.headers["user-agent"]].flat()[0],
    tags: { route_type: context.routeType, render_source: context.renderSource },
  });
