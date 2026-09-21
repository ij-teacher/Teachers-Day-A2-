const activities = null;
const encoder = new TextEncoder();
const allowedActivities = ['reading','vocabulary','grammar','situations','sentences'];
const json = (value,status=200,headers={}) => new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers}});
async function digest(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value))),b=>b.toString(16).padStart(2,'0')).join('');}
async function sign(secret,value){const k=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign']);return Array.from(new Uint8Array(await crypto.subtle.sign('HMAC',k,encoder.encode(value))),b=>b.toString(16).padStart(2,'0')).join('');}
async function equalSecret(expected,supplied){if(!expected||!supplied||supplied.length>300)return false;const k=await crypto.subtle.importKey('raw',encoder.encode(expected),{name:'HMAC',hash:'SHA-256'},false,['sign','verify']);const signature=await crypto.subtle.sign('HMAC',k,encoder.encode(expected));return crypto.subtle.verify('HMAC',k,signature,encoder.encode(supplied));}
async function bodyJSON(request){
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))throw new Error('JSON_REQUIRED');
  if(!request.body)throw new Error('BAD_INPUT');const reader=request.body.getReader();const chunks=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>16000){await reader.cancel();throw new Error('TOO_LARGE');}chunks.push(value);}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  let data;try{data=JSON.parse(new TextDecoder().decode(bytes));}catch{throw new Error('BAD_INPUT');}
  if(!data||Array.isArray(data)||typeof data!=='object')throw new Error('BAD_INPUT');return data;
}
function grade(activity,answers,writing){
  if(!allowedActivities.includes(activity)||!Array.isArray(answers))throw new Error('BAD_INPUT');
  const key=activity==='vocabulary'?Array.from({length:10},(_,i)=>(3-i%3)%3):activities[activity].map(q=>q.answer);
  if(answers.length!==key.length)throw new Error('BAD_INPUT');
  if(activity==='sentences'){if(answers.some(a=>typeof a!=='string'||a.length>300))throw new Error('BAD_INPUT');}
  else if(answers.some(a=>!Number.isInteger(a)||a<0||a>(activity==='situations'?1:2)))throw new Error('BAD_INPUT');
  if(activity==='grammar'&&(!Array.isArray(writing)||writing.length!==3||writing.some(s=>typeof s!=='string'||s.trim().length<2||s.length>500)))throw new Error('BAD_INPUT');
  const correct=answers.map((a,i)=>a===key[i]);return {correct,score:correct.filter(Boolean).length,total:key.length};
}
export default {
  async fetch(request,env){
    const url=new URL(request.url);const origin=request.headers.get('Origin');
    const allowedOrigin=env.ALLOWED_ORIGIN||'https://ij-teacher.github.io';
    const cors=origin===allowedOrigin?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Max-Age':'600','Vary':'Origin'}:{};
    if(origin&&origin!==allowedOrigin)return json({error:'來源網站不允許。'},403);
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors});
    const respond=(data,status=200)=>json(data,status,cors);
    if(url.pathname==='/')return respond({service:'教師節 A2 學習紀錄',status:'ready'});
    if(!env.DB||!env.SESSION_SECRET||!env.TEACHER_KEY)return respond({error:'紀錄服務設定尚未完成。'},503);
    try{
      if(url.pathname==='/api/visit'&&request.method==='POST'){
        const b=await bodyJSON(request);const studentId=typeof b.studentId==='string'?b.studentId.trim().toUpperCase():'';
        if(!/^[A-Z0-9_-]{2,32}$/.test(studentId)||typeof b.requestId!=='string'||!/^[a-f0-9-]{36}$/.test(b.requestId))return respond({error:'請輸入有效學號。'},400);
        const old=await env.DB.prepare('SELECT student_id FROM visits WHERE id=?').bind(b.requestId).first();
        if(old&&old.student_id!==studentId)return respond({error:'請重新整理頁面再輸入學號。'},409);
        if(!old){const cutoff=new Date(Date.now()-3600000).toISOString();const count=await env.DB.prepare('SELECT COUNT(*) AS n FROM visits WHERE student_id=? AND created_at>=?').bind(studentId,cutoff).first();if(count.n>=30)return respond({error:'這個學號進入次數太多，請稍後再試。'},429);}
        const token=b.requestId+'.'+await sign(env.SESSION_SECRET,b.requestId);
        await env.DB.prepare('INSERT OR IGNORE INTO visits (id,student_id,created_at,token_hash) VALUES (?,?,?,?)').bind(b.requestId,studentId,new Date().toISOString(),await digest(token)).run();
        return respond({token,studentId});
      }
      const supplied=request.headers.get('Authorization')?.replace(/^Bearer /,'')||'';
      if(url.pathname==='/api/complete'&&request.method==='POST'){
        const visitId=supplied.split('.')[0];
        const visit=await env.DB.prepare('SELECT id,created_at FROM visits WHERE id=? AND token_hash=?').bind(visitId,await digest(supplied)).first();
        if(!visit)return respond({error:'請重新輸入學號，開始學習。'},401);
        if(Date.now()-Date.parse(visit.created_at)>86400000)return respond({error:'本次學習已超過一天，請重新輸入學號。'},401);
        const b=await bodyJSON(request);const result=grade(b.activity,b.answers,b.writing);
        await env.DB.prepare('INSERT INTO completions (visit_id,activity,score,total,answers_json,writing_json,completed_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(visit_id,activity) DO UPDATE SET score=excluded.score,total=excluded.total,answers_json=excluded.answers_json,writing_json=excluded.writing_json,completed_at=excluded.completed_at').bind(visit.id,b.activity,result.score,result.total,JSON.stringify(b.answers),JSON.stringify(b.activity==='grammar'?b.writing:[]),new Date().toISOString()).run();
        return respond(result);
      }
      if(url.pathname==='/api/records'&&request.method==='GET'){
        if(!await equalSecret(env.TEACHER_KEY,supplied))return respond({error:'教師存取碼不正確。'},401);
        const student=(url.searchParams.get('student')||'').trim().toUpperCase();const date=url.searchParams.get('date')||'';const before=url.searchParams.get('before')||'';
        if(student&&!/^[A-Z0-9_-]{2,32}$/.test(student))return respond({error:'請輸入完整學號。'},400);
        if(date&&!/^\d{4}-\d{2}-\d{2}$/.test(date))return respond({error:'日期格式不正確。'},400);
        if(before&&before.length>100)return respond({error:'頁面參數不正確。'},400);
        const where=['1=1'],values=[];
        if(student){where.push('student_id=?');values.push(student);}
        if(date){const from=new Date(date+'T00:00:00+08:00');if(Number.isNaN(from.getTime()))return respond({error:'日期不正確。'},400);where.push('created_at>=? AND created_at<?');values.push(from.toISOString(),new Date(from.getTime()+86400000).toISOString());}
        const filter=where.join(' AND ');
        const stats=await env.DB.prepare('SELECT COUNT(*) AS visits,COUNT(DISTINCT student_id) AS students, COALESCE(SUM((SELECT COUNT(*) FROM completions c WHERE c.visit_id=visits.id)=5),0) AS finished FROM visits WHERE '+filter).bind(...values).first();
        const pageWhere=[...where],pageValues=[...values];if(before){pageWhere.push("created_at || '|' || id < ?");pageValues.push(before);}
        const page=await env.DB.prepare('SELECT id,student_id,created_at FROM visits WHERE '+pageWhere.join(' AND ')+' ORDER BY created_at DESC,id DESC LIMIT 101').bind(...pageValues).all();
        const more=page.results.length>100;const rows=page.results.slice(0,100);
        if(rows.length){const placeholders=rows.map(()=>'?').join(',');const all=await env.DB.prepare('SELECT visit_id,activity,score,total,writing_json,completed_at FROM completions WHERE visit_id IN ('+placeholders+')').bind(...rows.map(r=>r.id)).all();for(const row of rows)row.activities=all.results.filter(c=>c.visit_id===row.id).map(({visit_id,...c})=>({...c,writing:JSON.parse(c.writing_json),writing_json:undefined}));}
        const last=rows.at(-1);return respond({rows,stats,next:more?last.created_at+'|'+last.id:null});
      }
      return respond({error:'找不到這個功能。'},404);
    }catch(error){
      if(['BAD_INPUT','JSON_REQUIRED','TOO_LARGE'].includes(error.message))return respond({error:'答案格式不正確，請檢查後重試。'},400);
      console.error('student_record_service_error',{type:error.name});return respond({error:'紀錄暫時無法儲存，請稍後再試。'},503);
    }
  }
};
