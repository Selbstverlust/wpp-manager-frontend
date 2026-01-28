import { NextResponse } from 'next/server';

export async function POST(request: Request, context: { params: Promise<{ name: string }> }) {
  try {
    const { name: instanceName } = await context.params;
    const backendUrl = process.env.BACKEND_URL || 'http://backend:4000';
    
    console.log('[API /instances/[name]/webhook] Starting webhook configuration:', {
      instanceName,
      backendUrl
    });
    
    // Get authorization header from the request
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      console.error('[API /instances/[name]/webhook] Missing authorization header');
      return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 });
    }

    if (!instanceName) {
      console.error('[API /instances/[name]/webhook] Missing instance name');
      return NextResponse.json({ error: 'Missing instance name' }, { status: 400 });
    }

    const url = `${backendUrl.replace(/\/$/, '')}/instances/${encodeURIComponent(instanceName)}/webhook`;
    console.log('[API /instances/[name]/webhook] Making request to:', url);

    const backendResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
    });

    console.log('[API /instances/[name]/webhook] Backend response status:', backendResponse.status);

    const data = await backendResponse.json().catch(() => ({}));

    if (!backendResponse.ok) {
      console.error('[API /instances/[name]/webhook] Failed to configure webhook:', {
        instanceName,
        status: backendResponse.status,
        statusText: backendResponse.statusText,
        details: data
      });
      return NextResponse.json(
        { error: 'Failed to configure webhook', details: data },
        { status: backendResponse.status }
      );
    }

    console.log('[API /instances/[name]/webhook] Webhook configured successfully:', data);
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error('[API /instances/[name]/webhook] Unexpected server error:', error);
    return NextResponse.json({ error: 'Unexpected server error' }, { status: 500 });
  }
}
