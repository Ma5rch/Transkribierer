import express from 'express';import multer from 'multer';import fs from 'fs';import path from 'path';
import {Document,Packer,Paragraph,TextRun,HeadingLevel,ShadingType} from 'docx';import PDFDocument from 'pdfkit';
const LOCAL=process.env.TRANSCRIBER==='whisperx',WX=process.env.WHISPERX_URL||'http://127.0.0.1:8000',KEY=process.env.ASSEMBLYAI_API_KEY,A='https://api.assemblyai.com/v2',U=path.resolve('uploads');
fs.mkdirSync(U,{recursive:true});
const up=multer({dest:U,limits:{fileSize:+(process.env.MAX_MB||500)*1048576}});
const app=express();
app.use((q,r,n)=>{const p=process.env.APP_PASSWORD;if(!p)return n();
 const [,pw]=Buffer.from((q.headers.authorization||'').slice(6),'base64').toString().split(/:(.*)/s);
 if(pw===p)return n();r.set('WWW-Authenticate','Basic realm="Transkript"').sendStatus(401)});
app.use(express.json({limit:'20mb'}));app.use(express.static('public'));
const meta=id=>JSON.parse(fs.readFileSync(path.join(U,id+'.json')));
const save=(id,m)=>fs.writeFileSync(path.join(U,id+'.json'),JSON.stringify(m));
const ok=id=>/^[a-f0-9]{32}$/.test(id);
const aai=(p,o={})=>fetch(A+p,{...o,headers:{authorization:KEY,...(o.headers||{})}});

app.post('/api/jobs',up.single('audio'),(q,r)=>{
 if(!KEY&&!LOCAL)return r.status(500).json({error:'API-Schlüssel fehlt: Bitte ASSEMBLYAI_API_KEY in .env setzen.'});
 if(!q.file||!q.file.size)return r.status(400).json({error:'Die Datei ist leer oder wurde nicht hochgeladen.'});
 const id=q.file.filename,m={mime:q.file.mimetype,status:'uploading',lang:q.body.lang,spk:+q.body.speakers||0};
 fs.renameSync(q.file.path,path.join(U,id));save(id,m);r.json({id});start(id)});
const start=async id=>{const m=meta(id);m.status='uploading';delete m.error;save(id,m);try{
  if(LOCAL){const t=await fetch(WX+'/jobs',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({path:path.join(U,id),lang:m.lang,speakers:m.spk})});
   if(!t.ok)throw new Error('Lokaler Transkriptionsdienst nicht erreichbar. Läuft whisperx_service?');
   m.aai=(await t.json()).id;m.status='processing';save(id,m);return}
  const u=await aai('/upload',{method:'POST',body:fs.createReadStream(path.join(U,id)),duplex:'half'});
  if(!u.ok)throw new Error('Upload zum Transkriptionsdienst fehlgeschlagen ('+u.status+')');
  const b={audio_url:(await u.json()).upload_url,speaker_labels:true,punctuate:true,format_text:true};
  if(m.lang&&m.lang!=='auto')b.language_code=m.lang;else b.language_detection=true;
  if(m.spk>0)b.speakers_expected=m.spk;
  const t=await aai('/transcript',{method:'POST',body:JSON.stringify(b),headers:{'content-type':'application/json'}});
  const j=await t.json();if(!t.ok)throw new Error(j.error||'Dienst nicht erreichbar');
  m.aai=j.id;m.status='processing';save(id,m);
 }catch(e){m.status='error';m.error=String(e.message);save(id,m)}};
app.post('/api/jobs/:id/retry',(q,r)=>{if(!ok(q.params.id))return r.sendStatus(404);start(q.params.id);r.sendStatus(202)});

function build(t){const out=[];let c=null;
 for(const w of t.words||[]){const sp=w.speaker||'A';if(c&&c.speaker!==sp)c=null;
  if(!c){c={speaker:sp,start:w.start,words:[]};out.push(c)}
  c.words.push({t:w.text,c:w.confidence,s:w.start,e:w.end});c.end=w.end;
  if(/[.!?]$/.test(w.text))c=null}
 return out}

app.get('/api/jobs/:id',async(q,r)=>{try{
 if(!ok(q.params.id))return r.sendStatus(404);const m=meta(q.params.id);
 if(m.status==='error')return r.json({status:'error',error:m.error});
 if(!m.aai)return r.json({status:m.status});
 const j=LOCAL?await(await fetch(WX+'/jobs/'+m.aai)).json():await(await aai('/transcript/'+m.aai)).json();
 if(j.status==='error')return r.json({status:'error',error:j.error||'Transkription fehlgeschlagen.'});
 if(j.status!=='completed')return r.json({status:'processing'});
 r.json({status:'done',language:j.language_code,duration:j.audio_duration,sentences:build(j)});
}catch(e){r.status(502).json({status:'error',error:'Verbindung zum Dienst unterbrochen. Bitte erneut versuchen.'})}});

app.get('/audio/:id',(q,r)=>{if(!ok(q.params.id))return r.sendStatus(404);
 try{r.type(meta(q.params.id).mime||'audio/mpeg').sendFile(path.join(U,q.params.id))}catch{r.sendStatus(404)}});
app.delete('/api/jobs/:id',(q,r)=>{if(!ok(q.params.id))return r.sendStatus(404);
 for(const f of [q.params.id,q.params.id+'.json'])fs.rmSync(path.join(U,f),{force:true});r.sendStatus(204)});

