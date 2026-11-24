// Server-only holdout. The random seed is stored privately, never in public assets.
import {createHmac,createHash} from 'node:crypto';
import '../public/mission-control/retail-data.js';
import '../public/mission-control/benchmark.js';
export const protocol='retail-holdout-v1';
export function privateTables(seed){
 if(typeof seed!=='string'||!/^[0-9a-f]{64}$/.test(seed))throw Error('Invalid private seed');
 let counter=0,buffer=Buffer.alloc(0),offset=0;const key=Buffer.from(seed,'hex');
 const random=()=>{if(offset>=buffer.length){buffer=createHmac('sha256',key).update('retail-holdout-v1:'+counter++).digest();offset=0}const n=buffer.readUInt32BE(offset);offset+=4;return n/4294967296};
 return globalThis.HNSRetailData.generate(random);
}
export function privateDataset(id,tables,seed){
 const d=globalThis.HNSBenchmark.dataset(id,tables);
 // Avoid revealing a target through the preceding-day feature of the next evaluation row.
 if(id==='availability')d.rows=d.rows.filter(r=>Number(r.sample.forecast_date.slice(-2))%2===0);
 d.version=protocol;
 const key=Buffer.from(seed,'hex');d.rows=d.rows.map(r=>({...r,sample:{...r.sample,sample_id:createHmac('sha256',key).update(id+'|'+r.sample.sample_id).digest('hex').slice(0,24)}}));
 return d;
}
export function inputDigest(d){return createHash('sha256').update(JSON.stringify(d.rows.map(r=>r.sample.sample_id))).digest('hex')}
export function inputPayload(d){return {version:protocol,challenge:d.id,title:d.title,labels:d.labels,description:d.description,inputDigest:inputDigest(d),inputs:d.rows.map(r=>r.sample)}}
export function evaluatePrivate(d,predictions){const aligned=globalThis.HNSBenchmark.align(d,predictions);const result=globalThis.HNSBenchmark.report(d,aligned);return{...result,version:protocol,predictionHash:createHash('sha256').update(JSON.stringify(aligned)).digest('hex')}}
