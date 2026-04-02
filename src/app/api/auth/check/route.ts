import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getTokenSecret } from '@/lib/auth';

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_token')?.value;
  const authenticated = token === getTokenSecret();
  return NextResponse.json({ authenticated });
}
