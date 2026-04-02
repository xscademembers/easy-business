export function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD || 'admin123';
}

export function getTokenSecret(): string {
  return (
    process.env.ADMIN_TOKEN_SECRET ||
    'easy-business-secret-key-change-in-production'
  );
}

export function verifyAdminToken(token: string | undefined): boolean {
  if (!token) return false;
  return token === getTokenSecret();
}
