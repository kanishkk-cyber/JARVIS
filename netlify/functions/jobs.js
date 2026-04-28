// netlify/functions/jobs.js
// Live job scraping from LinkedIn + Naukri via Apify

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

  const searches = [
    { keyword: 'Project Finance', category: 'Project Finance' },
    { keyword: 'General Management Finance', category: 'General Management' },
    { keyword: 'Credit Appraisal', category: 'Credit Appraisal' },
    { keyword: 'Loan Appraisal', category: 'Loan Appraisal' },
    { keyword: 'Renewable Energy Finance', category: 'Renewable Financing' },
  ];

  try {
    // Run all searches in parallel — LinkedIn only (most reliable free actor)
    const results = await Promise.allSettled(
      searches.map(s => scrapeLinkedIn(s.keyword, s.category, apifyKey))
    );

    const allJobs = results
      .filter(r => r.status === 'fulfilled')
      .flatMap(r => r.value);

    // Deduplicate
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
      body: JSON.stringify({
        jobs: unique,
        total: unique.length,
        updated: new Date().toISOString(),
      }),
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};

async function scrapeLinkedIn(keyword, category, apiKey) {
  // Use the correct input format for bebity~linkedin-jobs-scraper
  const input = {
    title: keyword,
    location: 'India',
    rows: 5,
  };

  const url = `https://api.apify.com/v2/acts/bebity~linkedin-jobs-scraper/run-sync-get-dataset-items?token=${apiKey}&timeout=55&memory=256`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LinkedIn scraper error ${res.status}: ${text.substring(0, 200)}`);
  }

  const items = await res.json();
  if (!Array.isArray(items)) return [];

  return items.map(item => ({
    title: item.title || item.positionName || '',
    company: item.companyName || item.company || '',
    location: item.location || 'India',
    url: item.jobUrl || item.url || item.link || '#',
    postedAt: item.postedAt || item.date || '',
    type: item.workType || item.contractType || 'Full-time',
    salary: item.salary || '',
    source: 'LinkedIn',
    category,
  })).filter(j => j.title);
}
