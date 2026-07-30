async function test() {
  try {
    const res = await fetch('http://localhost:5002/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tenant-db': 'starchicken_db',
        'x-license-key': 'STAR-CHICKEN-2026'
      },
      body: JSON.stringify({
        username: 'admin@starchicken.com',
        password: 'starchicken'
      })
    });
    const data = await res.text();
    console.log("Status:", res.status);
    console.log("Data:", data);
  } catch (err) {
    console.error("Error:", err.message);
  }
}
test();
