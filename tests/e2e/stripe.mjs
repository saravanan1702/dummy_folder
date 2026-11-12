import Stripe from "stripe";
import { execSync } from "node:child_process";
const B="http://localhost:3000"; const stripe=new Stripe("sk_test_dummy");
let cookie=""; let ok=true;
const check=(n,c,x="")=>{ok=ok&&!!c;console.log((c?"PASS ":"FAIL ")+n, c?"":JSON.stringify(x))};
async function call(m,p,body){const r=await fetch(B+p,{method:m,headers:{origin:B,cookie,"content-type":"application/json"},body:body?JSON.stringify(body):undefined});const sc=r.headers.get("set-cookie");if(sc)cookie=sc.split(/,(?=\s*cv_)/).map(s=>s.split(";")[0]).join("; ");return [r.status, await r.json().catch(()=>null)];}
const email=`bill${Date.now()}@example.com`;
await call("POST","/api/auth/signup",{name:"Bill Payer",email,password:"supersecret1",workspaceName:"Bill Co"});
let [c,r]=await call("POST","/api/billing/checkout",{plan:"PRO"});
check("checkout returns stripe url", c===200 && r.url.startsWith("https://checkout.stripe.test"), r);
const [,me]=await call("GET","/api/me"); const ws=me.workspace.id;
const cus=(await (await fetch("http://localhost:4012/__lastcustomer")).json()).id;
const sub={id:"sub_1",object:"subscription",customer:cus,status:"active",metadata:{workspaceId:ws},items:{object:"list",data:[{id:"si_1",price:{id:"price_pro"},current_period_end:Math.floor(Date.now()/1000)+30*86400}]}};
await fetch("http://localhost:4012/__setsub",{method:"POST",body:JSON.stringify(sub)});
async function hook(event, secret="whsec_testsecret"){const payload=JSON.stringify(event);const header=stripe.webhooks.generateTestHeaderString({payload,secret});const res=await fetch(B+"/api/webhooks/stripe",{method:"POST",headers:{"stripe-signature":header,"content-type":"application/json"},body:payload});return res.status;}
check("webhook rejects forged signature", (await hook({id:"evt_0",type:"customer.subscription.updated",data:{object:sub}},"whsec_wrong"))===400);
check("checkout.session.completed accepted", (await hook({id:"evt_1",object:"event",type:"checkout.session.completed",data:{object:{id:"cs_1",object:"checkout.session",mode:"subscription",subscription:"sub_1",customer:cus}}}))===200);
[,r]=await call("GET","/api/me");
check("workspace upgraded to PRO", r.workspace.plan==="PRO" && r.limits.seats===5 && r.workspace.currentPeriodEnd, r.workspace);
[c,r]=await call("POST","/api/billing/portal");
check("billing portal link", c===200 && r.url.includes("billing.stripe.test"), r);
await fetch("http://localhost:4012/__setsub",{method:"POST",body:JSON.stringify({...sub,items:{object:"list",data:[{...sub.items.data[0],price:{id:"price_biz"}}]}})});
await hook({id:"evt_2",object:"event",type:"customer.subscription.updated",data:{object:{id:"sub_1"}}});
[,r]=await call("GET","/api/me"); check("plan change to BUSINESS", r.workspace.plan==="BUSINESS", r.workspace);
await fetch("http://localhost:4012/__setsub",{method:"POST",body:JSON.stringify({...sub,status:"canceled"})});
await hook({id:"evt_3",object:"event",type:"customer.subscription.deleted",data:{object:{id:"sub_1"}}});
[,r]=await call("GET","/api/me"); check("cancellation downgrades to FREE", r.workspace.plan==="FREE", r.workspace);
// non-owner cannot buy
console.log(ok?"ALL OK":"SOME FAILED"); process.exit(ok?0:1);
