// netlify/functions/google.js
const https = require('https');

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
    const body = await fetchWithRedirects(fullUrl);
    // Validate it's JSON before returning
    JSON.parse(body); // throws if not JSON
    return { statusCode: 200, headers, body };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};

function fetchWithRedirects(url, redirectCount = 0) {
  return new Promise((resolve, reject) => {
    if (redirectCount > 10) return reject(new Error('Too many redirects'));
    
    https.get(url, (res) => {
      // Follow all redirects
      if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location) {
        return fetchWithRedirects(res.headers.location, redirectCount + 1)
          .then(resolve).catch(reject);
      }

      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}
