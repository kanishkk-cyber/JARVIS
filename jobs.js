// netlify/functions/jobs.js
// Accepts ?keyword= and ?location= for custom searches

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const apifyKey = process.env.APIFY_API_KEY;
  if (!apifyKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'APIFY_API_KEY not configured' }) };
  }

  const params = event.queryStringParameters || {};
  const keyword = params.keyword || 'Project Finance';
  const location = params.location || 'India';

  const allJobs = [];

  try {
    const indeed = await scrapeIndeed(keyword, location, apifyKey);
    allJobs.push(...indeed);
  } catch(e) { console.error('Indeed:', e.message); }

  try {
    const naukri = await scrapeNaukri(keyword, location, apifyKey);
    allJobs.push(...naukri);
  } catch(e) { console.error('Naukri:', e.message); }

  const seen = new Set();
  const unique = allJobs.filter(job => {
    const key = job.url || `${job.title}-${job.company}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  unique.sort((a, b) => new Date(b.postedAt || 0) - new Date(a.postedAt || 0));

  return {
    statusCode: 200,
    headers,
    body: JSON.stringify({ jobs: unique, total: unique.length, updated: new Date().toISOString() }),
  };
};

async function scrapeIndeed(keyword, location, apiKey) {
  const country = location.toLowerCase().includes('india') ? 'IN'
    : location.toLowerCase().includes('germany') ? 'DE'
    : location.toLowerCase().includes('uk') || location.toLowerCase().includes('united kingdom') ? 'GB'
    : location.toLowerCase().includes('usa') || location.toLowerCase().includes('united states') ? 'US'
    : location.toLowerCase().includes('singapore') ? 'SG'
    : 'IN';

  const res = await fetch(
    `https://api.apify.com/v2/acts/misceres~indeed-scraper/run-sync-get-dataset-items?token=${apiKey}&timeout=25&memory=256`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ position: keyword, country, location, maxItems: 5 }),
    }
  );
  if (!res.ok) throw new Error(`Indeed ${res.status}`);
  const items = await res.json();
  if (!Array.isArray(items)) return [];
  return items.map(item => ({
    title: item.positionName || '',
    company: item.company || '',
    location: item.location || location,
    url: item.url || '#',
    postedAt: item.postingDateParsed || '',
    type: Array.isArray(item.jobType) ? item.jobType[0] : 'Full-time',
    salary: item.salary || '',
    source: 'Indeed',
  })).filter(j => j.title);
}

async function scrapeNaukri(keyword, location, apiKey) {
  // Naukri is India-only
  if (!location.toLowerCase().includes('india')) return [];

  const res = await fetch(
    `https://api.apify.com/v2/acts/muhammetakkurtt~naukri-job-scraper/run-sync-get-dataset-items?token=${apiKey}&timeout=25&memory=256`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword, location: 'India', maxJobs: 50 }),
    }
  );
  if (!res.ok) throw new Error(`Naukri ${res.status}`);
  const items = await res.json();
  if (!Array.isArray(items)) return [];
  return items.slice(0, 5).map(item => ({
    title: item.title || '',
    company: item.companyName || '',
    location: item.location || 'India',
    url: item.jdURL || '#',
    postedAt: item.createdDate || '',
    type: 'Full-time',
    salary: item.salary !== 'Not disclosed' ? item.salary : '',
    experience: item.experienceText || '',
    source: 'Naukri',
  })).filter(j => j.title);
}
