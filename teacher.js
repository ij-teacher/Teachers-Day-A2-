'use strict';
const $=s=>document.querySelector(s),labels={reading:'閱讀',vocabulary:'生詞',grammar:'句型',situations:'情境',sentences:'重組'};
let teacherKey='',next=null,rows=[],filter={student:'',date:''},loadSequence=0;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const time=s=>new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',dateStyle:'short',timeStyle:'medium'}).format(new Date(s));
async function fetchPage(before){const params=new URLSearchParams(filter);if(before)params.set('before',before);const r=await fetch(LESSON_CONFIG.apiBase+'/api/records?'+params,{headers:{Authorization:'Bearer '+teacherKey},signal:AbortSignal.timeout(15000)});let d;try{d=await r.json();}catch{throw Error('紀錄服務暫時無法連線。');}if(!r.ok)throw Error(d.error||'無法載入紀錄。');return d;}
function draw(){
  $('#records').innerHTML=rows.map(r=>{const a=Object.fromEntries(r.activities.map(x=>[x.activity,x]));return `<tr><td>${esc(r.student_id)}</td><td>${esc(time(r.created_at))}</td><td>${r.activities.length}/5</td>${Object.keys(labels).map(k=>`<td>${a[k]?a[k].score:'—'}</td>`).join('')}<td><details><summary>查看詳情</summary>${r.activities.map(x=>`<p>${labels[x.activity]}：${esc(time(x.completed_at))}</p>`).join('')}${(a.grammar?.writing||[]).map((s,i)=>`<p style="white-space:normal;min-width:220px">${i+1}. ${esc(s)}</p>`).join('')}</details></td></tr>`;}).join('');
  $('#empty').hidden=rows.length>0;$('#load-more').hidden=!next;
}
async function load(more=false){
  const seq=++loadSequence;$('#records-status').textContent='正在載入……';$('#refresh').disabled=true;$('#load-more').disabled=true;
  try{if(!more)filter={student:$('#filter-student').value.trim(),date:$('#filter-date').value};const d=await fetchPage(more?next:null);if(seq!==loadSequence)return;rows=more?rows.concat(d.rows):d.rows;next=d.next;draw();for(const k of ['students','visits','finished'])$('#stat-'+k).textContent=d.stats[k];$('#records-status').textContent=`已顯示 ${rows.length} 筆進入紀錄。`;}catch(e){$('#records-status').textContent=e.name==='TimeoutError'?'連線逾時，請重試。':e.message;}finally{if(seq===loadSequence){$('#refresh').disabled=false;$('#load-more').disabled=false;}}
}
$('#teacher-login').addEventListener('submit',async e=>{e.preventDefault();const b=e.currentTarget.querySelector('button');b.disabled=true;teacherKey=$('#teacher-key').value.trim();$('#login-status').textContent='正在驗證……';try{await fetchPage();$('#teacher-login').hidden=true;$('#dashboard').hidden=false;$('#teacher-key').value='';await load();}catch(e){teacherKey='';$('#login-status').textContent=e.message;}finally{b.disabled=false;}});
$('#refresh').onclick=()=>load();$('#load-more').onclick=()=>load(true);
$('#logout').onclick=()=>{loadSequence++;teacherKey='';rows=[];next=null;$('#records').innerHTML='';$('#dashboard').hidden=true;$('#teacher-login').hidden=false;$('#login-status').textContent='已登出。';};
const csvCell=v=>'"'+String(v??'').replace(/^\s*[=+@-]/,"'$&").replace(/"/g,'""')+'"';
$('#export').onclick=async()=>{
  const b=$('#export');b.disabled=true;$('#records-status').textContent='正在準備全部符合條件的紀錄……';
  try{let all=[],cursor=null;do{const d=await fetchPage(cursor);all.push(...d.rows);cursor=d.next;}while(cursor);
    const lines=[['學號','進入時間(臺灣)','完成活動數',...Object.values(labels).map(s=>s+'分數'),...Object.values(labels).map(s=>s+'完成時間'),'造句1','造句2','造句3']];
    for(const r of all){const a=Object.fromEntries(r.activities.map(x=>[x.activity,x]));lines.push([r.student_id,time(r.created_at),r.activities.length,...Object.keys(labels).map(k=>a[k]?a[k].score+'/'+a[k].total:''),...Object.keys(labels).map(k=>a[k]?time(a[k].completed_at):''),...(a.grammar?.writing||['','',''])]);}
    const blob=new Blob(['\ufeff'+lines.map(row=>row.map(csvCell).join(',')).join('\r\n')],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='teachers-day-records.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);$('#records-status').textContent=`已匯出 ${all.length} 筆紀錄。`;
  }catch(e){$('#records-status').textContent=e.message;}finally{b.disabled=false;}
};
