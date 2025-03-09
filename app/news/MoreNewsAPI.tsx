export interface Article {
    source: {
      id: string | null;
      name: string;
    };
    author: string | null;
    title: string;
    description: string;
    url: string;
    urlToImage: string | null;
    images: string[];      // additional field for all images
    thumbnails: string[];  // additional field for thumbnails
    publishedAt: string;
    content: string | null;
    categories: string[];
  }
  
  export async function fetchUmailArticles(): Promise<Article[]> {
    try {
      const response = await fetch('https://u-mail.co/api/NewsAPI/More-news');
      if (!response.ok) {
        throw new Error(`Error fetching news from u‑mail: ${response.status}`);
      }
      const data = await response.json();
      // Map each API result to our Article interface.
      const articles: Article[] = data.results.map((item: any) => ({
        source: { id: null, name: item.source },
        author: item.author,
        title: item.headline,
        description: item.description,
        url: item.link,
        // Use the main image if available, otherwise fallback to the first thumbnail.
        urlToImage: item.image || (item.thumbnails && item.thumbnails.length > 0 ? item.thumbnails[0] : null),
        images: item.images || [],
        thumbnails: item.thumbnails || [],
        publishedAt: item.publishedAt,
        content: item.content,
        categories: item.categories || [],
      }));
      return articles;
    } catch (error: any) {
      console.error('fetchUmailArticles error:', error);
      return [];
    }
  }
  