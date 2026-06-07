import { NextResponse, NextRequest } from 'next/server';

// Helper to construct response with CORS headers
function corsResponse(body: any, status: number, contentType: string, extraHeaders?: Record<string, string>) {
  const headers = new Headers();
  headers.set('Content-Type', contentType);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Range, Authorization');
  headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range');
  headers.set('Cache-Control', 'public, max-age=3600');

  if (extraHeaders) {
    Object.entries(extraHeaders).forEach(([key, value]) => {
      headers.set(key, value);
    });
  }

  return new NextResponse(body, {
    status,
    headers,
  });
}

export async function OPTIONS() {
  return corsResponse(null, 204, 'text/plain');
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return corsResponse('Missing url parameter', 400, 'text/plain');
  }

  try {
    // Fetch the target GCS signed URL server-side (where CORS is not enforced)
    const response = await fetch(targetUrl, {
      method: 'GET',
    });

    if (!response.ok) {
      console.error(`Failed to fetch target URL: ${response.status} ${response.statusText} for URL: ${targetUrl}`);
      return corsResponse(
        `Failed to fetch target URL from storage: ${response.statusText} (${response.status})`,
        response.status,
        'text/plain'
      );
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentLength = response.headers.get('content-length');

    const extraHeaders: Record<string, string> = {};
    if (contentLength) {
      extraHeaders['Content-Length'] = contentLength;
    }

    // Return the response body stream directly, fallback to buffer if body is null
    const body = response.body || Buffer.from(await response.arrayBuffer());
    return corsResponse(body, 200, contentType, extraHeaders);
  } catch (error: any) {
    console.error('CORS proxy error:', error);
    return corsResponse(`Proxy error: ${error.message}`, 500, 'text/plain');
  }
}

