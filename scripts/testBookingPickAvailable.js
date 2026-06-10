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
    console.log('Token:', !!tokenL);

    const searchDate = '2026-03-05'; // beyond initial 7-day seed
    console.log('Searching available halls for', searchDate, '08:00-10:00');
    const searchRes = await post('/lecture-halls/search', { date: searchDate, startTime: '08:00', endTime: '10:00' }, tokenL);
    console.log('Search status', searchRes.status);
    if (!Array.isArray(searchRes.data)) { console.log('Search data:', searchRes.data); return; }

    const available = searchRes.data.find(h => h.status === 'AVAILABLE');
    if (!available) { console.log('No available halls returned'); return; }

    console.log('Attempting booking for hall', available.name, available.id);
    const bookingBody = { hallId: available.id, date: searchDate, startTime: '08:00', endTime: '10:00', subject: 'Computer Networks' };
    const bk = await post('/bookings/range', bookingBody, tokenL);
    console.log('Booking response', bk.status, bk.data);
  } catch (err) {
    console.error('Test error', err);
  }
})();