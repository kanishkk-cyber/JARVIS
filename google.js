const https = require('https');
const http = require('http');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const scriptUrl = process.env.GOOGLE_SCRIPT_URL;
  if (!scriptUrl) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'GOOGLE_SCRIPT_URL not configured' }) };
  }

  const params = event.queryStringParameters || {};
  const qs = new URLSearchParams(params).toString();
  const fullUrl = `${scriptUrl}${qs ? '?' + qs : ''}`;

  try {
    const { body, finalUrl } = await fetchWithRedirects(fullUrl);
    
    // Try to parse as JSON
    try {
      JSON.parse(body);
      return { statusCode: 200, headers, body };
    } catch(e) {
      // Not JSON - return the raw body for debugging
      return { 
        statusCode: 200, 
        headers, 
        body: JSON.stringify({ 
          error: 'Google returned non-JSON response', 
          preview: body.substring(0, 300),
          finalUrl: finalUrl
        }) 
      };
    }
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};

function fetchWithRedirects(url, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 15) return reject(new Error('Too many redirects'));
    
    const lib = url.startsWith('https') ? https : http;
    
    const req = lib.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json, text/plain, */*',
      }
    }, (res) => {
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        const next = res.headers.location;
        res.resume();
        return fetchWithRedirects(next, redirectCount + 1).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ body: data, finalUrl: url }));
      res.on('error', reject);
    });
    req.on('error', reject);
  });
}
