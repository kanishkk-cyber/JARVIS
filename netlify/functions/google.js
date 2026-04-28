// netlify/functions/google.js
// Proxies all Google Apps Script calls server-side — bypasses CORS permanently.
// Set GOOGLE_SCRIPT_URL in Netlify → Site Settings → Environment Variables

const https = require('https');
const http = require('http');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const scriptUrl = process.env.GOOGLE_SCRIPT_URL;
  if (!scriptUrl) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'GOOGLE_SCRIPT_URL not set in Netlify environment variables' }),
    };
  }

  // Build query string from request params
  let params = {};
  if (event.httpMethod === 'GET') {
    params = event.queryStringParameters || {};
  } else {
    try { params = JSON.parse(event.body || '{}'); } catch { params = {}; }
  }

  const qs = new URLSearchParams(params).toString();
  const fullUrl = `${scriptUrl}${qs ? '?' + qs : ''}`;

  try {
    const data = await fetchUrl(fullUrl);
    return { statusCode: 200, headers, body: data };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message }),
    };
  }
};

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith('https') ? https : http;
    let redirectCount = 0;

    function doRequest(currentUrl) {
      lib.get(currentUrl, (res) => {
        // Follow redirects (Google Apps Script redirects a lot)
        if ((res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 303) && res.headers.location) {
          if (redirectCount++ > 10) return reject(new Error('Too many redirects'));
          const redirectUrl = res.headers.location;
          const nextLib = redirectUrl.startsWith('https') ? require('https') : require('http');
          nextLib.get(redirectUrl, handleResponse).on('error', reject);
          return;
        }
        handleResponse(res);
      }).on('error', reject);
    }

    function handleResponse(res) {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve(body));
    }

    doRequest(url);
  });
}
