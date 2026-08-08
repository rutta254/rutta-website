(async () => {
  try {
    const url = 'https://rutta-website.vercel.app/haya-structures';
    const res = await fetch(url);
    const text = await res.text();
    const found = text.includes('/api/analyze');
    console.log('URL:', url);
    console.log('Status:', res.status);
    console.log("Contains '/api/analyze'?:", found);
    if (!found) {
      console.log('Snippet preview:', text.slice(0, 800));
    }
  } catch (err) {
    console.error('Request failed', err);
  }
})();
