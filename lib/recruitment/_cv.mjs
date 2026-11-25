// Netlify Forms keeps the uploaded PDF; only an opaque reference is stored in RH Blobs.
// Never allow a candidate-supplied URL to turn the CV endpoint into an open proxy.
const UPLOAD_HOST = 'd33wubrfki0l68.cloudfront.net';
export function validCVUrl(raw){
  if(typeof raw!=='string' || raw.length>1200)return false;
  try{
    const u=new URL(raw);
    return u.protocol==='https:' && u.hostname===UPLOAD_HOST && !u.username && !u.password && u.port==='' && u.pathname.length>5;
  }catch{return false;}
}
export function normalizeCV(raw){
  if(raw==null||raw==='')return null;
  let url='',name='',size=0;
  if(typeof raw==='string'){
    const value=raw.trim();
    if(validCVUrl(value)){url=value;name='CV.pdf';}
    else if(value.length<=200 && /\.pdf$/i.test(value))name=value;
  }else if(typeof raw==='object' && !Array.isArray(raw)){
    url=typeof raw.url==='string'?raw.url.trim():'';
    name=typeof raw.filename==='string'?raw.filename.trim().slice(0,140):'';
    size=Number.isSafeInteger(Number(raw.size))?Number(raw.size):0;
  }
  // Only PDFs supported; a mere filename is not considered downloadable.
  if(!validCVUrl(url))return null;
  if(!/\.pdf$/i.test(name))name='CV.pdf';
  if(size<0 || size>8*1024*1024)return null;
  return {url, filename:name, size};
}
export function candidateHasCV(raw){
  if(normalizeCV(raw))return true;
  if(typeof raw==='object' && raw!=null)return Boolean(raw.filename||raw.url);
  if(typeof raw==='string')return raw.trim().length>0 && raw!=='[object Object]';
  return false;
}
// Returned candidate summaries intentionally omit the raw upload URL.
export function safeCandidateSummary(record){
  const {cvFile,...rest}=record;
  if(rest.data){const {cv,...data}=rest.data;rest.data=data;}
  return {...rest,hasCV:Boolean(record.hasCV||cvFile?.url),cvAvailable:Boolean(cvFile?.url)};
}
export function safeNextLink(link){
  if(!link)return null;
  const next=link.split(',').find(piece=>/rel="?next"?/i.test(piece));
  const value=next?.match(/<([^>]+)>/)?.[1];
  if(!value)return null;
  try{const u=new URL(value);return u.protocol==='https:' && u.host==='api.netlify.com' && /^\/api\/v1\/forms\/[^/]+\/submissions$/.test(u.pathname)?u.href:null;}catch{return null;}
}
