const Parser = require('rss-parser');

const parser = new Parser();
const GEMINI_MODEL = 'gemini-3.6-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// ---- build a Google News RSS search URL for any company ----
function buildFeedUrl(company) {
  const q = encodeURIComponent(company);
  return `https://news.google.com/rss/search?q=${q}&hl=en-US&gl=US&ceid=US:en`;
}

// ---- keyword-based focus classification ----
const FOCUS_KEYWORDS = {
  product: ['launch', 'unveil', 'release', 'debut', 'new model', 'update', 'rollout', 'ship'],
  partnerships: ['partner', 'partnership', 'collaborat', 'deal with', 'teams up', 'agreement', 'alliance'],
  funding: ['raise', 'funding', 'investment', 'investor', 'valuation', 'ipo', 'acquisition', 'acquire', 'merger', 'stake'],
  hiring: ['hire', 'hiring', 'layoff', 'jobs', 'workforce', 'headcount', 'staff'],
  regulation: ['regulat', 'lawsuit', 'investigat', 'probe', 'tariff', 'compliance', 'fine', 'ban', 'sec ']
};

function classifyFocus(title, snippet) {
  const text = `${title} ${snippet}`.toLowerCase();
  for (const [focus, keywords] of Object.entries(FOCUS_KEYWORDS)) {
    if (keywords.some(k => text.includes(k))) return focus;
  }
  return 'other';
}

// ---- date window filter ----
function withinWindow(pubDate, windowDays) {
  const days = (Date.now() - new Date(pubDate).getTime()) / 86400000;
  return days <= windowDays && days >= 0;
}

// ---- ask Gemini for one department-specific relevance blurb ----
async function generateBlurb(company, title, snippet, dept, apiKey) {
  const deptContext = {
    sales: 'a salesperson preparing to reach out to a prospect or account — what talking point or opening does this give them',
    marketing: 'a marketer planning campaigns or positioning — what does this change about messaging, timing, or targeting',
    support: 'a customer support lead preparing their team — what ticket volume, questions, or issues should they expect'
  };

  const prompt = `Company being monitored: ${company}
News item: "${title}"
Snippet: "${snippet}"

Write ONE sentence (max 30 words) explaining why this news item matters specifically to ${deptContext[dept]}. Be concrete and actionable, not generic. No preamble, just the sentence.`;

  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 100, temperature: 0.6 }
    })
  });

  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Gemini API error (${res.status}): ${errBody.slice(0, 200)}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return (text || 'Relevance note unavailable for this item.').trim();
}

exports.handler = async (event) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'GEMINI_API_KEY is not set in this site\'s environment variables.' })
      };
    }

    const { company = 'Google', focus = 'all', window = '7', dept = 'sales' } = event.queryStringParameters || {};
    const windowDays = parseInt(window, 10);

    const feed = await parser.parseURL(buildFeedUrl(company));

    let items = feed.items
      .filter(it => withinWindow(it.pubDate, windowDays))
      .map(it => ({
        title: it.title,
        url: it.link,
        source: (it.title.match(/- (.*?)$/) || [])[1] || 'Unknown source',
        date: it.pubDate,
        snippet: (it.contentSnippet || '').slice(0, 200),
        focus: classifyFocus(it.title, it.contentSnippet || '')
      }));

    if (focus !== 'all') {
      items = items.filter(it => it.focus === focus);
    }

    items = items
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 20);

    items = await Promise.all(items.map(async (it) => ({
      ...it,
      why: await generateBlurb(company, it.title, it.snippet, dept, apiKey)
    })));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items, count: items.length })
    };
  } catch (err) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};
