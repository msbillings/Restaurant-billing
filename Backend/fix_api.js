async function fixTypo() {
  try {
    const loginRes = await fetch('http://localhost:5002/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'Mahesh', password: 'Mahesh@666' })
    });
    const loginData = await loginRes.json();
    const token = loginData.accessToken;
    
    const configsRes = await fetch('http://localhost:5002/api/printer-configs', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const configs = await configsRes.json();
    
    const targetConfig = configs.find(c => c.bluetoothAddress && c.bluetoothAddress.includes('C8478C'));
    if (!targetConfig) {
      console.log('No matching config found');
      return;
    }
    
    console.log('Found config:', targetConfig.name, targetConfig.bluetoothAddress);
    
    targetConfig.bluetoothAddress = 'C8478CE51148';
    
    const updateRes = await fetch(`http://localhost:5002/api/printer-configs/${targetConfig._id}`, {
      method: 'PUT',
      headers: { 
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(targetConfig)
    });
    console.log('Update result:', await updateRes.json());
    
  } catch (err) {
    console.error('Error:', err);
  }
}

fixTypo();
