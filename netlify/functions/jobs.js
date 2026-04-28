// netlify/functions/jobs.js
// Scrapes LinkedIn, Naukri, Indeed, Glassdoor for all 5 job categories
// Uses Apify actors - no login required

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

  const categories = [
    'Project Finance India',
    'General Management Finance India',
    'Credit Appraisal India',
    'Loan Appraisal India',
    'Renewable Energy Finance India',
  ];

  const categoryMap = {
    'Project Finance India': 'Project Finance',
    'General Management Finance India': 'General Management',
    'Credit Appraisal India': 'Credit Appraisal',
    'Loan Appraisal India': 'Loan Appraisal',
    'Renewable Energy Finance India': 'Renewable Financing',
  };

  try {
    // Run LinkedIn + Naukri scrapes in parallel for all categories
    const [linkedinResults, naukriResults] = await Promise.all([
      scrapeLinkedIn(categories, apifyKey),
      scrapeNaukri(categories, apifyKey),
    ]);

    // Combine all results
    const allJobs = [...linkedinResults, ...naukriResults];

    // Assign categories based on keyword matching
    allJobs.forEach(job => {
      if (!job.category) {
        const title = (job.title || '').toLowerCase();
        if (title.includes('project finance') || title.includes('structured finance')) job.category = 'Project Finance';
        else if (title.includes('credit') || title.includes('appraisal')) job.category = 'Credit Appraisal';
        else if (title.includes('loan')) job.category = 'Loan Appraisal';
        else if (title.includes('renewable') || title.includes('green energy') || title.includes('solar')) job.category = 'Renewable Financing';
        else job.category = 'General Management';
      }
    });

    // Deduplicate by URL
    const seen = new Set();
    const unique = allJobs.filter(job => {
      const key = job.url || job.title + job.company;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Sort by date, newest first
    unique.sort((a, b) => new Date(b.postedAt || 0) - new Date(a.postedAt || 0));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        jobs: unique,
        total: unique.length,
        updated: new Date().toISOString(),
        sources: [...new Set(unique.map(j => j.source))],
      }),
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};

// ── LINKEDIN SCRAPER ──────────────────────────────────────────────────────────
async function scrapeLinkedIn(categories, apiKey) {
  const allJobs = [];
  for (const keyword of categories) {
    try {
      const input = {
        keyword,
        location: 'India',
        count: 5,
        proxy: { useApifyProxy: true },
      };
      const res = await callApify('bebity~linkedin-jobs-scraper', input, apiKey);
      const jobs = res.map(item => ({
        title: item.title || item.positionName || '',
        company: item.companyName || item.company || '',
        location: item.location || 'India',
        url: item.jobUrl || item.url || '#',
        postedAt: item.postedAt || item.publishedAt || '',
        type: item.workType || item.employmentType || 'Full-time',
        salary: item.salary || '',
        source: 'LinkedIn',
        category: getCategoryFromKeyword(keyword),
      })).filter(j => j.title);
      allJobs.push(...jobs);
    } catch(e) {
      console.error('LinkedIn error for', keyword, e.message);
    }
  }
  return allJobs;
}

// ── NAUKRI SCRAPER ────────────────────────────────────────────────────────────
async function scrapeNaukri(categories, apiKey) {
  const allJobs = [];
  for (const keyword of categories) {
    try {
      const input = {
        keyword: keyword.replace(' India', ''),
        location: 'India',
        maxJobs: 5,
      };
      const res = await callApify('ocrad~naukri-jobs-scraper', input, apiKey);
      const jobs = res.map(item => ({
        title: item.title || item.jobTitle || '',
        company: item.company || item.companyName || '',
        location: item.location || item.jobLocation || 'India',
        url: item.jdURL || item.url || item.jobUrl || '#',
        postedAt: item.createdDate || item.postedAt || '',
        type: item.workMode || item.jobType || 'Full-time',
        salary: item.salary || item.ctcString || '',
        experience: item.experience || '',
        source: 'Naukri',
        category: getCategoryFromKeyword(keyword),
      })).filter(j => j.title);
      allJobs.push(...jobs);
    } catch(e) {
      console.error('Naukri error for', keyword, e.message);
    }
  }
  return allJobs;
}

// ── APIFY CALLER ──────────────────────────────────────────────────────────────
async function callApify(actorId, input, apiKey) {
  const url = `https://api.apify.com/v2/acts/${actorId}/run-sync-get-dataset-items?token=${apiKey}&timeout=55&memory=256`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(`Apify ${actorId} returned ${res.status}`);
  return await res.json();
}

function getCategoryFromKeyword(keyword) {
  if (keyword.includes('Project Finance')) return 'Project Finance';
  if (keyword.includes('General Management')) return 'General Management';
  if (keyword.includes('Credit')) return 'Credit Appraisal';
  if (keyword.includes('Loan')) return 'Loan Appraisal';
  if (keyword.includes('Renewable')) return 'Renewable Financing';
  return 'General';
}
