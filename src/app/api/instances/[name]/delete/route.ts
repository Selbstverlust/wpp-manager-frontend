import { NextResponse } from 'next/server';

export async function DELETE(request: Request, context: { params: Promise<{ name: string }> }) {
  try {
    const { name: instanceName } = await context.params;
    const backendUrl = process.env.BACKEND_URL || 'http://backend:4000';
    
    console.log('[API /instances/[name]/delete] Starting instance deletion:', {
      instanceName,
      backendUrl
    });
    
    // Get authorization header from the request
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      console.error('[API /instances/[name]/delete] Missing authorization header');
      return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 });
    }

    if (!instanceName) {
      console.error('[API /instances/[name]/delete] Missing instance name');
      return NextResponse.json({ error: 'Missing instance name' }, { status: 400 });
    }

    const url = `${backendUrl.replace(/\/$/, '')}/instances/${encodeURIComponent(instanceName)}`;
    console.log('[API /instances/[name]/delete] Making request to:', url);

    const backendResponse = await fetch(url, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader,
      },
      cache: 'no-store',
    });

    console.log('[API /instances/[name]/delete] Backend response status:', backendResponse.status);

    const data = await backendResponse.json().catch(() => ({}));

    if (!backendResponse.ok) {
      console.error('[API /instances/[name]/delete] Failed to delete instance:', {
        instanceName,
        status: backendResponse.status,
        statusText: backendResponse.statusText,
        details: data
      });
      return NextResponse.json(
        { error: 'Failed to delete instance', details: data },
        { status: backendResponse.status }
      );
    }

    console.log('[API /instances/[name]/delete] Instance deleted successfully:', data);
    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error('[API /instances/[name]/delete] Unexpected server error:', error);
    return NextResponse.json({ error: 'Unexpected server error' }, { status: 500 });
  }
}


