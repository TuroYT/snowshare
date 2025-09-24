import { NextResponse } from 'next/server';

export async function GET() {
  try {
    return NextResponse.json({ status: 'healthy', timestamp: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json({ status: 'unhealthy', error: error }, { status: 500 });
  }
}