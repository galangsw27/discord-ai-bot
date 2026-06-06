import { config } from '../config.js';

export async function searchWeb(query, options = {}) {
  const url = `${config.ninerouterUrl}/search`;
  const body = {
    model: options.model || config.searchModel,
    query,
    max_results: options.maxResults || 5,
    ...(options.searchType ? { search_type: options.searchType } : {}),
    ...(options.country ? { country: options.country } : {}),
    ...(options.language ? { language: options.language } : {}),
    ...(options.timeRange ? { time_range: options.timeRange } : {})
  };

  const headers = {
    'Content-Type': 'application/json',
    ...(config.ninerouterKey ? { Authorization: `Bearer ${config.ninerouterKey}` } : {}),
    ...(config.ninerouterConnectionId ? { 'x-connection-id': config.ninerouterConnectionId } : {})
  };

  const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Search API ${response.status}: ${errorBody}`);
  }

  const data = await response.json();

  return {
    provider: data.provider || '',
    query: data.query || query,
    answer: data.answer || '',
    results: Array.isArray(data.results)
      ? data.results.map(r => ({
          title: r.title || '',
          url: r.url || '',
          snippet: r.snippet || r.content || '',
          displayUrl: r.display_url || '',
          position: r.position || 0
        }))
      : [],
    usage: data.usage || {},
    metrics: data.metrics || {}
  };
}
