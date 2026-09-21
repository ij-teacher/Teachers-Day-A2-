'use strict';
const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let lesson, activities, session = null, currentTab = 'reading';
const completed = new Set(), drafts = {};
let sentenceOrder = [], requestId = crypto.randomUUID();
async function api(path, body, token) {
  if (!LESSON_CONFIG.apiBase) throw new Error('學習紀錄服務尚未設定，請通知老師。');
  const r = await fetch(LESSON_CONFIG.apiBase + path, {method:body?'POST':'GET',headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{'Authorization':'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
  let data; try {data=await r.json();} catch {throw new Error('紀錄服務暫時無法連線。請保留頁面，稍後再試。');}
  if (!r.ok) throw new Error(data.error || '暫時無法儲存，請稍後再試。');
  return data;
}
function speak(text) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text);u.lang='zh-TW';u.rate=.8;
  const voice=speechSynthesis.getVoices().find(v=>v.lang==='zh-TW'); if(voice)u.voice=voice;
  speechSynthesis.speak(u);
}
function quizHTML(name, rows) {
  return `<form class="quiz-form" data-activity="${name}">${rows.map((q,i)=>`<fieldset class="question"><legend>${i+1}. ${esc(q.q)}</legend><div class="choices">${(q.options||['有教無類','因材施教']).map((o,j)=>`<label class="choice"><input type="radio" name="q${i}" value="${j}" required><span>${esc(o)}</span></label>`).join('')}</div><div class="feedback" id="feedback-${i}"></div></fieldset>`).join('')}<div class="form-actions"><button class="primary" type="submit">檢查答案並記錄完成</button></div><div class="result" role="status"></div></form>`;
}
function vocabularyQuiz() {
  return lesson.vocabulary.map((v,i)=>({q:v[2],options:[v[0],lesson.vocabulary[(i+3)%10][0],lesson.vocabulary[(i+7)%10][0]],answer:0})).map((q,i)=>{const a=q.options;const offset=i%3;q.options=a.slice(offset).concat(a.slice(0,offset));q.answer=(3-offset)%3;return q;});
}
function preserveDraft() {const form=$('#panel form');if(form)drafts[currentTab]=Array.from(new FormData(form).entries());}
function restoreDraft() {const form=$('#panel form');if(!form)return;for(const [name,value] of drafts[currentTab]||[]){const fields=form.elements.namedItem(name);if(fields instanceof RadioNodeList)fields.value=value;else if(fields)fields.value=value;}}
function render(tab) {
  preserveDraft(); if('speechSynthesis' in window)speechSynthesis.cancel();currentTab=tab;
  document.querySelectorAll('[data-tab]').forEach(b=>{if(b.dataset.tab===tab)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
  const head=(name,sub)=>`<div class="section-title"><h2>${name}</h2><small>${sub}</small></div>`;
  let html='';
  if(tab==='reading')html=head('閱讀課文','先讀課文，再回答下面的問題。')+`<div class="reading-layout"><article class="card reading">${lesson.reading.map(p=>`<p>${esc(p)}</p>`).join('')}</article><aside class="note-card"><h3>9 月 28 日</h3><p>教師節<br>孔子的生日</p>${'speechSynthesis' in window?'<button id="read-aloud">聽課文</button><button id="stop-audio">停止朗讀</button><small>裝置語音朗讀，發音依裝置而異。</small>':''}</aside></div><section class="card activity"><h2>讀懂了嗎？</h2><p>以下題目依據這份課文作答。</p>${quizHTML(tab,activities.reading)}</section>`;
  if(tab==='vocabulary')html=head('生詞與例句','先看意思和例句，再完成生詞練習。')+`<div class="vocab-grid">${lesson.vocabulary.map((v,i)=>`<article class="word-card"><div class="word-head"><h3>${esc(v[0])}</h3>${'speechSynthesis'in window?`<button class="sound" data-speak="${i}">聽發音</button>`:''}</div><p class="pinyin">${esc(v[1])}</p><p>${esc(v[2])}</p><p class="example">${esc(v[3])}</p></article>`).join('')}</div><section class="card activity"><h2>看意思，選生詞</h2>${quizHTML(tab,vocabularyQuiz())}</section>`;
  if(tab==='grammar')html=head('三個句型','比較意思、讀例句，再自己寫句子。')+`<article class="card grammar-card"><h3>01 但是</h3><div class="pattern">……，但是……。</div><p>連接兩個意思不同或相反的情況。</p><p>例句：華文寫字很難，但是我想學。</p></article><article class="card grammar-card"><h3>02 不管……還是……都……</h3><div class="pattern">不管 A 還是 B，都……。</div><p>有兩種不同的情況，但是結果一樣。</p><p>例句：不管是晴天還是雨天，我都會去上課。</p></article><article class="card grammar-card"><h3>03 才</h3><div class="pattern">人＋時間＋才＋做什麼。</div><p>表示一件事發生得比較晚，或等了一段時間以後才發生。</p><p>例句：我昨天晚上十一點才回家。</p></article><section class="card activity"><h2>選詞與造句</h2><p>選出答案，再完成三個句子。造句會交給老師閱讀，不自動判斷對錯。</p>${quizHTML(tab,activities.grammar)}</section>`;
  if(tab==='situations')html=head('有教無類，還是因材施教？','讀一讀，選出符合情境的教育想法。')+`<div class="card"><p><strong>有教無類：</strong>所有人都可以學習。</p><p><strong>因材施教：</strong>根據不同的人，用不同的方法。</p>${quizHTML(tab,activities.situations)}</div>`;
  if(tab==='sentences')html=head('把句子排好','點選詞語放進句子；點選已放好的詞語可以移回去。')+`<form class="card" id="sentence-form">${activities.sentences.map((q,i)=>`<section class="question"><h3>第 ${i+1} 題</h3><div class="tile-area" data-answer="${i}" aria-label="第 ${i+1} 題已排好的句子"></div><div class="tile-bank" data-bank="${i}"></div><button class="text-button reset-sentence" type="button" data-index="${i}">重新排列</button><div id="sentence-feedback-${i}" class="result"></div></section>`).join('')}<div class="form-actions"><button type="submit" class="primary">檢查答案並記錄完成</button></div><div class="result" role="status"></div></form>`;
  $('#panel').innerHTML=html;
  if(tab==='grammar') {
    const div=document.createElement('div');div.innerHTML=['我喜歡喝咖啡，但是……。','不管是老師還是學生，都可以……。','我來台灣以後才……。'].map((s,i)=>`<label for="writing-${i}">${esc(s)}</label><textarea id="writing-${i}" name="writing${i}" rows="2" maxlength="500" required placeholder="請寫出完整句子"></textarea>`).join('');
    $('#panel .form-actions').before(div);
  }
  restoreDraft();
  $('#read-aloud')?.addEventListener('click',()=>speak(lesson.reading.join('。')));$('#stop-audio')?.addEventListener('click',()=>speechSynthesis.cancel());
  document.querySelectorAll('[data-speak]').forEach(b=>b.addEventListener('click',()=>speak(lesson.vocabulary[+b.dataset.speak][0])));
  $('.quiz-form')?.addEventListener('submit',submitQuiz);
  if(tab==='sentences') {if(!sentenceOrder.length)sentenceOrder=activities.sentences.map(()=>[]);drawSentences();$('#sentence-form').addEventListener('submit',submitSentences);}
  $('#save-status').textContent=completed.has(tab)?'這個活動已記錄完成。你可以再練習一次。':'';
  $('#panel').focus({preventScroll:true});
}
function drawSentences() {
  activities.sentences.forEach((q,i)=>{
    const selected=sentenceOrder[i];const chosen=document.querySelector(`[data-answer="${i}"]`),bank=document.querySelector(`[data-bank="${i}"]`);
    chosen.innerHTML=selected.length?selected.map(j=>`<button class="tile" type="button" data-part="${j}">${esc(q.parts[j])}</button>`).join(''):'<span class="tile-hint">把詞語放在這裡</span>';
    bank.innerHTML=q.parts.map((p,j)=>selected.includes(j)?'':`<button class="tile" type="button" data-part="${j}">${esc(p)}</button>`).join('');
    chosen.querySelectorAll('button').forEach(b=>b.onclick=()=>{sentenceOrder[i]=selected.filter(j=>j!==+b.dataset.part);drawSentences();});
    bank.querySelectorAll('button').forEach(b=>b.onclick=()=>{sentenceOrder[i].push(+b.dataset.part);drawSentences();});
  });document.querySelectorAll('.reset-sentence').forEach(b=>b.onclick=()=>{sentenceOrder[+b.dataset.index]=[];drawSentences();});
}
async function record(activity,answers,writing,resultBox,button) {
  document.querySelectorAll('[data-tab],#switch-student').forEach(b=>b.disabled=true);button.disabled=true;resultBox.textContent='正在檢查並儲存……';resultBox.className='result';
  try {
    const result=await api('/api/complete',{activity,answers,writing},session.token);
    completed.add(activity);$('#progress').value=completed.size;$('#progress-label').textContent=`完成 ${completed.size} / 5 個活動`;
    resultBox.className='result good';resultBox.textContent=`${result.score} / ${result.total} 題答對。已儲存完成紀錄。${activity==='grammar'?'造句已交給老師。':''}`;
    if(activity==='sentences')result.correct.forEach((yes,i)=>{const f=$(`#sentence-feedback-${i}`);if(f){f.className='result '+(yes?'good':'error');f.textContent=yes?'正確！':'參考答案：'+activities.sentences[i].display;}});
    else {
      const rows=activity==='vocabulary'?vocabularyQuiz():activities[activity];
      result.correct.forEach((yes,i)=>{const f=$(`#feedback-${i}`);if(f&&currentTab===activity){f.className='feedback '+(yes?'good':'error');f.textContent=yes?'正確！':'正確答案：'+(rows[i].options||['有教無類','因材施教'])[rows[i].answer];}});
    }
    $('#save-status').textContent='紀錄已送出。老師可以在教師紀錄中查看。';
    if(completed.size===5)$('#save-status').innerHTML='<div class="complete-banner"><strong>今天的五個活動都完成了！</strong><br>謝謝你的學習。記得對老師說一聲：「教師節快樂！」</div>';
  } catch(e) {resultBox.className='result error';resultBox.textContent=(e.name==='TimeoutError'?'連線逾時。':e.message)+' 答案仍保留，請再次按下按鈕重試。';}
  finally{button.disabled=false;document.querySelectorAll('[data-tab],#switch-student').forEach(b=>b.disabled=false);}
}
async function submitQuiz(e) {
  e.preventDefault();const form=e.currentTarget,name=form.dataset.activity,fd=new FormData(form),rows=name==='vocabulary'?vocabularyQuiz():activities[name];
  const answers=rows.map((_,i)=>Number(fd.get('q'+i)));const writing=name==='grammar'?[0,1,2].map(i=>String(fd.get('writing'+i)||'').trim()):[];
  if(writing.some(s=>s.length<2)){form.querySelector('.result').textContent='請完成三個句子。';return;}
  await record(name,answers,writing,form.querySelector('.result'),form.querySelector('[type=submit]'));
}
async function submitSentences(e) {
  e.preventDefault();const form=e.currentTarget;
  if(sentenceOrder.some((row,i)=>row.length!==activities.sentences[i].parts.length)){form.querySelector('.result').textContent='請先把每一題的所有詞語排好。';return;}
  const answers=sentenceOrder.map((row,i)=>row.map(j=>activities.sentences[i].parts[j]).join(''));
  await record('sentences',answers,[],form.querySelector('.result'),form.querySelector('[type=submit]'));
}
$('#entry-form').addEventListener('submit',async e=>{
  e.preventDefault();const b=e.currentTarget.querySelector('button'),status=$('#entry-status');b.disabled=true;status.textContent='正在記錄進入時間……';
  try {
    if(!lesson)throw new Error('教材仍在載入，請稍後再試。');
    const id=$('#student-id').value.trim();session=await api('/api/visit',{studentId:id,requestId});session.studentId=id;
    $('#student-label').textContent='學號 '+id;$('#entry').hidden=true;$('#classroom').hidden=false;render('reading');
  } catch(e){status.textContent=e.name==='TimeoutError'?'連線逾時，請再試一次。':e.message;status.className='error';}
  finally{b.disabled=false;}
});
document.querySelectorAll('[data-tab]').forEach(b=>b.addEventListener('click',()=>render(b.dataset.tab)));
$('#switch-student').addEventListener('click',()=>{
  if(!confirm('要結束這次學習並切換學號嗎？已送出的紀錄會保留。'))return;
  session=null;requestId=crypto.randomUUID();completed.clear();for(const k of Object.keys(drafts))delete drafts[k];sentenceOrder=[];
  $('#classroom').hidden=true;$('#entry').hidden=false;$('#panel').innerHTML='';$('#progress').value=0;$('#progress-label').textContent='完成 0 / 5 個活動';$('#entry-status').textContent='';$('#student-id').value='';$('#student-id').focus();if('speechSynthesis'in window)speechSynthesis.cancel();
});
Promise.all([fetch('lesson.json').then(r=>{if(!r.ok)throw Error();return r.json();}),fetch('activities.json').then(r=>{if(!r.ok)throw Error();return r.json();})]).then(([l,a])=>{lesson=l;activities=a;}).catch(()=>{$('#entry-status').textContent='教材載入失敗，請重新整理頁面。';});

if(document.modelContext?.registerTool){const lifecycle=new AbortController(); const list=[{name:'read_lesson_progress',description:'Read current completed activities without submitting answers.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:true},execute(){return {signedIn:!!session,completed:[...completed],total:5};}},{name:'open_lesson_section',description:'Navigate to a lesson section without marking completion.',inputSchema:{type:'object',properties:{section:{type:'string',enum:['reading','vocabulary','grammar','situations','sentences']}},required:['section'],additionalProperties:false},execute(input){if(!session)throw Error('Enter student ID first.');if(!['reading','vocabulary','grammar','situations','sentences'].includes(input?.section))throw Error('Invalid section.');if(document.querySelector('[data-tab]')?.disabled)throw Error('Wait for saving to finish.');render(input.section);return {section:currentTab};}}];for(const tool of list){try{Promise.resolve(document.modelContext.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{}}window.addEventListener('pagehide',()=>lifecycle.abort(),{once:true});}
