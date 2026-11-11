// Local interactive setup: the owner types the passphrase in a loopback-only page.
// Neither passphrase nor plaintext book is saved or printed by this helper.
import crypto from 'node:crypto';
import { Buffer } from 'node:buffer';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { spawn } from 'node:child_process';

const basePath = 'analysis/book-edition-v1.5/current.json';
const revisionPath = 'C:/Users/USER/Projects/파이널_단어장/data/edition_20261111_idiom_v1_7_3_content_closure/learning_projection.json';
const destination = path.resolve('output/protected-book-v174.bin');
const pdfPath = 'C:/Users/USER/Downloads/02_1권2권_태블릿_가로테스트_v1.7.4_2026-11-11.pdf';
const pdfHash = 'a2d2dfda7be3f8c0e08fd69615321f1b26d6fe2a8bebe83c40e6384f3be72955';
const baseHash = 'b3d300d8be9457bade7f35c4b0c8458ab97102072c6694427680177042420f1a';
const revisionHash = '7edd91a704b8e68d853c770cf6cc5e078e4f36f0a9f60b6480b03130f98ba9eb';
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const page = `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>교재 암호 설정</title><body><main style="font:18px sans-serif;max-width:32rem;margin:3rem auto;padding:1rem"><h1>교재 암호 설정</h1><p>기억하기 쉬우면서 추측하기 어려운 16자 이상의 암호 문구를 입력하세요. 이 암호는 채팅에 적지 마세요.</p><form id="form"><label>암호 <input id="pw" type="password" autocomplete="new-password" minlength="16" maxlength="1024" required></label><br><br><label>암호 다시 입력 <input id="again" type="password" autocomplete="new-password" minlength="16" maxlength="1024" required></label><br><br><button id="submit">암호화하기</button></form><p id="status" role="status"></p><p>암호를 잊으면 교재를 복호화할 수 없습니다. 안전한 곳에 직접 보관하세요.</p></main><script>document.querySelector('#form').addEventListener('submit',async e=>{e.preventDefault();let a=document.querySelector('#pw'),b=document.querySelector('#again'),s=document.querySelector('#status'),button=document.querySelector('#submit');if(a.value!==b.value){s.textContent='암호가 일치하지 않습니다.';return}button.disabled=true;s.textContent='암호화 중입니다…';try{let r=await fetch('/encrypt',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({password:a.value})});let x=await r.json();a.value='';b.value='';s.textContent=x.message;if(!r.ok)button.disabled=false}catch{a.value='';b.value='';button.disabled=false;s.textContent='암호화를 완료하지 못했습니다.'}})</script></body></html>`;
// The owner explicitly chose no minimum passphrase length. Never trim or alter it.
const ownerPage = page.replaceAll('16자 이상의 암호 문구', '암호')
  .replaceAll(' minlength="16"', '')
  .replace('<h1>교재 암호 설정</h1>', '<h1>v1.7.4 교재 암호 설정</h1>');
let busy = false;
const server = http.createServer((request, response) => {
  const origin = `http://127.0.0.1:${server.address().port}`;
  response.setHeader('Cache-Control', 'no-store');
  response.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'");
  if (request.headers.host !== `127.0.0.1:${server.address().port}`) { response.writeHead(403).end(); return; }
  if (request.method === 'GET' && request.url === '/') { response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(ownerPage); return; }
  if (request.method !== 'POST' || request.url !== '/encrypt' || request.headers.origin !== origin || request.headers['content-type'] !== 'application/json' || busy) {
    response.writeHead(403).end(); return;
  }
  busy = true;
  let raw = '';
  request.on('data', chunk => { raw += chunk; if (raw.length > 8192) request.destroy(); });
  request.on('end', () => {
    let password;
    try { password = JSON.parse(raw).password; raw = ''; } catch { password = ''; }
    if (typeof password !== 'string' || password.length === 0 || password.length > 1024) {
      busy = false; response.writeHead(400, { 'Content-Type': 'application/json' }).end(JSON.stringify({ message: '암호를 입력하세요.' })); return;
    }
    const lock = spawn('python', ['scripts/hold-development-lock.py'], { cwd: process.cwd(), env: { ...process.env, PYTHONUTF8: '1' }, stdio: ['pipe', 'pipe', 'ignore'] });
    let handled = false;
    lock.stdout.on('data', chunk => {
      const acquired = chunk.toString().match(/LOCK_ACQUIRED pid=\d+/);
      if (handled || !acquired) return;
      handled = true;
      console.log(acquired[0]);
      try {
        if (fs.existsSync(destination)) throw new Error('exists');
        const base = fs.readFileSync(basePath);
        const revision = fs.readFileSync(revisionPath);
        if (sha(base) !== baseHash || sha(revision) !== revisionHash || sha(fs.readFileSync(pdfPath)) !== pdfHash) throw new Error('source');
        const plaintext = Buffer.from(JSON.stringify({ schema: 2, edition: '1.7.4', pdfSha256: pdfHash, base: base.toString('utf8'), revision: revision.toString('utf8') }), 'utf8');
        if (plaintext.length > 96 * 1024 * 1024) throw new Error('size');
        const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12), magic = Buffer.from('FINETUNE-BOOK-1\n');
        const key = crypto.pbkdf2Sync(password, salt, 600000, 32, 'sha256');
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv); cipher.setAAD(magic);
        const encrypted = Buffer.concat([magic, salt, iv, cipher.update(plaintext), cipher.final(), cipher.getAuthTag()]);
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv); decipher.setAAD(magic);
        decipher.setAuthTag(encrypted.subarray(-16));
        const restored = Buffer.concat([decipher.update(encrypted.subarray(magic.length + 28, -16)), decipher.final()]);
        if (!restored.equals(plaintext)) throw new Error('roundtrip');
        restored.fill(0);
        fs.writeFileSync(destination, encrypted, { flag: 'wx' });
        plaintext.fill(0); key.fill(0); password = '';
        response.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ message: '암호화가 완료됐습니다. 이 창을 닫고 대화로 돌아와 주세요.' }));
        console.log('ENCRYPTED_FILE_READY');
      } catch {
        password = '';
        response.writeHead(409, { 'Content-Type': 'application/json' }).end(JSON.stringify({ message: '암호화를 완료하지 못했습니다. 기존 자료는 그대로입니다.' }));
      } finally { lock.stdin.write('\n'); }
    });
    lock.on('error', () => { if (!handled) { handled = true; busy = false; password = ''; response.writeHead(503).end(); } });
    lock.on('exit', code => {
      if (!handled) { handled = true; password = ''; response.writeHead(409, { 'Content-Type': 'application/json' }).end(JSON.stringify({ message: '다른 작업이 진행 중입니다. 잠시 후 다시 시도해 주세요.' })); }
      busy = false; console.log(code === 0 ? 'LOCK_RELEASED' : 'LOCK_NOT_ACQUIRED');
    });
  });
});
server.listen(0, '127.0.0.1', () => console.log(`LOCAL_SETUP http://127.0.0.1:${server.address().port}/`));
