const http = require('http');
const subs = {}; const calls = []; let lastCustomer = null;
http.createServer((req, res) => {
  let body=''; req.on('data',c=>body+=c); req.on('end',()=>{
    calls.push(req.method+' '+req.url); res.setHeader('content-type','application/json');
    const form = new URLSearchParams(body);
    if (req.url==='/__calls') return res.end(JSON.stringify(calls));
    if (req.url==='/__lastcustomer') return res.end(JSON.stringify({id:lastCustomer}));
    if (req.url==='/__setsub') { const s=JSON.parse(body); subs[s.id]=s; return res.end('{}'); }
    if (req.method==='POST' && req.url==='/v1/customers') { lastCustomer='cus_'+Date.now(); return res.end(JSON.stringify({id:lastCustomer,object:'customer'})); }
    if (req.method==='POST' && req.url==='/v1/checkout/sessions') return res.end(JSON.stringify({id:'cs_1',object:'checkout.session',url:'https://checkout.stripe.test/cs_1',price:form.get('line_items[0][price]'),ref:form.get('client_reference_id')}));
    if (req.method==='POST' && req.url==='/v1/billing_portal/sessions') return res.end(JSON.stringify({id:'bps_1',url:'https://billing.stripe.test/p'}));
    const m=req.url.match(/^\/v1\/subscriptions\/(\w+)/); if (m && subs[m[1]]) return res.end(JSON.stringify(subs[m[1]]));
    res.statusCode=404; res.end(JSON.stringify({error:{message:'not mocked '+req.url}}));
  });
}).listen(4012);
