import {createServer} from "node:http";
import {readFile} from "node:fs/promises";
import {fileURLToPath} from "node:url";
import path from "node:path";
const root=fileURLToPath(new URL("./dist/",import.meta.url));
const types={".html":"text/html; charset=utf-8",".css":"text/css",".js":"text/javascript",".wav":"audio/wav"};
const server=createServer(async(req,res)=>{
 try{const url=new URL(req.url,"http://localhost");
 const name=url.pathname==="/"?"/index.html":decodeURIComponent(url.pathname);
 const file=path.resolve(root,"."+name);
 if(!file.startsWith(path.resolve(root)+path.sep))throw Error();
 const body=await readFile(file);res.writeHead(200,{"Content-Type":types[path.extname(file)]||"application/octet-stream","Content-Length":body.length});res.end(body)}
 catch{res.writeHead(404);res.end("File unavailable")}
});
server.on("error",err=>{console.error(err.message);process.exitCode=1});
server.listen(Number(process.env.PORT||4173),"127.0.0.1",()=>console.log("Relay is ready at http://127.0.0.1:"+server.address().port));

