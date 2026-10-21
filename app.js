'use strict';
// No external requests, tracking, or embedded personal records.
const KEY='yadruz.records.v1',THEME='yadruz.theme.v1';
const months=['فروردین','اردیبهشت','خرداد','تیر','مرداد','شهریور','مهر','آبان','آذر','دی','بهمن','اسفند'];
const $=id=>document.getElementById(id), fa=n=>new Intl.NumberFormat('fa-IR',{useGrouping:false}).format(n);
const fmt=new Intl.DateTimeFormat('en-US-u-ca-persian',{year:'numeric',month:'numeric',day:'numeric',timeZone:'UTC'});
function jalali(d){const p=Object.fromEntries(fmt.formatToParts(d).filter(x=>x.type!=='literal').map(x=>[x.type,+x.value]));return {y:p.year,m:p.month,d:p.day}}
function utc(y,m,d){return new Date(Date.UTC(y,m-1,d,12))}
function toGregorian(y,m,d){ // Find exact Persian date using the platform calendar, no external dependency.
  let low=Date.UTC(y+620,0,1,12),high=Date.UTC(y+623,0,1,12);
  const target=y*400+m*32+d;
  while(low<=high){const mid=Math.floor((low+high)/2/86400000)*86400000+43200000;const j=jalali(new Date(mid)),v=j.y*400+j.m*32+j.d;if(v===target)return new Date(mid);if(v<target)low=mid+86400000;else high=mid-86400000}
  return null;
}
function validDate(y,m,d){return Number.isInteger(y)&&y>=1&&y<=1600&&Number.isInteger(m)&&m>=1&&m<=12&&Number.isInteger(d)&&d>=1&&d<=31&&!!toGregorian(y,m,d)}
function todayJ(){return jalali(new Date())}
function daysUntil(rec){const t=todayJ();const start=Date.UTC(new Date().getFullYear(),new Date().getMonth(),new Date().getDate(),12);for(let y=t.y;y<=t.y+2;y++){const date=toGregorian(y,rec.month,rec.day);if(date){const diff=Math.round((date.getTime()-start)/86400000);if(diff>=0)return diff}}return Infinity}
function elapsedParts(rec){
 const now=new Date(), end=new Date(Date.UTC(now.getFullYear(),now.getMonth(),now.getDate(),12));
 const start=toGregorian(rec.year,rec.month,rec.day);
 if(!start||start>end)return null;
 const t=jalali(end);
 let years=t.y-rec.year, months=t.m-rec.month, days=t.d-rec.day;
 if(days<0){let previousMonth=t.m-1,previousYear=t.y;if(previousMonth===0){previousMonth=12;previousYear--}
  const previousMonthEnd=toGregorian(previousYear,previousMonth+1,1)||toGregorian(previousYear+1,1,1);
  const lastDay=new Date(previousMonthEnd.getTime()-86400000);
  days+=jalali(lastDay).d;months--;
 }
 if(months<0){months+=12;years--}
 return {years,months,days};
}
function elapsedText(rec){const e=elapsedParts(rec);if(!e)return '—';const parts=[];
 if(e.years)parts.push(`${fa(e.years)} سال`);
 if(e.months)parts.push(`${fa(e.months)} ماه`);
 if(e.days)parts.push(`${fa(e.days)} روز`);
 return parts.join(' و ')||'امروز';
}
function elapsedYears(rec){return elapsedParts(rec)?.years??0}
function persianDigits(value){return String(value).replace(/[0-9٠-٩]/g,c=>c>='0'&&c<='9'?String.fromCharCode(c.charCodeAt(0)+1728):String.fromCharCode(c.charCodeAt(0)+144))}
function load(){try{const a=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(a)?a.filter(validate):[]}catch{return []}}
function validate(r){return !!r&&typeof r.id==='string'&&r.id.length<=100&&['birth','death'].includes(r.kind)&&typeof r.name==='string'&&r.name.trim().length>0&&r.name.length<=120&&validDate(r.year,r.month,r.day)&&typeof r.burial==='string'&&r.burial.length<=180&&typeof r.note==='string'&&r.note.length<=1000}
let records=load(),tab='upcoming',editId=null;
function save(next){try{localStorage.setItem(KEY,JSON.stringify(next));records=next;render();return true}catch{alert('ذخیره‌سازی مرورگر در دسترس نیست یا فضای آن پر شده است.');return false}}
function eventDate(r){return `${fa(r.day)} ${months[r.month-1]} ${fa(r.year)}`}
function upcomingText(r){const n=daysUntil(r);return n===0?'امروز':n===1?'فردا':`${fa(n)} روز دیگر`}
function make(tag,cls,txt){const el=document.createElement(tag);if(cls)el.className=cls;if(txt!==undefined)el.textContent=txt;return el}
function rowFor(r){
 const tr=make('tr');
 const name=make('td','name-cell');name.append(make('strong','',r.name));
 if(r.note){const note=make('small','row-note',r.note);note.title=r.note;name.append(note)}
 const date=make('td','date-cell',eventDate(r));
 const elapsed=make('td','',r.kind==='death'?elapsedText(r):`${fa(Math.max(0,elapsedYears(r)))} سال`);
 const next=make('td','',upcomingText(r));
 tr.append(name,date,elapsed);if(tab!=='death')tr.append(next);
 if(tab==='death')tr.append(make('td','burial-cell',persianDigits(r.burial||'—')));
 if(tab==='upcoming')tr.append(make('td','',r.kind==='birth'?'🎂 تولد':'🕊 یادبود'));
 const action=make('td','row-actions'),wrap=make('div','table-actions');
 const edit=make('button','table-edit','ویرایش'),del=make('button','table-delete','حذف');
 edit.type=del.type='button';edit.setAttribute('aria-label',`ویرایش ${r.name}`);del.setAttribute('aria-label',`حذف ${r.name}`);
 edit.onclick=()=>openEditor(r);del.onclick=()=>{if(confirm(`«${r.name}» حذف شود؟`))save(records.filter(x=>x.id!==r.id))};
 wrap.append(edit,del);action.append(wrap);tr.append(action);return tr;
}
function showTable(arr){
 const wrap=make('div','table-scroll'),table=make('table','records-table'),thead=make('thead'),head=make('tr');
 const columns=['نام','تاریخ '+(tab==='death'?'وفات':tab==='birth'?'تولد':'رویداد'),tab==='birth'?'سن':tab==='death'?'مدت سپری‌شده از وفات':'مدت سپری‌شده'];if(tab!=='death')columns.push(tab==='birth'?'تولد بعدی':'مناسبت بعدی');
 if(tab==='death')columns.push('محل دفن');if(tab==='upcoming')columns.push('نوع');columns.push('عملیات');
 columns.forEach(label=>head.append(make('th','',label)));thead.append(head);
 const tbody=make('tbody');arr.forEach(r=>tbody.append(rowFor(r)));table.append(thead,tbody);wrap.append(table);return wrap;
}
function render(){const soon=records.filter(r=>daysUntil(r)<=30);$('birthCount').textContent=fa(records.filter(r=>r.kind==='birth').length);$('deathCount').textContent=fa(records.filter(r=>r.kind==='death').length);$('soonCount').textContent=fa(soon.length);const t=todayJ();$('today').textContent=`امروز\n${fa(t.d)} ${months[t.m-1]} ${fa(t.y)}`;$('today').style.whiteSpace='pre-line';document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));$('listing').hidden=tab==='settings';$('settings').hidden=tab!=='settings';if(tab==='settings')return;const labels={upcoming:['رویدادهای نزدیک','در سی روز آینده'],birth:['تولدها','فهرست تولدهای ثبت‌شده'],death:['یادبودها','فهرست درگذشتگان']};$('sectionTitle').textContent=labels[tab][0];$('sectionSubtitle').textContent=labels[tab][1];$('add').textContent=tab==='death'?'＋ افزودن یادبود':'＋ افزودن شخص';let arr=records.filter(r=>tab==='upcoming'?daysUntil(r)<=30:r.kind===tab);const query=$('search').value.trim().toLocaleLowerCase('fa');if(query)arr=arr.filter(r=>(r.name+' '+r.burial+' '+r.note).toLocaleLowerCase('fa').includes(query));const sort=$('sort').value;arr.sort((a,b)=>tab==='death' ? (b.year-a.year || b.month-a.month || b.day-a.day || a.name.localeCompare(b.name,'fa')) : sort==='name'?a.name.localeCompare(b.name,'fa'):sort==='date'?(a.year-b.year||a.month-b.month||a.day-b.day):daysUntil(a)-daysUntil(b));$('cards').replaceChildren();if(!arr.length){const empty=make('div','empty');empty.append(make('div','', '🌱'),make('strong','',query?'نتیجه‌ای پیدا نشد':tab==='upcoming'?'مناسبتی در سی روز آینده نیست':'هنوز اطلاعاتی ثبت نشده است'),make('p','',query?'عبارت دیگری را جست‌وجو کن.':'برای شروع، از دکمهٔ افزودن شخص استفاده کن.'));$('cards').append(empty)}else $('cards').append(showTable(arr))}
function openEditor(r=null){editId=r?.id||null;$('entryForm').reset();$('formError').textContent='';$('dialogTitle').textContent=r?'ویرایش اطلاعات':'افزودن شخص';$('kind').value=r?.kind||(tab==='death'?'death':'birth');$('name').value=r?.name||'';$('day').value=r?.day||'';$('month').value=r?.month||1;$('year').value=r?.year||'';$('burial').value=r?.burial||'';$('note').value=r?.note||'';toggleBurial();$('editor').showModal();$('name').focus()}
function toggleBurial(){$('burialWrap').hidden=$('kind').value!=='death'}
$('month').replaceChildren(...months.map((name,i)=>{const o=make('option','',name);o.value=i+1;return o}));
$('kind').addEventListener('change',toggleBurial);$('add').onclick=()=>openEditor();$('close').onclick=$('cancel').onclick=()=>$('editor').close();
$('entryForm').onsubmit=e=>{e.preventDefault();const y=Number($('year').value),m=Number($('month').value),d=Number($('day').value);if(!validDate(y,m,d)){$('formError').textContent='تاریخ هجری شمسی معتبر نیست.';return}const r={id:editId||((globalThis.crypto&&crypto.randomUUID)?crypto.randomUUID():`${Date.now()}-${Math.random()}`),kind:$('kind').value,name:$('name').value.trim(),year:y,month:m,day:d,burial:$('kind').value==='death'?$('burial').value.trim():'',note:$('note').value.trim()};if(!validate(r)){$('formError').textContent='لطفاً اطلاعات را بررسی کن.';return}if(save(editId?records.map(x=>x.id===editId?r:x):[...records,r]))$('editor').close()};
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;render()});$('search').oninput=render;$('sort').onchange=render;
$('theme').onclick=()=>{const dark=!document.documentElement.classList.contains('dark');document.documentElement.classList.toggle('dark',dark);localStorage.setItem(THEME,dark?'dark':'light');$('theme').textContent=dark?'☀ حالت روشن':'☾ حالت تاریک'};
if(localStorage.getItem(THEME)==='dark'){document.documentElement.classList.add('dark');$('theme').textContent='☀ حالت روشن'}
$('export').onclick=()=>{const blob=new Blob([JSON.stringify({format:'yadruz-backup',version:1,records},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;const j=todayJ();const stamp=[j.y,j.m,j.d].map((v,i)=>i===0?String(v):String(v).padStart(2,'0')).join('-');a.download=`yadruz-backup ${stamp}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
$('import').onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{if(file.size>5_000_000)throw Error('فایل بیش از حد بزرگ است.');const data=JSON.parse(await file.text());if(data.format!=='yadruz-backup'||data.version!==1||!Array.isArray(data.records)||data.records.length>20000||!data.records.every(validate)||new Set(data.records.map(x=>x.id)).size!==data.records.length)throw Error('ساختار فایل پشتیبان معتبر نیست.');if(confirm(`آیا ${fa(data.records.length)} رکورد جایگزین تمام اطلاعات فعلی شود؟`))save(data.records)}catch(err){alert(err.message||'خواندن فایل ممکن نشد.')}finally{e.target.value=''}};
$('clear').onclick=()=>{if(confirm('تمام اطلاعات این مرورگر پاک شوند؟ این کار برگشت‌پذیر نیست.')&&confirm('برای تأیید نهایی، دوباره تأیید کن.'))save([])};
render();

// Import spreadsheet rows without uploading them anywhere.
$('sheetImport').onchange=async e=>{
 const file=e.target.files?.[0];if(!file)return;
 try{
  const rows=await SpreadsheetImport.read(file);
  const {results,skipped,kind}=SpreadsheetImport.convert(rows,file.name,validDate);
  if(!results.length)throw Error('هیچ رکورد دارای تاریخ شمسی معتبر در فایل پیدا نشد.');
  const signature=r=>[r.kind,r.name.replace(/\s+/g,' ').trim().replace(/ي/g,'ی').replace(/ك/g,'ک'),r.year,r.month,r.day].join('|');
  const known=new Set(records.map(signature)),fresh=[];let duplicates=0;
  for(const r of results){const key=signature(r);if(known.has(key)){duplicates++;continue}known.add(key);r.id=(globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random()}`);fresh.push(r)}
  const summary=`نوع: ${kind==='birth'?'تولد':'وفات'}\nرکوردهای خوانده‌شده: ${fa(results.length)}\nرکوردهای جدید: ${fa(fresh.length)}\nتکراری: ${fa(duplicates)}\nردیف‌های کنارگذاشته‌شده: ${fa(skipped.length)}${skipped.length?'\nنمونهٔ خطاها:\n'+skipped.slice(0,5).join('\n'):''}\n\nآیا رکوردهای جدید به اطلاعات فعلی اضافه شوند؟`;
  if(confirm(summary)&&fresh.length){if(save([...records,...fresh])){tab=kind;render();alert(`${fa(fresh.length)} رکورد اضافه شد.`)}}
 }catch(err){alert(`ورود فایل انجام نشد: ${err.message||'خطای ناشناخته'}`)}finally{e.target.value=''}
};
