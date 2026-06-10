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
    const tokenL = r1.data && r1.data.token;

    const searchDate = '2026-03-06';
    console.log('Searching available halls for', searchDate, '08:00-10:00');
    const searchRes = await post('/lecture-halls/search', { date: searchDate, startTime: '08:00', endTime: '10:00' }, tokenL);
    if (!Array.isArray(searchRes.data)) { console.log('Search data:', searchRes.data); return; }

    const available = searchRes.data.find(h => h.status === 'AVAILABLE');
    if (!available) { console.log('No available halls returned'); return; }

    console.log('Booking with targetBatch 2024 for hall', available.name);
    const bookingBody = { hallId: available.id, date: searchDate, startTime: '08:00', endTime: '10:00', subject: 'Computer Networks', targetBatch: '2024' };
    const bk = await post('/bookings/range', bookingBody, tokenL);
    console.log('Booking response', bk.status, bk.data);

    // HOD approves
    console.log('Logging in HOD...');
    const rh = await post('/users/login', { email: 'chamara.silva@university.edu', password: 'Passw0rd!' });
    const tokenH = rh.data && rh.data.token;

    console.log('Fetching pending requests');
    const p = await get('/hod/pending', tokenH);
    const myReq = (p.data || []).find(r => r.lecturer && r.lecturer.email === 'alice.perera@university.edu' && r.subject === 'Computer Networks' && r.date === searchDate);
    if (!myReq) { console.log('No matching pending request found', p.data); return; }

    console.log('Approving requestId', myReq.requestId);
    const apr = await fetch(BASE + '/hod/request/' + myReq.requestId, { method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tokenH }, body: JSON.stringify({ status: 'APPROVED' }) });
    const aprText = await apr.text();
    try { console.log('APPROVE RESP', apr.status, JSON.parse(aprText)); } catch { console.log('APPROVE RESP', apr.status, aprText); }

    // Fetch notifications
    const lectNotes = await get('/notifications', tokenL);
    console.log('LECTURER /notifications', lectNotes.status, lectNotes.data && lectNotes.data.slice ? lectNotes.data.slice(0,5) : lectNotes.data);

    const hodNotes = await get('/notifications', tokenH);
    console.log('HOD /notifications', hodNotes.status, hodNotes.data && hodNotes.data.slice ? hodNotes.data.slice(0,10) : hodNotes.data);

  } catch (err) {
    console.error('Test error', err);
  }
})();