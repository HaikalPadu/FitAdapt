const today = (now = new Date()) => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuala_Lumpur',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
const addDays = (date, count) => new Date(Date.parse(date+'T00:00:00Z')+count*86400000).toISOString().slice(0,10);
const weekday = date => new Date(date+'T00:00:00Z').getUTCDay() || 7;
const weekStart = date => addDays(date,1-weekday(date));
const utc = (date = new Date()) => date.toISOString().slice(0,19).replace('T',' ');
const parseUtc = value => new Date(String(value).replace(' ','T')+'Z');
module.exports = {today,addDays,weekday,weekStart,utc,parseUtc};
