import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import worker from './dist/server/index.js';
const sqlite=new DatabaseSync(':memory:');
for(const f of fs.readdirSync('drizzle').filter(f=>f.endsWith('.sql')).sort())sqlite.exec(fs.readFileSync('drizzle/'+f,'utf8'));
const DB={prepare(sql){const statement=sqlite.prepare(sql);let values=[];const api={bind(...v){values=v;return api;},async first(){return statement.get(...values)||null;},async all(){return {results:statement.all(...values)};},async run(){return statement.run(...values);}};return api;}};
const env={DB,TEACHER_KEY:'local-test-teacher-key',SESSION_SECRET:'local-test-session-secret',ALLOWED_ORIGIN:'http://localhost:4173'};
async function call(path,{body,token,origin='http://localhost:4173'}={}){const r=await worker.fetch(new Request('https://records.example'+path,{method:body?'POST':'GET',headers:{Origin:origin,...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined}),env);return {status:r.status,headers:r.headers,data:await r.json()};}
assert.equal((await call('/api/records')).status,401);
assert.equal((await call('/api/records',{token:'wrong'})).status,401);
assert.equal((await call('/api/visit',{body:{studentId:'TEST01',requestId:crypto.randomUUID()},origin:'https://other.example'})).status,403);
const requestId=crypto.randomUUID();const first=await call('/api/visit',{body:{studentId:'test01',requestId}});assert.equal(first.status,200);assert.equal(first.data.studentId,'TEST01');
const repeat=await call('/api/visit',{body:{studentId:'test01',requestId}});assert.equal(repeat.data.token,first.data.token);
assert.equal((await call('/api/visit',{body:{studentId:'TEST02',requestId}})).status,409);
const token=first.data.token;
assert.equal((await call('/api/records',{token})).status,401);
assert.equal((await call('/api/complete',{body:{activity:'reading',answers:[0,1,2,0,1]},token:'forged'})).status,401);
assert.equal((await call('/api/complete',{body:{activity:'reading',answers:[99]},token})).status,400);
assert.equal((await call('/api/complete',{body:{activity:'grammar',answers:[0,2,1],writing:['','','']},token})).status,400);
const a=JSON.parse(fs.readFileSync('activities.json','utf8'));
for(const activity of ['reading','vocabulary','grammar','situations','sentences']){
 const answers=activity==='vocabulary'?Array.from({length:10},(_,i)=>(3-i%3)%3):a[activity].map(q=>q.answer);
 const result=await call('/api/complete',{body:{activity,answers,writing:activity==='grammar'?['我喜歡咖啡，但是今天喝茶。','不管是老師還是學生，都可以參加。','我來台灣以後才開始學中文。']:[]},token});
 assert.equal(result.status,200);assert.equal(result.data.score,answers.length);
 const retry=await call('/api/complete',{body:{activity,answers,writing:activity==='grammar'?['句子一','句子二','句子三']:[]},token});assert.equal(retry.status,200);
}
const records=await call('/api/records',{token:env.TEACHER_KEY});assert.equal(records.data.rows.length,1);assert.equal(records.data.stats.students,1);assert.equal(records.data.stats.visits,1);assert.equal(records.data.stats.finished,1);assert.equal(records.data.rows[0].activities.length,5);
assert.equal((await call('/api/records?student=TEST02',{token:env.TEACHER_KEY})).data.rows.length,0);
assert.equal((await call('/api/records?student=TEST01',{token:env.TEACHER_KEY})).data.rows.length,1);
assert.equal((await call('/api/records?date=2000-01-01',{token:env.TEACHER_KEY})).data.rows.length,0);
console.log('PASS: private records, student isolation, input validation, five activities, server grading, retry deduplication, filters, persistence.');
