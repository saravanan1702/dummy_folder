// Fake Telegram Bot API + Meta Graph API that record every outbound call.
const http = require('http');
const calls = [];
http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => (body += c));
  req.on('end', () => {
    const json = body ? JSON.parse(body) : null;
    if (req.url === '/__calls') { res.end(JSON.stringify(calls)); return; }
    calls.push({ method: req.method, url: req.url, auth: req.headers.authorization || null, body: json });
    res.setHeader('content-type', 'application/json');
    let m;
    if ((m = req.url.match(/^\/bot([^/]+)\/(\w+)/))) {
      if (m[1].startsWith('bad')) return res.end(JSON.stringify({ ok: false, description: 'Unauthorized' }));
      const method = m[2];
      if (method === 'getMe') return res.end(JSON.stringify({ ok: true, result: { id: 777, username: 'acme_test_bot', first_name: 'Acme Bot' } }));
      if (method === 'sendMessage' || method === 'sendPhoto') return res.end(JSON.stringify({ ok: true, result: { message_id: calls.length } }));
      return res.end(JSON.stringify({ ok: true, result: true }));
    }
    if (req.url.startsWith('/v24.0/1029384756?')) return res.end(JSON.stringify({ id: '1029384756', display_phone_number: '+1 555 0100', verified_name: 'Acme WA' }));
    if (req.url.startsWith('/v24.0/me?fields=')) {
      if (req.headers.authorization === 'Bearer ig-page-token-123') return res.end(JSON.stringify({ id: 'PAGE2', name: 'Acme IG Page', instagram_business_account: { id: 'IG99', username: 'acme.ig' } }));
      return res.end(JSON.stringify({ id: 'PAGE1', name: 'Acme Page' }));
    }
    if (req.url.startsWith('/v24.0/1029384756/messages')) return res.end(JSON.stringify({ messages: [{ id: 'wamid.' + calls.length }] }));
    if (req.url.startsWith('/v24.0/me/messages')) return res.end(JSON.stringify({ message_id: 'mid.' + calls.length }));
    if (req.url.match(/^\/v24\.0\/\w+\?fields=/)) return res.end(JSON.stringify({ first_name: 'Pat', last_name: 'Lee', name: 'Pat Lee', username: 'patlee' }));
    res.statusCode = 404; res.end(JSON.stringify({ error: { message: 'not mocked ' + req.url } }));
  });
}).listen(4010, () => console.log('mock on 4010'));
