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
    console.log('LECTURER LOGIN', r1.status, r1.data);
    const tokenL = r1.data && r1.data.token;

    console.log('Fetching halls...');
    const halls = await get('/lecture-halls', tokenL);
    console.log('HALLS', halls.status, halls.data && halls.data.length ? halls.data[0] : halls.data);
    const hallId = halls.data && halls.data.length ? halls.data[0]._id : null;
    if (!hallId) { console.error('No hall found'); return; }

    // Search available halls for the requested range
    console.log('Searching available halls for 2026-02-26 08:00-10:00');
    const searchRes = await post('/lecture-halls/search', { date: '2026-02-26', startTime: '08:00', endTime: '10:00' }, tokenL);
    console.log('/lecture-halls/search', searchRes.status, searchRes.data);

    console.log('Creating range booking as lecturer...');
    const bookingBody = { hallId, date: '2026-02-26', startTime: '08:00', endTime: '10:00', subject: 'Computer Networks' };
    const r2 = await post('/bookings/range', bookingBody, tokenL);
    console.log('BOOKING CREATE', r2.status, r2.data);

    console.log('Logging in HOD...');
    const r3 = await post('/users/login', { email: 'chamara.silva@university.edu', password: 'Passw0rd!' });
    console.log('HOD LOGIN', r3.status, r3.data);
    const tokenH = r3.data && r3.data.token;

    console.log('HOD fetching /hod/pending');
    const p = await get('/hod/pending', tokenH);
    console.log('/hod/pending', p.status, p.data);

      console.log('HOD fetching /bookings');
      const b = await get('/bookings', tokenH);
      console.log('/bookings', b.status, Array.isArray(b.data) ? b.data.slice(0,10) : b.data);

      // Approve first pending request (if any)
      if (Array.isArray(p.data) && p.data.length) {
        const reqId = p.data[0].requestId;
        console.log('HOD approving requestId', reqId);
        const apr = await fetch(BASE + '/hod/request/' + reqId, {
          method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tokenH }, body: JSON.stringify({ status: 'APPROVED' })
        });
        const aprText = await apr.text();
        try { console.log('APPROVE RESP', apr.status, JSON.parse(aprText)); } catch { console.log('APPROVE RESP', apr.status, aprText); }

        // Fetch bookings again
        const after = await get('/bookings', tokenH);
        console.log('/bookings after approve', after.status, Array.isArray(after.data) ? after.data.slice(0,10) : after.data);

        // Check lecturer notifications
        const lectNotes = await get('/notifications', tokenL);
        console.log('LECTURER /notifications', lectNotes.status, lectNotes.data && lectNotes.data.slice ? lectNotes.data.slice(0,5) : lectNotes.data);
      }

  } catch (err) {
    console.error('Test script error', err);
  }
})();
