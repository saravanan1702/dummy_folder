import json, hmac, hashlib, time, urllib.request, http.cookiejar, sys
B="http://localhost:3000"
cj=http.cookiejar.CookieJar(); op=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
def call(method, path, body=None, headers=None, raw=None, auth=True):
    h={"origin":B, **(headers or {})}
    data=None
    if raw is not None: data=raw
    elif body is not None: data=json.dumps(body).encode(); h["content-type"]="application/json"
    req=urllib.request.Request(B+path, data=data, method=method, headers=h)
    try:
        r=(op if auth else urllib.request.build_opener()).open(req); txt=r.read().decode(); code=r.status
    except urllib.error.HTTPError as e: txt=e.read().decode(); code=e.code
    try: return code, json.loads(txt)
    except: return code, txt
def mock_calls(): return json.loads(urllib.request.urlopen("http://localhost:4010/__calls").read())
ok=True
def check(name, cond, extra=""):
    global ok; ok = ok and bool(cond); print(("PASS " if cond else "FAIL ")+name, extra if not cond else "")
email=f"ch{int(time.time())}@example.com"
print(call("POST","/api/auth/signup",{"name":"Chan Tester","email":email,"password":"supersecret1","workspaceName":"Chan Co"})[0])
# upgrade to BUSINESS directly so channel limits don't block (simulates paid plan)
import subprocess
import os
subprocess.run(["psql",os.environ.get("DATABASE_URL","postgresql://convoly:convoly@localhost:5432/convoly").split("?")[0],"-qc",f"""UPDATE "Workspace" SET plan='BUSINESS' WHERE id=(SELECT "workspaceId" FROM "Membership" m JOIN "User" u ON u.id=m."userId" WHERE u.email='{email}')"""],check=True)

# ── Telegram ──
c,r=call("POST","/api/channels",{"type":"TELEGRAM","token":"bad-token-123456"})
check("telegram rejects bad token", c==400 and "Unauthorized" in r.get("error",""), r)
c,r=call("POST","/api/channels",{"type":"TELEGRAM","token":"123456:GOODTOKEN"})
check("telegram connects", c==200 and r["channel"]["name"]=="Acme Bot", r)
tg=r["channel"]["id"]
hook=[x for x in mock_calls() if x["url"].endswith("/setWebhook")][-1]["body"]
check("telegram webhook registered", hook["url"].endswith(f"/api/webhooks/telegram/{tg}") and hook["secret_token"], hook)
secret=hook["secret_token"]
c,_=call("POST",f"/api/webhooks/telegram/{tg}",{"update_id":1},headers={"x-telegram-bot-api-secret-token":"wrong"},auth=False)
check("telegram webhook rejects wrong secret", c==403)
upd={"update_id":2,"message":{"message_id":10,"from":{"id":555,"first_name":"Tina","username":"tina"},"chat":{"id":555,"type":"private"},"text":"/start"}}
c,_=call("POST",f"/api/webhooks/telegram/{tg}",upd,headers={"x-telegram-bot-api-secret-token":secret},auth=False)
time.sleep(2)
sends=[x for x in mock_calls() if x["url"].endswith("/sendMessage")]
check("telegram welcome flow replied", sends and sends[-1]["body"]["chat_id"]=="555" and "Tina" in sends[-1]["body"]["text"], sends[-1:] )
kb=sends[-1]["body"].get("reply_markup",{}).get("inline_keyboard",[])
check("telegram buttons rendered", len(kb)==2, kb)
cb=kb[1][0]["callback_data"]
upd2={"update_id":3,"callback_query":{"id":"cq1","from":{"id":555,"first_name":"Tina"},"data":cb,"message":{"message_id":11,"chat":{"id":555,"type":"private"},"reply_markup":{"inline_keyboard":kb}}}}
call("POST",f"/api/webhooks/telegram/{tg}",upd2,headers={"x-telegram-bot-api-secret-token":secret},auth=False); time.sleep(2)
calls=mock_calls()
check("telegram button click answered", any(x["url"].endswith("/answerCallbackQuery") for x in calls))
check("telegram button continued flow", "team" in [x for x in calls if x["url"].endswith("/sendMessage")][-1]["body"]["text"])
# duplicate update must not double-reply
n=len([x for x in mock_calls() if x["url"].endswith("/sendMessage")])
call("POST",f"/api/webhooks/telegram/{tg}",upd2,headers={"x-telegram-bot-api-secret-token":secret},auth=False); time.sleep(1.5)
check("telegram duplicate ignored", len([x for x in mock_calls() if x["url"].endswith("/sendMessage")])==n)
# agent reply from inbox goes out via Telegram
c,r=call("GET","/api/conversations?status=ALL")
conv=[x for x in r["conversations"] if x["channel"]["type"]=="TELEGRAM"][0]
c,r=call("POST",f"/api/conversations/{conv['id']}/messages",{"text":"Hi Tina, Sam here"})
last=[x for x in mock_calls() if x["url"].endswith("/sendMessage")][-1]["body"]
check("agent reply delivered on telegram", c==200 and r["message"]["status"]=="SENT" and last["text"]=="Hi Tina, Sam here", r)

