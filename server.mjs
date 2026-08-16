import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('.', import.meta.url)));
const port = Number(process.env.PORT || 3000);
const apiKey = process.env.GEMINI_API_KEY;
const model = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
const mimeTypes = { '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.svg':'image/svg+xml' };

function send(res, status, body, type='application/json; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control':'no-store' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
}
async function bodyOf(req) {
  const chunks=[]; for await (const chunk of req) chunks.push(chunk);
  const text=Buffer.concat(chunks).toString('utf8');
  if(text.length > 10000) throw new Error('Request is too large');
  return JSON.parse(text || '{}');
}
function imagePart(payload) {
  const parts = payload?.candidates?.flatMap(candidate => candidate?.content?.parts || []) || [];
  return parts.find(part => part.inlineData?.data || part.inline_data?.data);
}
async function generateImage(req, res) {
  if(!apiKey) return send(res, 503, {error:'Missing GEMINI_API_KEY. Add it to your environment before starting the server.'});
  try {
    const { prompt, style='Editorial', aspectRatio='1:1' } = await bodyOf(req);
    if(typeof prompt !== 'string' || !prompt.trim()) return send(res, 400, {error:'A prompt is required.'});
    const enhancedPrompt = `${prompt.trim()}. Style: ${style}. Compose for ${aspectRatio}. Produce only the final image.`;
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const upstream = await fetch(endpoint, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({contents:[{parts:[{text:enhancedPrompt}]}], generationConfig:{responseModalities:['TEXT','IMAGE']}}) });
    const payload = await upstream.json();
    if(!upstream.ok) return send(res, upstream.status, {error:payload?.error?.message || 'Gemini rejected the request.'});
    const image = imagePart(payload);
    if(!image) return send(res, 502, {error:'Gemini returned no image. Try a different prompt or set GEMINI_IMAGE_MODEL to an image-capable model.'});
    const inline = image.inlineData || image.inline_data;
    return send(res, 200, {imageDataUrl:`data:${inline.mimeType || inline.mime_type || 'image/png'};base64,${inline.data}`});
  } catch (error) { return send(res, 500, {error:error.message || 'Unable to generate image.'}); }
}
async function serveStatic(url, res) {
  const pathname = url === '/' ? '/index.html' : url;
  const file = resolve(root, '.' + normalize(pathname));
  if(!file.startsWith(root)) return send(res, 403, {error:'Forbidden'});
  try { const data = await readFile(file); send(res, 200, data.toString(), mimeTypes[extname(file)] || 'application/octet-stream'); }
  catch { send(res, 404, {error:'Not found'}); }
}
createServer(async (req,res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if(req.method === 'POST' && url.pathname === '/api/generate-image') return generateImage(req,res);
  if(req.method === 'GET') return serveStatic(url.pathname,res);
  return send(res,405,{error:'Method not allowed'});
}).listen(port, '127.0.0.1', () => console.log(`Kanvas Studio running at http://localhost:${port}`));
