#!/usr/bin/env python3
"""HTTP-level demo isolation/security regression. Starts a loopback-only PHP server."""
import http.cookiejar
import json
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import time
import urllib.error
import urllib.request

ROOT=Path(__file__).resolve().parents[1]
if not __debug__: raise RuntimeError('Run API regression without Python optimization')

def main():
    if not (ROOT/'management/api/var/simulator-worker.mjs').is_file():
        raise RuntimeError('Build the simulator worker: cd management/web && node scripts/build-api.mjs')
    with socket.socket() as probe:
        probe.bind(('127.0.0.1',0));port=probe.getsockname()[1]
    base=f'http://127.0.0.1:{port}'
    with tempfile.TemporaryFile() as log, tempfile.TemporaryDirectory(prefix='liquidnat-demo-api-') as state_dir:
        server=subprocess.Popen(['php','-S',f'127.0.0.1:{port}',str(ROOT/'management/api/router.php')],stdout=log,stderr=log,env={**os.environ,'LIQUIDNAT_DEMO_STATE_DIR':state_dir})
        try:
            for _ in range(50):
                try:
                    with socket.create_connection(('127.0.0.1',port),timeout=.1):break
                except OSError:time.sleep(.05)
            def client():return urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
            a,b=client(),client()
            def request(client,path='/session',body=None,headers=None):
                data=None if body is None else json.dumps(body).encode()
                req=urllib.request.Request(base+'/demo/api/v1'+path,data=data,headers={'Content-Type':'application/json',**(headers or {})})
                try:
                    with client.open(req,timeout=5) as response:return response.status,json.load(response)
                except urllib.error.HTTPError as error:return error.code,json.load(error)
            assert request(a,'/subscribers')[0]==401
            code,sa=request(a);assert code==200,(code,sa)
            _,sb=request(b);assert sa['workspace']['id']!=sb['workspace']['id']
            assert sa['capabilities']['packet_engine'] is False
            headers={'X-Demo-CSRF':sa['csrf'],'If-Match':'1','Idempotency-Key':'test-fix-auth'}
            action={'type':'fix-auth','id':'sub-0126'}
            assert request(a,'/actions',action)[0]==403
            assert request(a,'/actions',action,{**headers,'Origin':'https://untrusted.example'})[0]==403
            code,changed=request(a,'/actions',action,headers);assert code==200,changed
            assert changed['revision']==2
            assert next(sub for sub in changed['workspace']['subscriberChanges'] if sub['id']=='sub-0126')['status']=='online'
            code,replayed=request(a,'/actions',action,headers);assert code==200 and replayed==changed
            assert request(a,'/actions',{'type':'suspend','id':'sub-0001'},headers)[0]==409
            _,other=request(b);assert other['workspace']['subscriberChanges']==[]
            assert request(a,'/actions',{'type':'backup'},{**headers,'Idempotency-Key':'test-stale-rev'})[0]==409
            code,page=request(a,'/subscribers?q=Jordan&limit=10000');assert code==200 and page['limit']==50 and page['total']==1
            code,bad=request(a,'/actions',{'type':'exec','command':'arbitrary'},{**headers,'If-Match':'2','Idempotency-Key':'test-command'});assert code==422 and bad['error']['code']=='VALIDATION'
            code,bad=request(a,'/actions',{'type':'suspend','id':'other-workspace-id'},{**headers,'If-Match':'2','Idempotency-Key':'test-object'});assert code==422
            code,reset=request(a,'/reset',{}, {**headers,'If-Match':'2','Idempotency-Key':'test-reset'});assert code==200
            assert reset['workspace']['id']!=sa['workspace']['id']
            assert reset['workspace']['subscriberChanges']==[]
            _,other=request(b);assert other['workspace']['id']==sb['workspace']['id']
            assert sa['workspace']['compact'] is True and len(json.dumps(sa))<20000
            code,large_page=request(a,'/subscribers?limit=50');assert code==200 and len(large_page['items'])==50 and large_page['total']==12864
            code,page=request(a,'/subscribers?offset=12000&limit=10');assert code==200 and page['total']==12864 and len(page['items'])==10
            sample=page['items'][0]
            for field in ['username','ip','ipv6','ipv6Address','mac']:
                from urllib.parse import quote
                code,found=request(a,'/subscribers?q='+quote(sample[field]));assert code==200 and any(sub['id']==sample['id'] for sub in found['items']),(field,found)
            code,static=request(a,'/actions',{'type':'addressing','id':'sub-0001','mode':'static','staticIp':'192.0.2.50'}, {**headers,'If-Match':'1','Idempotency-Key':'test-static-ip'});assert code==200,static
            assert next(sub for sub in static['workspace']['subscriberChanges'] if sub['id']=='sub-0001')['addressMode']=='static'
            code,duplicate=request(a,'/actions',{'type':'addressing','id':'sub-0002','mode':'static','staticIp':'192.0.2.50'}, {**headers,'If-Match':'2','Idempotency-Key':'test-duplicate-ip'});assert code==422 and duplicate['error']['code']=='ADDRESS_IN_USE'
            code,found=request(a,'/subscribers?q=192.0.2.50');assert code==200 and found['total']==1
            # Provider/profile actions use the same isolated worker and revision rules.
            def change(action, revision, key):
                return request(a,'/actions',action,{**headers,'If-Match':str(revision),'Idempotency-Key':key})
            code,provider=change({'type':'save-provider','name':'City Fibre'},2,'provider-create');assert code==200,provider
            provider_id=provider['workspace']['providers'][-1]['id']
            code,profile=change({'type':'save-profile','name':'City 200','provider':provider_id,'down':200,'up':50,'price':30},3,'provider-profile');assert code==200,profile
            profile_id=profile['workspace']['profiles'][-1]['id']
            code,bad=change({'type':'profile','id':'sub-0001','profile':profile_id,'provider':'examplenet'},4,'provider-mismatch');assert code==422 and bad['error']['code']=='PROVIDER_MISMATCH',bad
            code,moved=change({'type':'profile','id':'sub-0001','profile':profile_id,'provider':provider_id},4,'provider-transfer');assert code==200,moved
            assert next(sub for sub in moved['workspace']['subscriberChanges'] if sub['id']=='sub-0001')['provider']==provider_id
            code,city_page=request(a,'/subscribers?provider='+provider_id);assert code==200 and city_page['total']==1,city_page
            code,stored=request(a);assert code==200 and stored['workspace']['providers'][-1]['id']==provider_id
            _,isolated=request(b);assert len(isolated['workspace']['providers'])==1 and len(isolated['workspace']['profiles'])==3
            code,in_use=change({'type':'delete-provider','id':provider_id},5,'provider-in-use');assert code==422 and in_use['error']['code']=='IN_USE',in_use
            code,plan=request(a,'/actions',{'type':'create-profile','name':'Fibre 2500','down':2500,'up':1000},{**headers,'If-Match':'5','Idempotency-Key':'test-create-profile'});assert code==200,plan
            policy=next(p for p in plan['workspace']['profiles'] if p['name']=='Fibre 2500')
            code,assigned=request(a,'/actions',{'type':'profile','id':'sub-0001','profile':policy['id']},{**headers,'If-Match':'6','Idempotency-Key':'test-assign-profile'});assert code==200,assigned
            subscriber=next(s for s in assigned['workspace']['subscriberChanges'] if s['id']=='sub-0001')
            assert subscriber['profile']==policy['id'] and subscriber['ip']=='192.0.2.50'
            code,bad=request(a,'/actions',{'type':'create-profile','name':'fibre 2500','down':2500,'up':1000},{**headers,'If-Match':'7','Idempotency-Key':'test-duplicate-profile'});assert code==422 and bad['error']['code']=='DUPLICATE'
            _,persisted=request(a);assert any(p['id']==policy['id'] for p in persisted['workspace']['profiles'])
            _,other=request(b);assert len(other['workspace']['profiles'])==3
            # Network defaults and per-subscriber PPPoE/DHCP configuration share the RADIUS model.
            code,network_type=change({'type':'save-provider','id':'examplenet','name':'ExampleNet','connectionType':'dhcp'},7,'network-dhcp-default');assert code==200,network_type
            code,access=change({'type':'connection','id':'sub-0001','connectionType':'dhcp'},8,'subscriber-dhcp');assert code==200,access
            assert next(s for s in access['workspace']['subscriberChanges'] if s['id']=='sub-0001')['connectionType']=='dhcp'
            code,new_access=change({'type':'create','name':'DHCP Customer','username':'dhcp.customer@example.net','profile':'home100'},9,'create-dhcp-customer');assert code==200,new_access
            assert any(s['name']=='DHCP Customer' and s['connectionType']=='dhcp' for s in new_access['workspace']['subscriberChanges'])
            code,dhcp_page=request(a,'/subscribers?connectionType=dhcp');assert code==200 and dhcp_page['total']==2,dhcp_page
            code,bad=change({'type':'connection','id':'sub-0001','connectionType':'unknown'},10,'reject-invalid-access');assert code==422 and bad['error']['code']=='VALIDATION',bad
            _,isolated=request(b);assert isolated['workspace']['providers'][0]['connectionType']=='pppoe'
            # Invalid requests count toward the per-session budget too.
            statuses=[request(a,'/actions',{'type':'backup'})[0] for _ in range(65)]
            assert 429 in statuses,'Rejected mutations bypassed the request rate budget'
            assert request(b)[0]==200,'Rate budget leaked across sessions'
            for path in ['/var/demo.sqlite','/router.php','/../../goal.md']:
                try:a.open(base+path,timeout=5);raise AssertionError('Private file exposed')
                except urllib.error.HTTPError as error:assert error.code==404
            print('PASS: PHP API session isolation, CSRF/origin checks, revision conflicts, exact replay, reset, pagination, validation, rate limits and private-file boundaries')
        except BaseException:
            log.seek(0)
            print(log.read().decode(errors='replace'))
            raise
        finally:
            server.terminate();server.wait(timeout=5)

if __name__=='__main__':main()
