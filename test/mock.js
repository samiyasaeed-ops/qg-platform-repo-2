(function(){
const store=new Map(); const subs=new Set(); let seq=0;
const segs=p=>p.split('/').filter(Boolean);
const snapDoc=(path)=>{ const v=store.get(path); const id=segs(path).pop(); return Object.freeze({id,exists:v!==undefined,data:()=>v===undefined?undefined:JSON.parse(JSON.stringify(v)),metadata:{}}); };
function checkPlain(d){ if(d&&typeof d==='object'&&!Array.isArray(d)&&Object.getPrototypeOf(d)!==Object.prototype) throw new Error('cross-realm object reached db'); }
function notify(){ for(const s of subs) setTimeout(s,0); }
function query(coll,filters=[],order=null,lim=null){
  const run=()=>{ const n=segs(coll).length; let docs=[...store.keys()].filter(k=>k.startsWith(coll+'/')&&segs(k).length===n+1).map(snapDoc);
    for(const [f,op,v] of filters) docs=docs.filter(d=>{const x=d.data()[f]; return op==='=='?x===v:op==='>='?x>=v:op==='<='?x<=v:op==='>'?x>v:op==='<'?x<v:true;});
    if(order) docs.sort((a,b)=>{const x=a.data()[order[0]],y=b.data()[order[0]]; return (x>y?1:x<y?-1:0)*(order[1]==='desc'?-1:1);});
    if(lim) docs=docs.slice(0,lim); return Object.freeze({docs,size:docs.length,empty:!docs.length,docChanges:()=>[],metadata:{}}); };
  return { where:(f,op,v)=>query(coll,[...filters,[f,op,v]],order,lim), orderBy:(f,d)=>query(coll,filters,[f,d||'asc'],lim), limit:n=>query(coll,filters,order,n),
    get:async()=>run(), onSnapshot:(cb,err)=>{ const s=()=>cb(run()); subs.add(s); setTimeout(s,0); return ()=>subs.delete(s); } };
}
function docRef(path){ if(segs(path).length%2) throw new TypeError('bad doc path '+path); return { id:segs(path).pop(), path,
  get:async()=>snapDoc(path), set:async d=>{checkPlain(d); store.set(path,JSON.parse(JSON.stringify(d))); notify();},
  update:async d=>{checkPlain(d); if(!store.has(path)) throw {code:'not_found'}; store.set(path,{...store.get(path),...JSON.parse(JSON.stringify(d))}); notify();},
  delete:async()=>{store.delete(path); notify();}, acquire:async()=>({acquired:true}),
  onSnapshot:(cb)=>{ const s=()=>cb(snapDoc(path)); subs.add(s); setTimeout(s,0); return ()=>subs.delete(s); },
  collection:p=>collRef(path+'/'+p) }; }
function collRef(path){ if(!(segs(path).length%2)) throw new TypeError('bad coll path '+path); return Object.assign(query(path),{ id:segs(path).pop(), path,
  doc:id=>docRef(path+'/'+(id||('auto'+(++seq)))), add:async d=>{checkPlain(d); const r=docRef(path+'/auto'+(++seq)); await r.set(d); return r;} }); }
const db=Object.freeze({doc:docRef,collection:collRef});
const user=Object.freeze({me:async()=>({id:'u_TEST',name:'SS Tester',email:'ss@example.com',isOwner:true,canEdit:true}),id:async()=>'u_TEST',isOwner:async()=>true,canEdit:async()=>true,can:()=>true,search:async q=>[{id:'u_LM',name:'Lina Manager'},{id:'u_TEST',name:'SS Tester'}],profiles:async ids=>Object.fromEntries(ids.map(i=>[i,{name:i==='u_TEST'?'SS Tester':''}]))});
window.__store=store; window.__sent=[]; window.__failMail=false;
window.__drive=[]; window.__dl=[]; const mcp=Object.freeze({callTool:async(s,t,a)=>{ if(s==='Google Drive'){ window.__drive.push(a); return {payload:{id:'f'+window.__drive.length,viewUrl:'https://drive.google.com/x'}}; } if(window.__failMail) throw {code:'tool_error',message:'simulated failure'}; window.__sent.push(a); return {payload:{id:'m'+window.__sent.length}}; }});
const downloads=Object.freeze({save:async o=>{ window.__dl.push({name:o.filename,size:o.data.size||o.data.length}); return {}; }});
const assets=Object.freeze({upload:async b=>({id:'a'.repeat(32),url:'/_blob/x',sizeBytes:b.size})});
const seed=window.__SEED||{}; for(const [k,v] of Object.entries(seed)) store.set(k,v);
Object.defineProperty(window,'claude',{value:Object.freeze({use:async n=>{ await new Promise(r=>setTimeout(r,30)); return n==='db'?db:n==='user'?user:n==='mcp'?mcp:n==='assets'?assets:n==='downloads'?downloads:null; }})});
})();
