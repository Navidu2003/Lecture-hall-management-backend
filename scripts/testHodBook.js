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
    console.log('Logging in HOD...');
    const r1 = await post('/users/login', { email: 'chamara.silva@university.edu', password: 'Passw0rd!' });
    const token = r1.data && r1.data.token;
    if (!token) { console.log('Login failed', r1); return; }

    console.log('Attempting HOD direct booking...');
    const body = { hallId: '699ee96b352936605619d193', date: '2026-02-28', startTime: '10:00', endTime: '12:00', subject: 'Department Meeting', targetBatch: '2024' };
    const resp = await post('/hod/book-hall', body, token);
    console.log('BOOK HOD RESP', resp.status, resp.data);

  } catch (err) {
    console.error('Test error', err);
  }
})();
