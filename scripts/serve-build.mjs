import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {rootDir,normalizeBase,isEntrypoint} from './build-contract.mjs';

const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.webmanifest':'application/manifest+json','.svg':'image/svg+xml','.woff2':'font/woff2'};
export async function startBuildServer({directory=path.join(rootDir,'dist'),base='/',port=0,pages404=false,resolveDirectory,intercept}={}){
  base=normalizeBase(base);
  const server=http.createServer(async(req,res)=>{
    try{
      const url=new URL(req.url,'http://localhost');
      if(intercept&&await intercept(req,res,url))return;
      if(!url.pathname.startsWith(base)){res.writeHead(404);res.end('Outside app scope');return;}
      let relative=decodeURIComponent(url.pathname.slice(base.length));
      if(relative.split('/').includes('..')||relative.includes('\\')||relative.includes('\0')){res.writeHead(400);res.end();return;}
      relative||='index.html';
      const current=path.resolve(resolveDirectory?resolveDirectory():directory);
      let filename=path.resolve(current,relative);
      if(!filename.startsWith(`${current}${path.sep}`)){res.writeHead(400);res.end();return;}
      let status=200;
      try{if(!(await fs.stat(filename)).isFile())throw new Error('not a file');}
      catch{
        if(!path.extname(relative)){filename=path.join(current,'404.html');status=pages404?404:200;}
        else{res.writeHead(404,{'Cache-Control':'no-store'});res.end('Not found');return;}
      }
      const bytes=await fs.readFile(filename);
      res.writeHead(status,{'Content-Type':types[path.extname(filename)]||'text/plain; charset=utf-8','Cache-Control':'no-store, no-transform','X-Content-Type-Options':'nosniff'});res.end(bytes);
    }catch{res.writeHead(500);res.end('Unable to serve build');}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,'127.0.0.1',resolve);});
  const origin=`http://127.0.0.1:${server.address().port}`;
  return {server,origin,url:`${origin}${base}`,close:()=>new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()))};
}
if(isEntrypoint(import.meta.url)){
  const info=JSON.parse(await fs.readFile(path.join(rootDir,'dist/build-info.json'),'utf8'));
  const portIndex=process.argv.indexOf('--port');
  const port=Number(portIndex<0?(process.env.PORT||4183):process.argv[portIndex+1]);
  if(!Number.isInteger(port)||port<1||port>65535)throw new Error('Preview port must be an integer from 1 through 65535.');
  const hostIndex=process.argv.indexOf('--host');
  if(hostIndex>=0&&process.argv[hostIndex+1]!=='127.0.0.1')throw new Error('This preview serves only the local loopback interface.');
  const served=await startBuildServer({base:info.base,port,pages404:process.argv.includes('--pages-404')});
  console.log(`Production preview: ${served.url} (source ${info.sourceCommit})`);
}
