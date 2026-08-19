import { NextResponse } from 'next/server';
import { SessionManager } from '@/lib/engine/session-manager';

const sm = new SessionManager();

export async function GET() {
  return NextResponse.json({ sessions: sm.getAllSessions() });
}

export async function POST(req: Request) {
  const body = await req.json();
  const session = sm.createSession(body.name ?? 'Untitled', body.equity ?? 10000);
  return NextResponse.json({ session });
}