const OL=process.env.OLLAMA_URL||'http://127.0.0.1:11434';
const MODES={kurz:'Schreibe eine kurze Zusammenfassung (3-5 Sätze).',ausfuehrlich:'Schreibe eine ausführliche Zusammenfassung.',stichpunkte:'Fasse in Stichpunkten zusammen.',themen:'Fasse nach Themen gegliedert zusammen.',ergebnisse:'Nenne die wichtigsten Aussagen und Ergebnisse.',aufgaben:'Liste Aufgaben und vereinbarte nächste Schritte auf (mit Verantwortlichen, falls genannt).',fragen:'Liste Fragen und offene Punkte auf.',sprecher:'Fasse getrennt nach Sprechern in Stichpunkten zusammen.'};
app.get('/api/info',(q,r)=>r.json({engine:LOCAL?'local':'assemblyai'}));
app.post('/api/summary',async(q,r)=>{try{
 const prompt=`${MODES[q.body.mode]||MODES.kurz} Verwende AUSSCHLIESSLICH Informationen aus dem Transkript und erfinde nichts. Mit [?] markierte Wörter sind unsicher erkannt: weise darauf hin, wenn eine solche Stelle für das Verständnis wichtig ist. Antworte auf Deutsch.\n\nTranskript:\n${q.body.text}`;
 const o=await fetch(OL+'/api/generate',{method:'POST',body:JSON.stringify({model:process.env.OLLAMA_MODEL||'llama3.1',prompt,stream:false,options:{num_ctx:16384}})});
 if(!o.ok)throw 0;r.json({summary:(await o.json()).response.trim()});
}catch{r.status(502).json({error:'Zusammenfassung nicht möglich: Der kostenlose lokale KI-Dienst (Ollama) läuft nicht. Installation: ollama.com, danach „ollama pull llama3.1“.'})}});
const DAYS=+process.env.RETENTION_DAYS||30;
setInterval(()=>{for(const f of fs.readdirSync(U))if(Date.now()-fs.statSync(path.join(U,f)).mtimeMs>DAYS*864e5)fs.rmSync(path.join(U,f),{force:true})},36e5);
const ts=ms=>{const s=Math.floor(ms/1000);return[s/3600|0,s/60%60|0,s%60].map(x=>String(x).padStart(2,'0')).join(':')};
const range=s=>`(${ts(s.start)}–${ts(s.end??s.start)}) `;
function turns(ss){const o=[];for(const s of ss){const l=o[o.length-1];if(l&&l.speaker===s.speaker)l.items.push(s);else o.push({speaker:s.speaker,items:[s]})}return o}
app.post('/api/export/:fmt',async(q,r)=>{try{
 const {title='Transkription',meta:mt='',sentences=[],showTs=true}=q.body,day=new Date().toISOString().slice(0,10);
 const name=encodeURIComponent((q.body.filename||'Transkription_'+day)+'.'+q.params.fmt);
 if(q.params.fmt==='docx'){
  const kids=[new Paragraph({text:title,heading:HeadingLevel.TITLE}),new Paragraph({text:mt})];
  for(const t of turns(sentences)){const ch=[new TextRun({text:t.speaker+': ',bold:true})];
   for(const s of t.items){for(const x of s.runs)ch.push(new TextRun({text:x.t+' ',
     highlight:x.lv===1?'yellow':undefined,shading:x.lv===2?{type:ShadingType.CLEAR,fill:'FFB84D',color:'auto'}:undefined}));
    if(showTs)ch.push(new TextRun({text:range(s),color:'888888',size:18}))}
   kids.push(new Paragraph({children:ch,spacing:{after:160}}))}
   if(q.body.summary){kids.push(new Paragraph({text:'Zusammenfassung',heading:HeadingLevel.HEADING_1}));for(const l of q.body.summary.split('\n'))kids.push(new Paragraph({text:l}))}
  const buf=await Packer.toBuffer(new Document({sections:[{children:kids}]}));
  r.set({'Content-Type':'application/vnd.openxmlformats-officedocument.wordprocessingml.document','Content-Disposition':`attachment; filename*=UTF-8''${name}`}).send(buf);
 }else{
  const d=new PDFDocument({margin:56,bufferPages:true});
  r.set({'Content-Type':'application/pdf','Content-Disposition':`attachment; filename*=UTF-8''${name}`});d.pipe(r);
  d.font('Helvetica-Bold').fontSize(20).text(title).moveDown(.3).font('Helvetica').fontSize(10).fillColor('#666').text(mt).moveDown();
  for(const t of turns(sentences)){d.font('Helvetica-Bold').fontSize(11).fillColor('#000').text(t.speaker+': ',{continued:true});
   for(const s of t.items){for(const x of s.runs)d.font('Helvetica').fillColor(x.lv===2?'#d35400':x.lv===1?'#b8860b':'#000').text(x.t+' ',{continued:true,underline:x.lv>0});
    if(showTs)d.fontSize(8).fillColor('#888').text(range(s),{continued:true,underline:false}).fontSize(11)}
   d.text('').moveDown(.6)}
  if(q.body.summary){d.addPage().font('Helvetica-Bold').fontSize(16).fillColor('#000').text('Zusammenfassung').moveDown().font('Helvetica').fontSize(11).text(q.body.summary)}
  d.end()}
}catch(e){r.status(500).json({error:'Dokument konnte nicht erstellt werden. Das Transkript bleibt erhalten.'})}});
app.listen(process.env.PORT||3000,()=>console.log('läuft auf Port '+(process.env.PORT||3000)));
