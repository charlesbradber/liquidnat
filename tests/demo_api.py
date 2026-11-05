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
            code,sa=request(a);assert code==200
            _,sb=request(b);assert sa['workspace']['id']!=sb['workspace']['id']
            assert sa['capabilities']['packet_engine'] is False
            headers={'X-Demo-CSRF':sa['csrf'],'If-Match':'1','Idempotency-Key':'test-fix-auth'}
            action={'type':'fix-auth','id':'sub-0126'}
            assert request(a,'/actions',action)[0]==403
            assert request(a,'/actions',action,{**headers,'Origin':'https://untrusted.example'})[0]==403
            code,changed=request(a,'/actions',action,headers);assert code==200,changed
            assert changed['revision']==2
            assert changed['workspace']['subscribers'][125]['status']=='online'
            code,replayed=request(a,'/actions',action,headers);assert code==200 and replayed==changed
            assert request(a,'/actions',{'type':'suspend','id':'sub-0001'},headers)[0]==409
            _,other=request(b);assert other['workspace']['subscribers'][125]['status']=='auth-rejected'
            assert request(a,'/actions',{'type':'backup'},{**headers,'Idempotency-Key':'test-stale-rev'})[0]==409
            code,page=request(a,'/subscribers?q=Jordan&limit=10000');assert code==200 and page['limit']==50 and page['total']==1
            code,bad=request(a,'/actions',{'type':'exec','command':'arbitrary'},{**headers,'If-Match':'2','Idempotency-Key':'test-command'});assert code==422 and bad['error']['code']=='VALIDATION'
            code,bad=request(a,'/actions',{'type':'suspend','id':'other-workspace-id'},{**headers,'If-Match':'2','Idempotency-Key':'test-object'});assert code==422
            code,reset=request(a,'/reset',{}, {**headers,'If-Match':'2','Idempotency-Key':'test-reset'});assert code==200
            assert reset['workspace']['id']!=sa['workspace']['id']
            assert reset['workspace']['subscribers'][125]['status']=='auth-rejected'
            _,other=request(b);assert other['workspace']['id']==sb['workspace']['id']
            # Invalid requests count toward the per-session budget too.
            statuses=[request(a,'/actions',{'type':'backup'})[0] for _ in range(65)]
            assert 429 in statuses,'Rejected mutations bypassed the request rate budget'
            assert request(b)[0]==200,'Rate budget leaked across sessions'
            for path in ['/var/demo.sqlite','/router.php','/../../goal.md']:
                try:a.open(base+path,timeout=5);raise AssertionError('Private file exposed')
                except urllib.error.HTTPError as error:assert error.code==404
            print('PASS: PHP API session isolation, CSRF/origin checks, revision conflicts, exact replay, reset, pagination, validation, rate limits and private-file boundaries')
        finally:
            server.terminate();server.wait(timeout=5)

if __name__=='__main__':main()
