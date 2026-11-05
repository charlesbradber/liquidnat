<?php
declare(strict_types=1);
// Isolated simulator API only. No packetd, shell commands, RADIUS or remote callbacks.
$requestPath=parse_url($_SERVER['REQUEST_URI']??'/',PHP_URL_PATH);
if(!str_starts_with((string)$requestPath,'/demo/api/')) {
    $root=realpath(__DIR__.'/../web/dist');
    $file=$root?realpath($root.($requestPath==='/'?'/index.html':$requestPath)):false;
    if($root&&$file&&str_starts_with($file,$root.'/')&&is_file($file)) {
        $type=match(pathinfo($file,PATHINFO_EXTENSION)){'html'=>'text/html','js'=>'text/javascript','css'=>'text/css','svg'=>'image/svg+xml',default=>null};
        if($type){header('Content-Type: '.$type);header('X-Content-Type-Options: nosniff');header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data: blob:; frame-ancestors 'none'; object-src 'none'; base-uri 'self'");readfile($file);exit;}
    }
    http_response_code(404);echo 'Not found';exit;
}
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');
header("Content-Security-Policy: default-src 'none'; frame-ancestors 'none'");
header('Referrer-Policy: no-referrer');
function respond(int $status, array $data): never { http_response_code($status); echo json_encode($data, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES); exit; }
function fail(int $status, string $code, string $message): never {
    // Preserve the request budget even when validation rejects a request.
    global $db;
    if(isset($db)&&$db instanceof PDO){try{$db->exec('COMMIT');}catch(Throwable){}}
    respond($status, ['error'=>['code'=>$code,'message'=>$message],'simulation'=>true]);
}
function worker(array $request): array {
    $path=__DIR__.'/var/simulator-worker.mjs';
    if(!is_file($path)) fail(503,'NOT_BUILT','Build the shared simulator worker before starting this API.');
    // The service owner controls this runtime path; no request field influences it.
    // Hosted runners and Node version managers do not necessarily use /usr/bin/node.
    $node=getenv('LIQUIDNAT_NODE_BIN')?:'node';
    $process=proc_open([$node,$path], [0=>['pipe','r'],1=>['pipe','w'],2=>['pipe','w']],$pipes,__DIR__,['PATH'=>getenv('PATH')?:'/usr/bin:/bin']);
    if(!is_resource($process)) fail(503,'WORKER_UNAVAILABLE','Simulator worker could not start.');
    fwrite($pipes[0],json_encode($request,JSON_THROW_ON_ERROR)); fclose($pipes[0]);
    stream_set_timeout($pipes[1],3); $output=stream_get_contents($pipes[1],1000000);$meta=stream_get_meta_data($pipes[1]);fclose($pipes[1]);
    if($meta['timed_out']){proc_terminate($process,9);fclose($pipes[2]);proc_close($process);fail(503,'WORKER_TIMEOUT','Simulator operation timed out.');}
    $diagnostic=stream_get_contents($pipes[2],4096);fclose($pipes[2]);$exit=proc_close($process);
    if($exit!==0||!is_string($output)){error_log('LiquidNAT simulator worker exit '.(string)$exit.': '.(string)$diagnostic);fail(503,'WORKER_FAILED','Simulator operation failed.');}
    try {return json_decode($output,true,64,JSON_THROW_ON_ERROR);}catch(Throwable){fail(503,'WORKER_FAILED','Invalid simulator response.');}
}
try {
 $path=parse_url($_SERVER['REQUEST_URI']??'/',PHP_URL_PATH);$method=$_SERVER['REQUEST_METHOD']??'GET';
 if(!in_array($path,['/demo/api/v1/session','/demo/api/v1/subscribers','/demo/api/v1/actions','/demo/api/v1/reset'],true))fail(404,'NOT_FOUND','Unknown demo endpoint.');
 if(!in_array($method,['GET','POST'],true))fail(405,'METHOD','Only GET and POST are supported.');
 if(($path==='/demo/api/v1/actions'||$path==='/demo/api/v1/reset')&&$method!=='POST')fail(405,'METHOD','Mutation requires POST.');
 if(($path==='/demo/api/v1/session'||$path==='/demo/api/v1/subscribers')&&$method!=='GET')fail(405,'METHOD','Read endpoint requires GET.');
 $directory=getenv('LIQUIDNAT_DEMO_STATE_DIR')?:__DIR__.'/var';if(!is_dir($directory))mkdir($directory,0700,true);chmod($directory,0700);
 $db=new PDO('sqlite:'.$directory.'/demo.sqlite',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION]);chmod($directory.'/demo.sqlite',0600);
 $db->exec('PRAGMA busy_timeout=3000');$db->exec('PRAGMA max_page_count=32768'); // 128 MiB at the default 4 KiB page size.
 $db->exec('CREATE TABLE IF NOT EXISTS workspaces (token TEXT PRIMARY KEY, csrf TEXT NOT NULL, state TEXT NOT NULL, expires INTEGER NOT NULL, window INTEGER NOT NULL, requests INTEGER NOT NULL, replays TEXT NOT NULL)');
 $db->exec('BEGIN IMMEDIATE');$now=time();
 $cleanup=$db->prepare('DELETE FROM workspaces WHERE expires<=?');$cleanup->execute([$now]);
 $cookie=$_COOKIE['liquidnat_demo']??'';$token=is_string($cookie)&&preg_match('/^[a-f0-9]{64}$/D',$cookie)?hash('sha256',$cookie):'';
 $read=$db->prepare('SELECT * FROM workspaces WHERE token=?');$read->execute([$token]);$row=$read->fetch(PDO::FETCH_ASSOC);
 if(!$row){
  if($path!=='/demo/api/v1/session'||$method!=='GET')fail(401,'SESSION_REQUIRED','Start a demo session first.');
  if((int)$db->query('SELECT COUNT(*) FROM workspaces')->fetchColumn()>=128)fail(503,'DEMO_BUSY','Demo session budget is full. Try again after sessions expire.');
  $fresh=worker(['operation'=>'seed']);if(!($fresh['ok']??false))fail(503,'SEED_FAILED','Cannot initialize the demo.');
  $cookie=bin2hex(random_bytes(32));$token=hash('sha256',$cookie);
  $row=['token'=>$token,'csrf'=>bin2hex(random_bytes(24)),'state'=>json_encode($fresh['state'],JSON_THROW_ON_ERROR),'expires'=>$now+7200,'window'=>$now,'requests'=>0,'replays'=>'{}'];
  $insert=$db->prepare('INSERT INTO workspaces VALUES (:token,:csrf,:state,:expires,:window,:requests,:replays)');$insert->execute($row);
  setcookie('liquidnat_demo',$cookie,['expires'=>$now+7200,'path'=>'/demo/api/v1','secure'=>(!empty($_SERVER['HTTPS'])&&$_SERVER['HTTPS']!=='off'),'httponly'=>true,'samesite'=>'Strict']);
 }
 $count=$now-(int)$row['window']>=60?0:(int)$row['requests'];$window=$count===0?$now:(int)$row['window'];
 if($count>=60)fail(429,'RATE_LIMIT','Demo session is limited to 60 requests per minute.');
 $rate=$db->prepare('UPDATE workspaces SET window=?,requests=? WHERE token=?');$rate->execute([$window,$count+1,$token]);
 $state=json_decode($row['state'],true,64,JSON_THROW_ON_ERROR);
 if($method==='GET'){
  $result=worker(['operation'=>'tick','state'=>$state]);if(!($result['ok']??false))fail(503,'WORKER_FAILED','Cannot refresh demo state.');$state=$result['state'];
  $update=$db->prepare('UPDATE workspaces SET state=? WHERE token=?');$update->execute([json_encode($state,JSON_THROW_ON_ERROR),$token]);$db->exec('COMMIT');
  header('ETag: "'.$state['revision'].'"');
  if($path==='/demo/api/v1/subscribers'){
   $query=is_string($_GET['q']??'')?substr($_GET['q']??'',0,128):'';$offset=max(0,min(15000,(int)($_GET['offset']??0)));$limit=max(1,min(50,(int)($_GET['limit']??10)));
   $result=worker(['operation'=>'list','state'=>$state,'query'=>$query,'offset'=>$offset,'limit'=>$limit,'mode'=>$_GET['mode']??'all','status'=>$_GET['status']??'all','provider'=>$_GET['provider']??'all']);
   if(!($result['ok']??false))fail(503,'WORKER_FAILED','Cannot query demo subscribers.');
   respond(200,[...$result['page'],'offset'=>$offset,'limit'=>$limit,'revision'=>$state['revision'],'simulation'=>true]);
  }
  respond(200,['workspace'=>$state,'csrf'=>$row['csrf'],'simulation'=>true,'capabilities'=>['simulator'=>true,'packet_engine'=>false,'radius'=>false,'remote_callbacks'=>false]]);
 }
 if(!hash_equals($row['csrf'],(string)($_SERVER['HTTP_X_DEMO_CSRF']??'')))fail(403,'CSRF','Missing or invalid workspace CSRF token.');
 if(($_SERVER['HTTP_SEC_FETCH_SITE']??'')==='cross-site')fail(403,'ORIGIN','Cross-site mutations are not allowed.');
 if(isset($_SERVER['HTTP_ORIGIN'])){
  $origin=parse_url($_SERVER['HTTP_ORIGIN']);$authority=($origin['host']??'').(isset($origin['port'])?':'.$origin['port']:'');
  if($authority!==($_SERVER['HTTP_HOST']??''))fail(403,'ORIGIN','Origin does not match this demo host.');
 }
 if((int)($_SERVER['CONTENT_LENGTH']??0)>16384)fail(413,'BODY_LIMIT','Maximum request body is 16 KiB.');
 if(!str_starts_with(strtolower($_SERVER['CONTENT_TYPE']??''),'application/json'))fail(415,'CONTENT_TYPE','Use application/json.');
 $body=file_get_contents('php://input',false,null,0,16385);if(strlen($body)>16384)fail(413,'BODY_LIMIT','Maximum request body is 16 KiB.');
 try{$action=json_decode($body,true,16,JSON_THROW_ON_ERROR);}catch(Throwable){fail(400,'JSON','Invalid request JSON.');}
 $key=$_SERVER['HTTP_IDEMPOTENCY_KEY']??'';if(!preg_match('/^[A-Za-z0-9_-]{8,80}$/D',$key))fail(400,'IDEMPOTENCY_KEY','Use an 8–80 character idempotency key.');
 $match=$_SERVER['HTTP_IF_MATCH']??'';if(!preg_match('/^"?([0-9]{1,9})"?$/D',$match,$matches))fail(428,'REVISION_REQUIRED','If-Match revision is required.');$revision=(int)$matches[1];
 $replays=json_decode($row['replays'],true,64,JSON_THROW_ON_ERROR);$digest=hash('sha256',$path."\0".$revision."\0".$body);
 if(isset($replays[$key])){if(!hash_equals($replays[$key]['digest'],$digest))fail(409,'IDEMPOTENCY_CONFLICT','This key was used for a different request.');$db->exec('COMMIT');respond(200,$replays[$key]['response']);}
 if(count($replays)>=64)fail(429,'REPLAY_BUDGET','Reset your demo after 64 mutations.');
 if($revision!==$state['revision'])fail(409,'REVISION_CONFLICT','Refresh the workspace before applying another change.');
 if($path==='/demo/api/v1/reset'){$fresh=worker(['operation'=>'seed']);$state=$fresh['state'];$replays=[];}else{
  $result=worker(['operation'=>'apply','state'=>$state,'action'=>$action,'expectedRevision'=>$revision]);
  if(!($result['ok']??false)){ $error=$result['error']??['code'=>'INVALID','message'=>'Invalid action'];fail(in_array($error['code'],['REVISION_CONFLICT','INVALID_STATE','JOB_RUNNING'],true)?409:422,$error['code'],$error['message']); }
  $state=$result['state'];
 }
 $response=['workspace'=>$state,'simulation'=>true,'revision'=>$state['revision']];
 $replays[$key]=['digest'=>$digest,'response'=>$response];
 $update=$db->prepare('UPDATE workspaces SET state=?,replays=? WHERE token=?');$update->execute([json_encode($state,JSON_THROW_ON_ERROR),json_encode($replays,JSON_THROW_ON_ERROR),$token]);$db->exec('COMMIT');header('ETag: "'.$state['revision'].'"');respond(200,$response);
}catch(Throwable $error){error_log('LiquidNAT demo API failure: '.get_class($error));fail(500,'INTERNAL','Demo request failed without applying a network operation.');}
