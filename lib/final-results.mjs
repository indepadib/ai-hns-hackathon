// Read-only restitution: project ranking is separate from human individual observations.
export function finalResults(projects=[],people=[]){
 const validScore=p=>p.submitted&&typeof p.score?.total==='number'&&Number.isFinite(p.score.total)&&p.score.total>=0&&p.score.total<=100;
 const sorted=[...projects].sort((a,b)=>Number(validScore(b))-Number(validScore(a))||(validScore(a)&&validScore(b)?b.score.total-a.score.total:0)||Number(!!b.submitted)-Number(!!a.submitted)||String(a.alias).localeCompare(String(b.alias),'fr')||String(a.id).localeCompare(String(b.id)));
 let previous=null,rank=0,scored=0;
 const results=sorted.map(p=>{let position=null;if(validScore(p)){scored++;if(p.score.total!==previous){rank=scored;previous=p.score.total}position=rank}return{...p,rank:position}});
 const submitted=projects.filter(p=>p.submitted).length;
 return {projects:results,people:[...people].sort((a,b)=>String(a.alias).localeCompare(String(b.alias),'fr')),metrics:{projects:projects.length,submitted,scored,pending:submitted-scored,holdout:projects.filter(p=>p.submitted&&p.holdout).length,present:people.length,observed:people.filter(p=>p.count>0).length,followups:people.filter(p=>p.followup&&p.followup!=='none').length},provisional:submitted!==scored||projects.some(p=>!p.submitted)};
}
