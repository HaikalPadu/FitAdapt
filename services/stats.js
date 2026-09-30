function consistency(completed,missed){return completed+missed?Math.round(completed/(completed+missed)*100):0;}
function streak(sessions){let count=0;for(const s of [...sessions].sort((a,b)=>b.scheduled_date.localeCompare(a.scheduled_date))){if(s.is_rest||s.status==='rescheduled')continue;if(s.status==='missed')break;if(s.status==='completed')count++;}return count;}
module.exports={consistency,streak};
