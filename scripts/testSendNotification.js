const BASE = 'http://localhost:3000';

async function post(path, body, token) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify(body)
  });
  const text = await res.text();
  try { return { status: res.status, data: JSON.parse(text) }; } catch { return { status: res.status, data: text }; }
}

async function get(path, token) {
  const res = await fetch(BASE + path, { headers: { ...(token ? { Authorization: 'Bearer ' + token } : {}) } });
  const text = await res.text();
  try { return { status: res.status, data: JSON.parse(text) }; } catch { return { status: res.status, data: text }; }
}

(async () => {
  try {
    console.log('Logging in lecturer...');
    const r1 = await post('/users/login', { email: 'alice.perera@university.edu', password: 'Passw0rd!' });
    const token = r1.data && r1.data.token;

    if (!token) { console.log('Login failed', r1); return; }

    console.log('Sending notification to Batch 2024');
    const send = await post('/notifications', { message: 'Test notice for batch 2024', batch: '2024' }, token);
    console.log('SEND RESP', send.status, send.data);

    console.log('Fetching lecturer notifications');
    const notes = await get('/notifications', token);
    console.log('LECT /notifications', notes.status, notes.data && notes.data.slice ? notes.data.slice(0,5) : notes.data);
  } catch (err) {
    console.error('Test error', err);
  }
})();
