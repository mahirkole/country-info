// Local stand-in for the mail provider behind MAIL_WEBHOOK_URL: prints every digest instead of sending it.
//   node scripts/dev/mail-sink.mjs [port]   then   MAIL_WEBHOOK_URL=http://127.0.0.1:8025/ npm run digest
// Request: POST application/json {from, to, subject, text}; any 2xx answer counts as accepted.
import http from 'node:http';
http.createServer((req, res) => {
  let b = '';
  req.on('data', (c) => (b += c));
  req.on('end', () => {
    const m = JSON.parse(b || '{}');
    console.log(`--- mail from ${m.from} to ${m.to}\nSubject: ${m.subject}\n\n${m.text}\n`);
    res.end('ok');
  });
}).listen(Number(process.argv[2] ?? 8025), '127.0.0.1', () => console.log('mail sink listening'));