# ── WhatsApp ──
c,r=call("POST","/api/channels",{"type":"WHATSAPP","phoneNumberId":"1029384756","token":"wa-token-123456","appSecret":"wa-app-secret-1"})
check("whatsapp connects", c==200 and r["channel"]["webhook"], r)
wa=r["channel"]; vt=wa["webhook"]["verifyToken"]
c,body=call("GET",f"/api/webhooks/meta/{wa['id']}?hub.mode=subscribe&hub.verify_token={vt}&hub.challenge=42",auth=False)
check("meta verify handshake", c==200 and str(body)=="42", (c,body))
c,_=call("GET",f"/api/webhooks/meta/{wa['id']}?hub.mode=subscribe&hub.verify_token=nope&hub.challenge=42",auth=False)
check("meta verify rejects bad token", c==403)
payload=json.dumps({"object":"whatsapp_business_account","entry":[{"changes":[{"value":{"metadata":{"phone_number_id":"1029384756"},"contacts":[{"wa_id":"15550001","profile":{"name":"Omar Diaz"}}],"messages":[{"id":"wamid.in1","from":"15550001","type":"text","text":{"body":"hello"}}]}}]}]}).encode()
sig="sha256="+hmac.new(b"wa-app-secret-1",payload,hashlib.sha256).hexdigest()
c,_=call("POST",f"/api/webhooks/meta/{wa['id']}",raw=payload,headers={"content-type":"application/json","x-hub-signature-256":"sha256=bad"},auth=False)
check("whatsapp rejects bad signature", c==403)
c,_=call("POST",f"/api/webhooks/meta/{wa['id']}",raw=payload,headers={"content-type":"application/json","x-hub-signature-256":sig},auth=False); time.sleep(2)
was=[x for x in mock_calls() if "/1029384756/messages" in x["url"]]
check("whatsapp welcome replied with buttons", was and was[-1]["body"]["to"]=="15550001" and was[-1]["body"]["type"]=="interactive" and was[-1]["auth"]=="Bearer wa-token-123456", was[-1:])
btn=was[-1]["body"]["interactive"]["action"]["buttons"][0]["reply"]
payload2=json.dumps({"entry":[{"changes":[{"value":{"metadata":{"phone_number_id":"1029384756"},"messages":[{"id":"wamid.in2","from":"15550001","type":"interactive","interactive":{"type":"button_reply","button_reply":btn}}]}}]}]}).encode()
call("POST",f"/api/webhooks/meta/{wa['id']}",raw=payload2,headers={"content-type":"application/json","x-hub-signature-256":"sha256="+hmac.new(b"wa-app-secret-1",payload2,hashlib.sha256).hexdigest()},auth=False); time.sleep(2)
was=[x for x in mock_calls() if "/1029384756/messages" in x["url"]]
check("whatsapp button continued flow", "Just type" in json.dumps(was[-1]["body"]), was[-1]["body"])

# ── Messenger ──
c,r=call("POST","/api/channels",{"type":"MESSENGER","token":"page-token-123","appSecret":"fb-app-secret-1"})
check("messenger connects", c==200 and r["channel"]["name"]=="Acme Page", r); fb=r["channel"]
p=json.dumps({"object":"page","entry":[{"messaging":[{"sender":{"id":"PSID1"},"message":{"mid":"m.1","text":"hi there"}}]}]}).encode()
call("POST",f"/api/webhooks/meta/{fb['id']}",raw=p,headers={"content-type":"application/json","x-hub-signature-256":"sha256="+hmac.new(b"fb-app-secret-1",p,hashlib.sha256).hexdigest()},auth=False); time.sleep(2)
ms=[x for x in mock_calls() if x["url"].startswith("/v24.0/me/messages")]
check("messenger welcome replied (button template)", ms and ms[-1]["body"]["recipient"]["id"]=="PSID1" and ms[-1]["body"]["message"]["attachment"]["payload"]["template_type"]=="button", ms[-1:])
check("messenger personalised from profile", "Pat" in json.dumps(ms[-1]["body"]))

# ── Instagram ──
c,r=call("POST","/api/channels",{"type":"INSTAGRAM","token":"ig-page-token-123","appSecret":"ig-app-secret-1"})
check("instagram connects", c==200 and r["channel"]["name"]=="@acme.ig", r); ig=r["channel"]
p=json.dumps({"object":"instagram","entry":[{"messaging":[{"sender":{"id":"IGSID1"},"message":{"mid":"ig.1","text":"yo"}}]}]}).encode()
call("POST",f"/api/webhooks/meta/{ig['id']}",raw=p,headers={"content-type":"application/json","x-hub-signature-256":"sha256="+hmac.new(b"ig-app-secret-1",p,hashlib.sha256).hexdigest()},auth=False); time.sleep(2)
ms=[x for x in mock_calls() if x["url"].startswith("/v24.0/me/messages")]
check("instagram welcome replied", ms[-1]["body"]["recipient"]["id"]=="IGSID1", ms[-1:])

# disconnecting
c,_=call("DELETE",f"/api/channels/{tg}")
check("telegram removed + webhook deleted", c==200 and mock_calls()[-1]["url"].endswith("/deleteWebhook"))
print("ALL OK" if ok else "SOME FAILED"); sys.exit(0 if ok else 1)
