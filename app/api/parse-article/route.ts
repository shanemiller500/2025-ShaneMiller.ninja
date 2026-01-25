import { NextRequest, NextResponse } from 'next/server';
import { parseHTML } from 'linkedom';
import { Readability } from '@mozilla/readability';

// Simple HTML sanitizer that works on serverless (no native deps)
function sanitizeHtml(html: string): string {
  if (!html) return '';

  return html
    // Remove script tags and content
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove style tags and content
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    // Remove iframe tags
    .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
    .replace(/<iframe[^>]*\/>/gi, '')
    // Remove object/embed tags
    .replace(/<object[^>]*>.*?<\/object>/gi, '')
    .replace(/<embed[^>]*\/?>/gi, '')
    // Remove on* event handlers
    .replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/\s+on\w+\s*=\s*[^\s>]+/gi, '')
    // Remove javascript: URLs
    .replace(/href\s*=\s*["']javascript:[^"']*["']/gi, 'href="#"')
    // Remove data: URLs in src (potential XSS)
    .replace(/src\s*=\s*["']data:[^"']*["']/gi, 'src=""');
}

export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl.searchParams.get('url');

    if (!url) {
      return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
    }

    // Validate URL
    try {
      new URL(url);
    } catch {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    // Fetch the article HTML
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
      signal: AbortSignal.timeout(10000), // 10s timeout
    });

    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch article' }, { status: response.status });
    }

    const html = await response.text();

    // Parse with linkedom (serverless-compatible) + Readability
    const { document } = parseHTML(html);

    // Set the document URL for Readability
    Object.defineProperty(document, 'documentURI', { value: url, writable: false });

    const reader = new Readability(document as any);
    const article = reader.parse();

    if (!article) {
      return NextResponse.json({ error: 'Failed to parse article content' }, { status: 500 });
    }

    // Sanitize the content
    const cleanContent = sanitizeHtml(article.content || '');

    return NextResponse.json({
      title: article.title,
      content: cleanContent,
      textContent: article.textContent,
      excerpt: article.excerpt,
      byline: article.byline,
      length: article.length,
      siteName: article.siteName,
    });
  } catch (error: any) {
    console.error('Article parsing error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
