import assert from 'node:assert/strict';
const base=process.env.ROADFIT_TEST_URL||'http://127.0.0.1:5180';
const prefs={mode:'demo',lat:12.975,lng:77.637,radius:500,budget:8,seats:5,fuel:'petrol',name:'RoadFit QA'};
const post=(path,data,cookie='')=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',cookie},body:JSON.stringify(data)});
const demo=await post('/api/analyse',prefs);assert.equal(demo.status,200);const analysis=await demo.json();assert.equal(analysis.profile.source,'demo');assert(analysis.matches.length);assert(analysis.matches.every(c=>c.price_lakh<=8&&c.seats>=5&&c.fuel==='petrol'));
for(const patch of [{lat:100},{budget:-1},{radius:40000},{fuel:'invalid'},{mode:'bad'}])assert.equal((await post('/api/analyse',{...prefs,...patch})).status,400);
assert.equal((await fetch(base+'/api/saved')).status,401);assert.equal((await post('/api/saved',{name:'QA',payload:analysis})).status,401);
const login=await fetch(base+'/signin-with-chatgpt?return_to=/',{redirect:'manual'});const cookie=login.headers.getSetCookie().map(x=>x.split(';')[0]).join('; ');assert(cookie,'Mock sign-in should issue cookie');
const saved=await post('/api/saved',{name:'RoadFit automated QA',payload:analysis},cookie);assert.equal(saved.status,201);const {id}=await saved.json();
const list=await fetch(base+'/api/saved',{headers:{cookie}});assert.equal(list.status,200);assert((await list.json()).items.some(x=>x.id===id));
const deletion=await fetch(base+'/api/saved?id='+id,{method:'DELETE',headers:{cookie}});assert.equal(deletion.status,200);
const listAfter=await fetch(base+'/api/saved',{headers:{cookie}});assert(!(await listAfter.json()).items.some(x=>x.id===id));
console.log('PASS: real demo API, request validation, anonymous access rejected, authenticated D1 save/list/delete.');
const live=await post('/api/analyse',{...prefs,mode:'live'});const payload=await live.json();console.log('Live OSM status:',live.status,live.ok?`${payload.profile.total} roads; ${payload.profile.estimated} estimated widths`:payload.error);if(live.ok){assert.equal(payload.profile.source,'live');assert(payload.profile.total>0);}
