async function test() {
  try {
    const loginRes = await fetch('http://127.0.0.1:5002/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'admin@almandi.com',
        password: 'almandi123'
      })
    });
    const loginData = await loginRes.json();
    
    if (!loginRes.ok) throw new Error(JSON.stringify(loginData));
    
    const token = loginData.accessToken;
    const tenantDb = loginData.user.resto_db_name;
    
    const expenseRes = await fetch('http://127.0.0.1:5002/api/expenses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-Tenant-DB': tenantDb
      },
      body: JSON.stringify({
        amount: 3400,
        description: 'mutton',
        category: 'Maintenance',
        paymentMode: 'Cash',
        date: '07/20/2026'
      })
    });
    
    const expenseData = await expenseRes.json();
    if (!expenseRes.ok) throw new Error(JSON.stringify(expenseData));
    
    console.log('Success:', expenseData);
  } catch (err) {
    console.error('API Error:', err.message);
  }
}

test();
