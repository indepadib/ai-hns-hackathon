// Preserve historical invitations, all operational responses, and uncertain sends.
export function resetEligibility(row,pass,mail,{includeSelected=false}={}){
 if(!row||!['confirmed',...(includeSelected?['selected']:[])].includes(row.status))return false;
 if(row.invitedAt||row.confirmedAt||row.checkedInAt||row.status==='invited')return false;
 if((row.history||[]).some(e=>['invited','invitation_sent','mail_sent'].includes(e.action)||e.action==='status'&&e.value==='invited'))return false;
 if(mail||pass?.checkedInAt||pass?.respondedAt||['confirmed','declined'].includes(pass?.rsvp)||pass&&!['invited'].includes(pass.status))return false;
 return true;
}
export function resetRecord(row,at){return {...row,status:'interview',updatedAt:at,history:[...(row.history||[]),{at,action:'status-correction',from:row.status,to:'interview',reason:'legacy-preselection'}].slice(-80)}}
