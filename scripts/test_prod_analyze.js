(async () => {
  try {
    const url = 'https://rutta-website.vercel.app/api/analyze';
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ element_type: 'beam', span: 6, support: 'simply_supported', loads: [{ type: 'point', magnitude: 10, position: 3 }] }),
    });
    const text = await res.text();
    console.log('URL:', url);
    console.log('Status:', res.status);
    console.log('Body:', text);
  } catch (err) {
    console.error('Request failed', err);
  }
})();
