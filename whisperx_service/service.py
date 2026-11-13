import os, uuid, threading, traceback
import whisperx
from fastapi import FastAPI
from pydantic import BaseModel
MODEL=os.getenv("WHISPER_MODEL","large-v3"); HF=os.getenv("HF_TOKEN")
DEV=os.getenv("DEVICE","cpu"); CT="float16" if DEV=="cuda" else "int8"
app=FastAPI(); jobs={}; lock=threading.Lock()
class Req(BaseModel):
    path:str; lang:str|None=None; speakers:int=0
def run(jid,r):
    try:
        with lock:  # ein Job gleichzeitig (schont RAM)
            lang=None if r.lang in (None,"","auto") else r.lang
            audio=whisperx.load_audio(r.path)
            res=whisperx.load_model(MODEL,DEV,compute_type=CT,language=lang).transcribe(audio,batch_size=8)
            lang=res["language"]
            am,md=whisperx.load_align_model(language_code=lang,device=DEV)
            res=whisperx.align(res["segments"],am,md,audio,DEV)
            if HF:
                dia=whisperx.DiarizationPipeline(use_auth_token=HF,device=DEV)
                kw={"min_speakers":r.speakers,"max_speakers":r.speakers} if r.speakers>0 else {}
                res=whisperx.assign_word_speakers(dia(audio,**kw),res)
        words=[];last="SPEAKER_00"
        for sg in res["segments"]:
            for w in sg.get("words",[]):
                last=w.get("speaker",sg.get("speaker",last))
                if "start" not in w: continue  # ohne Zeitstempel: nicht erfunden, weggelassen
                words.append({"text":w["word"],"start":int(w["start"]*1000),"end":int(w["end"]*1000),
                              "confidence":w.get("score"),"speaker":last})
        jobs[jid]={"status":"completed","words":words,"language_code":lang,"audio_duration":len(audio)/16000}
    except Exception as e:
        traceback.print_exc(); jobs[jid]={"status":"error","error":"Transkription fehlgeschlagen: "+str(e)}
@app.post("/jobs")
def create(r:Req):
    jid=uuid.uuid4().hex; jobs[jid]={"status":"processing"}
    threading.Thread(target=run,args=(jid,r),daemon=True).start(); return {"id":jid}
@app.get("/jobs/{jid}")
def get(jid:str): return jobs.get(jid,{"status":"error","error":"Unbekannter Job (Dienst neu gestartet?)"})
