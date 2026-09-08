# Uses the running local Central and NiaSave APIs; never touches deployed hosts.
import json,urllib.request,uuid
from datetime import datetime,timezone,timedelta
NIA='http://127.0.0.1:8787'; CENTRAL='http://127.0.0.1:8080'; cookie=''
def call(base,path,body=None,key=None):
 global cookie
 headers={'content-type':'application/json','origin':base}
 if base==NIA and cookie: headers['cookie']=cookie
 if key: headers['idempotency-key']=key
 req=urllib.request.Request(base+path,data=None if body is None else json.dumps(body).encode(),headers=headers)
 with urllib.request.urlopen(req,timeout=20) as response:
  if response.headers.get('set-cookie'):cookie=response.headers.get('set-cookie').split(';')[0]
  return json.load(response)
def central(line,body=None):return call(CENTRAL,'/api/member-commerce?line='+line,body)
def nia(path,body=None,key=None):return call(NIA,'/api/commerce'+path,body,key)
assert call(NIA,'/health').get('demo') is True
assert central('earn')['operations']['preview'] is True
central('earn',{'action':'demo','body':{}})
nia('/auth/preview',{'role':'member'})
feed=nia('/earn');assert feed['preview'] and feed['map']['status']=='ready'
job=feed['jobs'][0]
a=nia('/earn/applications',{'jobId':job['id'],'revision':job['revision'],'consent':True},'DEMO-application-0001')
if a['status']=='interested':central('earn',{'action':'action','body':{'applicationId':a['id'],'expectedStatus':'interested','action':'contacted','message':'DEMO · Your Walk2Work coordinator has received your interest. Meet the Nia team at HSR Nest tomorrow at 10 am. This is a presentation example.'}})
orders=nia('/orders')['orders']
if not orders:
 products=nia('/catalogue')['products'];lines=[{'id':p['id'],'qty':1} for p in products if p.get('available',0)>0][:2]
 intent={'locationId':'S01','fulfillment':'pickup','lines':lines};q=nia('/quote',intent)
 order=nia('/orders',{**intent,'fingerprint':q['fingerprint']},'DEMO-essentials-0001')
else:order=orders[0]
if order['status']=='reserved':central('save',{'action':'action','body':{'orderId':order['id'],'action':'packed'}})
bookings=nia('/nests/bookings')['bookings']
if not bookings:
 nests=nia('/nests');intent={'studioId':nests['offers'][0]['studioId'],'start':(datetime.now(timezone.utc)+timedelta(days=1)).strftime('%Y-%m-%d')};q=nia('/nests/quote',intent)
 booking=nia('/nests/bookings',{**intent,'fingerprint':q['fingerprint']},'DEMO-nest-reserve-0001')
else:booking=bookings[0]
assert any(o['id']==order['id'] for o in central('save')['operations']['orders'])
assert any(b['id']==booking['id'] for b in central('live')['operations']['bookings'])
assert any(x['id']==a['id'] for x in central('earn')['operations']['applications'])
print(json.dumps({'jobs':len(feed['jobs']),'application':a['id'],'order':order['id'],'booking':booking['id'],'sharedRecordsVerified':True}))
