import { NextRequest, NextResponse } from 'next/server';

const BACKEND_URL = process.env.BACKEND_URL || 'http://backend:4000';

export async function GET(request: NextRequest) {
  try {
    const response = await fetch(`${BACKEND_URL}/example-prompts`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Backend responded with status: ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Error fetching example prompts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch example prompts' },
      { status: 500 }
    );
  }
}
