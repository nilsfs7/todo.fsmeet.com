export function requestNow(): number {
  return Date.now();
}

export function getSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3003').replace(/\/$/, '');
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
