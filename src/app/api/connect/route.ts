import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { instanceName } = await request.json();

    if (!instanceName || typeof instanceName !== 'string') {
      console.error('[API /connect] Invalid instanceName provided:', instanceName);
      return NextResponse.json({ error: 'Invalid instanceName' }, { status: 400 });
    }

    const baseUrl = process.env.WPP_API_BASE_URL;
    const apiKey = process.env.WPP_API_KEY;
    const integration = process.env.WPP_INTEGRATION_TYPE;

    if (!baseUrl || !apiKey || !integration) {
      console.error('[API /connect] Server misconfiguration - missing environment variables');
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }

    const url = `${baseUrl.replace(/\/$/, '')}/instance/create`;

    const upstreamResponse = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
      },
      body: JSON.stringify({
        instanceName,
        integration,
        qrcode: true,
      }),
    });

    const data = await upstreamResponse.json().catch(() => ({}));

    if (!upstreamResponse.ok) {
      console.error('[API /connect] Failed to create instance:', {
        instanceName,
        status: upstreamResponse.status,
        statusText: upstreamResponse.statusText,
        details: data
      });
      return NextResponse.json(
        { error: 'Failed to create instance', details: data },
        { status: upstreamResponse.status }
      );
    }

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    console.error('[API /connect] Unexpected server error:', error);
    return NextResponse.json({ error: 'Unexpected server error' }, { status: 500 });
  }
}


