import fs from 'node:fs';
fs.mkdirSync('dist/server',{recursive:true});fs.mkdirSync('dist/.openai',{recursive:true});
fs.writeFileSync('dist/server/index.js',fs.readFileSync('worker.mjs','utf8').replace('const activities = null;', 'const activities = '+fs.readFileSync('activities.json','utf8')+';'));
fs.copyFileSync('activities.json','dist/server/activities.json');
fs.copyFileSync('.openai/hosting.json','dist/.openai/hosting.json');
if(fs.existsSync('drizzle'))fs.cpSync('drizzle','dist/.openai/drizzle',{recursive:true});
fs.writeFileSync('dist/server/wrangler.json',JSON.stringify({name:'teachers-day-records',main:'index.js',compatibility_date:'2026-09-21',compatibility_flags:['nodejs_compat'],observability:{enabled:true}}));
console.log('Built student record service');
