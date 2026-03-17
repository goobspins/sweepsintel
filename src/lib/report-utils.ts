import crypto from 'node:crypto';

export function getRequestIp(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0]?.trim() ?? 'unknown';
  }

  return (
    request.headers.get('cf-connecting-ip') ??
    request.headers.get('x-real-ip') ??
    'unknown'
  );
}

export function hashReporterIp(request: Request) {
  return crypto
    .createHash('sha256')
    .update(getRequestIp(request))
    .digest('hex');
}

