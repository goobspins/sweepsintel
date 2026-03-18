import type { APIRoute } from 'astro';

import { isHttpError, requireAdmin, requireAuth, type SessionUser } from './auth';

export type AuthMode = 'public' | 'auth' | 'admin' | 'cron';

export interface RouteOptions {
  auth?: AuthMode;
}

export interface RouteContext {
  request: Request;
  params: Record<string, string>;
  user: SessionUser | null;
  body: Record<string, unknown> | null;
  event: null;
}

type RouteResult = Response | ({ _status?: number } & Record<string, unknown>);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function isJsonBodyMethod(method: string) {
  return method === 'POST' || method === 'PUT' || method === 'PATCH';
}

async function resolveUser(request: Request, authMode: AuthMode) {
  if (authMode === 'public' || authMode === 'cron') return null;
  if (authMode === 'admin') return requireAdmin(request);
  return requireAuth(request);
}

function hasCronAccess(request: Request) {
  const expected = import.meta.env.CRON_SECRET;
  if (!expected) return false;
  const header = request.headers.get('authorization') ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7).trim() : '';
  return token === expected;
}

/**
 * Thin wrapper for API route handlers. Handles auth, body parsing,
 * JSON serialization, and error responses.
 *
 * @example
 * // Auth-required POST endpoint
 * export const POST: APIRoute = withRoute(async (ctx) => {
 *   const { name } = ctx.body!;
 *   await query('UPDATE ... WHERE user_id = $1', [ctx.user!.userId]);
 *   return { success: true };
 * });
 *
 * @example
 * // Admin endpoint with custom status
 * export const POST: APIRoute = withRoute(async () => {
 *   return { _status: 201, created: true };
 * }, { auth: 'admin' });
 *
 * @example
 * // Cron job
 * export const GET: APIRoute = withRoute(async () => {
 *   return { success: true };
 * }, { auth: 'cron' });
 *
 * @example
 * // Public endpoint
 * export const POST: APIRoute = withRoute(async () => {
 *   return { success: true };
 * }, { auth: 'public' });
 */
export function withRoute(
  handler: (ctx: RouteContext) => RouteResult | Promise<RouteResult>,
  options: RouteOptions = {},
): APIRoute {
  const authMode = options.auth ?? 'auth';

  return async ({ request, params }) => {
    const routePath = new URL(request.url).pathname;

    try {
      if (authMode === 'cron' && !hasCronAccess(request)) {
        return json({ error: 'Unauthorized.' }, 401);
      }

      let body: Record<string, unknown> | null = null;
      if (isJsonBodyMethod(request.method)) {
        try {
          body = await request.json();
        } catch {
          return json({ error: 'Invalid JSON body.' }, 400);
        }
      }

      const result = await handler({
        request,
        params: Object.fromEntries(
          Object.entries(params).map(([key, value]) => [key, value ?? '']),
        ),
        user: await resolveUser(request, authMode),
        body,
        event: null,
      });

      if (result instanceof Response) {
        return result;
      }

      const { _status, ...data } = result;
      return json(data, _status ?? 200);
    } catch (error) {
      if (isHttpError(error)) {
        return json({ error: error.message }, error.status === 302 ? 401 : error.status);
      }
      console.error(`[${routePath}]`, error);
      return json({ error: 'Internal server error.' }, 500);
    }
  };
}
