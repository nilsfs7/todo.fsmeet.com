export function requestNow(): number {
  return Date.now();
}

export function getSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3003').replace(/\/$/, '');
}

function headerValue(value: string | null): string | null {
  const first = value?.split(',')[0]?.trim();
  return first || null;
}

function isInternalHost(host: string): boolean {
  const name = host.split(':')[0]?.toLowerCase();
  return name === 'localhost' || name === '127.0.0.1' || name === '0.0.0.0' || name === '::1';
}

/** Origin the browser used. Behind a reverse proxy, request.url is the container address. */
export function publicOrigin(request: Request): string {
  const host = headerValue(request.headers.get('x-forwarded-host')) ?? headerValue(request.headers.get('host'));
  if (host && !isInternalHost(host)) {
    const proto = headerValue(request.headers.get('x-forwarded-proto')) ?? new URL(getSiteUrl()).protocol.replace(':', '');
    return `${proto}://${host}`;
  }
  return getSiteUrl();
}

export function getFsmeetApiBase(): string {
  return (process.env.FSMEET_API_URL || 'https://api.fsmeet.dffb.org/v1').replace(/\/$/, '');
}

export function sanitizeReturnTo(value: string | null | undefined): string {
  if (!value) return '/projects';
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return '/projects';
  if (value.startsWith('/login') || value.startsWith('/api/auth')) return '/projects';
  return value;
}

export function assertSameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    const requestOrigin = new URL(request.url).origin;
    return origin === requestOrigin || origin === new URL(getSiteUrl()).origin;
  } catch {
    return false;
  }
}
