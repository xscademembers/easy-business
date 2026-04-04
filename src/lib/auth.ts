export function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD || 'admin123';
}

/** Value stored in the admin cookie; change in code for production if you need a unique secret. */
const ADMIN_SESSION_TOKEN_VALUE =
  'easy-business-secret-key-change-in-production';

export function getTokenSecret(): string {
  return ADMIN_SESSION_TOKEN_VALUE;
}

export function verifyAdminToken(token: string | undefined): boolean {
  if (!token) return false;
  return token === getTokenSecret();
}
