import { NextRequest, NextResponse } from 'next/server';
import { parseHTML } from 'linkedom';
import { Readability } from '@mozilla/readability';
import DOMPurify from 'isomorphic-dompurify';

export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl.searchParams.get('url');

    if (!url) {
      return NextResponse.json({ error: 'URL parameter is required' }, { status: 400 });
    }

    // Fetch the article HTML
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
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

    // Sanitize the content HTML to remove scripts, iframes, and other unwanted elements
    const cleanContent = DOMPurify.sanitize(article.content || '', {
      ALLOWED_TAGS: [
        'p', 'br', 'hr', 'strong', 'em', 'b', 'i', 'u', 's', 'mark', 'small',
        'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'ul', 'ol', 'li', 'dl', 'dt', 'dd',
        'a', 'img', 'picture', 'source',
        'blockquote', 'q', 'cite',
        'code', 'pre', 'kbd', 'samp', 'var',
        'sup', 'sub', 'abbr', 'time',
        'del', 'ins',
        'figure', 'figcaption',
        'div', 'span', 'article', 'section', 'aside',
        'table', 'caption', 'thead', 'tbody', 'tfoot', 'tr', 'td', 'th'
      ],
      ALLOWED_ATTR: [
        'href', 'src', 'srcset', 'alt', 'title', 'cite',
        'class', 'id', 'style',
        'target', 'rel',
        'width', 'height',
        'colspan', 'rowspan',
        'datetime', 'type'
      ],
      ALLOW_DATA_ATTR: false,
      KEEP_CONTENT: true,
    });

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
