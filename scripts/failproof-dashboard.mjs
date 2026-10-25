import http from "node:http";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const home = process.env.FAILPROOFAI_HOME?.trim() || path.join(root, ".failproofai");
const eventsDir = path.join(home, "custom-agents", "events");
const port = Number(process.env.FAILPROOF_DASHBOARD_PORT || 8021);

async function readEvents() {
  const names = await fs.readdir(eventsDir).catch(() => []);
  const events = [];
  for (const name of names.filter((n) => n.endsWith(".jsonl")).sort()) {
    const text = await fs.readFile(path.join(eventsDir, name), "utf8").catch(() => "");
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim()) continue;
      try { events.push(JSON.parse(line)); } catch { }
    }
  }
  return events.sort((a, b) => String(a.timestamp || "").localeCompare(String(b.timestamp || "")));
}

const page = [
  '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Failproof evidence</title>',
  '<style>body{margin:0;background:#0b0d10;color:#f4f7fb;font:14px/1.5 ui-monospace,monospace}main{max-width:1280px;margin:auto;padding:30px}h1{font-size:28px}h1 span{color:#ff5d9e}.sub,.muted{color:#91a0b3}.cards{display:flex;gap:12px;margin:24px 0;flex-wrap:wrap}.card{background:#151a21;border:1px solid #28303a;border-radius:10px;padding:16px;min-width:130px}.value{font-size:25px;font-weight:bold}.toolbar{display:flex;gap:10px;margin:15px 0}input,select{background:#11161d;color:#fff;border:1px solid #28303a;padding:10px;border-radius:7px}.row{display:grid;grid-template-columns:180px 150px 220px 1fr;gap:12px;padding:12px;border-bottom:1px solid #242b34;background:#13171d}.type{font-weight:bold}.model{color:#78b7ff}.tool{color:#65e6a3}.hook{color:#f9c76a}.error{color:#ff7b7b}.human{color:#d6a4ff}.pill{border:1px solid #28303a;border-radius:999px;padding:2px 6px;color:#91a0b3;font-size:11px}.empty{padding:30px;color:#91a0b3;text-align:center}@media(max-width:850px){.row{grid-template-columns:1fr}}</style></head><body><main>',
  '<h1>failproof<span>_</span> / agent evidence</h1><div class="sub">Local, project-scoped telemetry for build work and agent runs · localhost:' + port + '</div>',
  '<section class="cards" id="cards"></section><div class="muted">Reads the local Failproof JSONL spool only. Refreshes every 2 seconds.</div>',
  '<div class="toolbar"><input id="q" placeholder="filter tool, session, use case…"><select id="kind"><option value="">all event types</option><option>agent_start</option><option>model_request</option><option>model_response</option><option>tool_use</option><option>tool_result</option><option>hook_triggered</option><option>hook_completed</option><option>human_wait</option><option>human_input</option><option>error</option><option>agent_end</option></select></div>',
  '<section id="timeline"><div class="empty">Waiting for events… run npm run failproof:demo.</div></section>',
  '<script>' + [
    'const esc=s=>String(s??"").replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));',
    'const cls=t=>t.startsWith("model")?"model":t.startsWith("tool")?"tool":t.startsWith("hook")?"hook":t.startsWith("human")?"human":t==="error"?"error":"";let all=[];',
    'async function load(){const r=await fetch("/api/events");all=await r.json();render()}',
    'function render(){const q=document.querySelector("#q").value.toLowerCase(),k=document.querySelector("#kind").value;const ev=all.filter(e=>(!k||e.type===k)&&(!q||JSON.stringify(e).toLowerCase().includes(q)));const c={events:all.length,sessions:new Set(all.map(e=>e.sessionId)).size,tools:all.filter(e=>e.type==="tool_use").length,policies:all.filter(e=>e.type==="hook_completed").length,errors:all.filter(e=>e.type==="error").length};document.querySelector("#cards").innerHTML=Object.entries(c).map(([k,v])=>"<div class=card><div class=value>"+v+"</div><div class=muted>"+k+"</div></div>").join("");document.querySelector("#timeline").innerHTML=ev.length?ev.slice().reverse().map(e=>{const p=e.input||e.output||e.content||e.message||"";return "<div class=row><div class=muted>"+esc(e.timestamp)+"</div><div class=type "+cls(e.type)+">"+esc(e.type)+"</div><div><span class=pill>"+esc(e.agentId)+"</span><br><span class=muted>"+esc(e.sessionId)+"</span></div><div>"+esc(typeof p==="string"?p:JSON.stringify(p))+(e.toolName?"<br><span class=pill>tool: "+esc(e.toolName)+"</span>":"")+(e.fw_use_case?"<br><span class=pill>use: "+esc(e.fw_use_case)+"</span>":"")+(e.fw_source?"<br><span class=pill>source: "+esc(e.fw_source)+"</span>":"")+"</div></div>"}).join(""):"<div class=empty>No events match this filter.</div>"}',
    'document.querySelector("#q").addEventListener("input",render);document.querySelector("#kind").addEventListener("change",render);load();setInterval(load,2000);',
  ].join('') + '</script></main></body></html>'
].join('');

http.createServer(async (req, res) => {
  if (req.url === "/api/events") {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
    res.end(JSON.stringify(await readEvents()));
    return;
  }
  res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
  res.end(page);
}).listen(port, "127.0.0.1", () => console.log("Failproof evidence dashboard: http://127.0.0.1:" + port));
