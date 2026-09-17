// Read-only visual fixture for the initial server page, before the SPA mounts.
import {createServer} from 'node:http'
const base=new URL(process.argv[2]);if(!['https:','http:'].includes(base.protocol))throw Error('invalid_base')
const response=await fetch(base);if(!response.ok)throw Error('home_unavailable')
const html=(await response.text()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'').replace('<head>',`<head><base href="${base.origin}/">`)
createServer((req,res)=>{res.writeHead(200,{'content-type':'text/html; charset=utf-8','cache-control':'no-store'});res.end(html)}).listen(5189,'127.0.0.1',()=>console.log('Initial HTML fixture: http://127.0.0.1:5189/'))
