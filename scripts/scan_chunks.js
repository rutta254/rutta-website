(async () => {
  try {
    const pageUrl = 'https://rutta-website.vercel.app/haya-structures';
    const pageRes = await fetch(pageUrl);
    const html = await pageRes.text();
    const regex = /src="([^"]*?_next\/static\/immutable\/chunks\/[^"]+)"/g;
    const matches = [];
    let m;
    while ((m = regex.exec(html)) !== null) {
      matches.push(m[1]);
    }
    console.log('Found chunk scripts:', matches.length);
    const toCheck = [...new Set(matches)].slice(0, 10);
    for (const rel of toCheck) {
      const url = rel.startsWith('http') ? rel : `https://rutta-website.vercel.app${rel}`;
      try {
        const r = await fetch(url);
        const text = await r.text();
        const hasApi = text.includes('/api/analyze');
        const hasLabel = text.includes('Run Analysis via Cloud API') || text.includes('Run Analysis');
        console.log(url, 'contains /api/analyze?', hasApi, 'contains label?', hasLabel);
      } catch (e) {
        console.error('Failed to fetch', url, e.message);
      }
    }
  } catch (err) {
    console.error(err);
  }
})();
