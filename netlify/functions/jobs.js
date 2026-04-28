// netlify/functions/jobs.js
// Indeed + Naukri — both confirmed working for India via live Apify MCP testing

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
    // Run Indeed + Naukri in parallel for all 5 categories
    const [indeedResults, naukriResults] = await Promise.all([
      Promise.allSettled(searches.map(s => scrapeIndeed(s.keyword, s.category, apifyKey))),
      Promise.allSettled(searches.map(s => scrapeNaukri(s.keyword, s.category, apifyKey))),
    ]);

    const allJobs = [
      ...indeedResults.filter(r => r.status === 'fulfilled').flatMap(r => r.value),
      ...naukriResults.filter(r => r.status === 'fulfilled').flatMap(r => r.value),
    ];

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
      body: JSON.stringify({ jobs: unique, total: unique.length, updated: new Date().toISOString() }),
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};

// ── INDEED (country: IN confirmed working) ───────────────────────────────────
async function scrapeIndeed(keyword, category, apiKey) {
  const res = await fetch(
    `https://api.apify.com/v2/acts/misceres~indeed-scraper/run-sync-get-dataset-items?token=${apiKey}&timeout=55&memory=256`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ position: keyword, country: 'IN', location: 'India', maxItems: 4 }),
    }
  );
  if (!res.ok) throw new Error(`Indeed ${res.status}`);
  const items = await res.json();
  if (!Array.isArray(items)) return [];

  return items.map(item => ({
    title: item.positionName || '',
    company: item.company || '',
    location: item.location || 'India',
    url: item.url || '#',
    postedAt: item.postingDateParsed || '',
    type: Array.isArray(item.jobType) ? item.jobType[0] : 'Full-time',
    salary: item.salary || '',
    source: 'Indeed',
    category,
  })).filter(j => j.title);
}

// ── NAUKRI (confirmed working, returns ₹ salaries) ───────────────────────────
async function scrapeNaukri(keyword, category, apiKey) {
  const res = await fetch(
    `https://api.apify.com/v2/acts/muhammetakkurtt~naukri-job-scraper/run-sync-get-dataset-items?token=${apiKey}&timeout=55&memory=256`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword, location: 'India', maxJobs: 50 }),
    }
  );
  if (!res.ok) throw new Error(`Naukri ${res.status}`);
  const items = await res.json();
  if (!Array.isArray(items)) return [];

  // Take only first 4 results per category
  return items.slice(0, 4).map(item => ({
    title: item.title || '',
    company: item.companyName || '',
    location: item.location || 'India',
    url: item.jdURL || '#',
    postedAt: item.createdDate || '',
    type: 'Full-time',
    salary: item.salary !== 'Not disclosed' ? item.salary : '',
    experience: item.experienceText || '',
    source: 'Naukri',
    category,
  })).filter(j => j.title);
}
