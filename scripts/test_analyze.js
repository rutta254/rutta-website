(async () => {
  try {
    const res = await fetch('http://localhost:3000/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ element_type: 'beam', span: 6, support: 'simply_supported', loads: [{ type: 'point', magnitude: 10, position: 3 }] }),
    });
    const text = await res.text();
    console.log('Status:', res.status);
    console.log('Headers:', Object.fromEntries(res.headers));
    console.log('Body:', text);
  } catch (err) {
    console.error('Request failed', err);
  }
})();
