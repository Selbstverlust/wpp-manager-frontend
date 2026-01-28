import { NextResponse } from 'next/server';

export async function GET(request: Request, context: { params: Promise<{ name: string }> }) {
  try {
    const { name: instanceName } = await context.params;
    const backendUrl = process.env.BACKEND_URL || 'http://backend:4000';
    
    // Get authorization header from the request
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      console.error('[API /instances/[name]/connect] Missing authorization header');
      return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 });
    }

    if (!instanceName) {
      console.error('[API /instances/[name]/connect] Missing instance name');
      return NextResponse.json({ error: 'Missing instance name' }, { status: 400 });
    }

    const url = `${backendUrl.replace(/\/$/, '')}/instances/${encodeURIComponent(instanceName)}/connect`;

    const backendResponse = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      cache: 'no-store',
    });

    const data = await backendResponse.json().catch(() => ({}));

    if (!backendResponse.ok) {
      console.error('[API /instances/[name]/connect] Failed to initiate connection:', {
        instanceName,
        status: backendResponse.status,
        statusText: backendResponse.statusText,
        details: data
      });
      return NextResponse.json(
        { error: 'Failed to initiate connection', details: data },
        { status: backendResponse.status }
      );
    }

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error('[API /instances/[name]/connect] Unexpected server error:', error);
    return NextResponse.json({ error: 'Unexpected server error' }, { status: 500 });
  }
}


