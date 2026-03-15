export function methodNotAllowed(allowed: string[]) {
  return new Response(JSON.stringify({ error: 'Method not allowed.' }), {
    status: 405,
    headers: {
      'Content-Type': 'application/json',
      Allow: allowed.join(', '),
    },
  });
}
