# BKLN Marketplace

Marketplace de clasificados para Guinea Ecuatorial: web mobile first con Next.js + Supabase, desplegada en Vercel.

La documentación del producto está en [`docs/`](docs/); para empezar, lee [`CLAUDE.md`](CLAUDE.md).

## Desarrollo

```bash
pnpm install
cp .env.example .env.local   # y rellena los valores
pnpm dev                     # http://localhost:3000
```

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Servidor de desarrollo |
| `pnpm build` | Build de producción |
| `pnpm test` | Tests (Vitest) |
| `pnpm lint` | Biome (lint + formato) |
| `pnpm typecheck` | Comprobación de tipos |
| `pnpm db:push` | Aplica las migraciones de `supabase/migrations/` al proyecto enlazado (pide la contraseña de la BD) |
| `pnpm db:types` | Regenera `src/lib/supabase/database.types.ts` |

Las migraciones se escriben a mano en SQL y se prueban siempre en el proyecto de desarrollo antes de llevarlas a producción.
