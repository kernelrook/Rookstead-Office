export type Task = {id:string; title:string; done:boolean; due:string|null; projectId?:string|null};
export type CalendarEvent = {id:string; title:string; day:string};
export type Note = {id:string; title:string; body:string};
export const projectStatuses=['Planned','Active','Done'] as const;
export type Project = {id:string; title:string; description:string; status:typeof projectStatuses[number]; due:string|null};
export type Collections = {tasks:Task; events:CalendarEvent; notes:Note; projects:Project};
export const TITLE_LIMIT=160;
export const NOTE_LIMIT=30_000;
export const organizerKeys={tasks:'rookstead.central.tasks',events:'rookstead.central.calendar',notes:'rookstead.central.notes',projects:'rookstead.central.projects'} as const;
export type Collection=keyof Collections;
type StoragePort=Pick<Storage,'getItem'|'setItem'>;

const pad=(n:number)=>String(n).padStart(2,'0');
function dayKey(y:number,m:number,d:number){return `${String(y).padStart(4,'0')}-${pad(m)}-${pad(d)}`;}
const monthLength=(y:number,m:number)=>[31,y%4===0&&(y%100!==0||y%400===0)?29:28,31,30,31,30,31,31,30,31,30,31][m-1];
export function validDay(value:unknown):value is string{
 if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
 const [y,m,d]=value.split('-').map(Number);
 return y>=1&&m>=1&&m<=12&&d>=1&&d<=monthLength(y,m);
}
export function localDay(date=new Date()){
 return dayKey(date.getFullYear(),date.getMonth()+1,date.getDate());
}
export function dateForDay(day:string){
 const [y,m,d]=day.split('-').map(Number);
 const date=new Date(2000,0,1,12);
 date.setFullYear(y,m-1,d);
 return date;
}
export function shiftMonth(day:string,delta:number){
 const [y,m]=day.split('-').map(Number);
 const offset=Math.min(9999*12-1,Math.max(0,(y-1)*12+m-1+delta));
 return dayKey(Math.floor(offset/12)+1,offset%12+1,1);
}
export function monthCells(day:string):(string|null)[]{
 const [y,m]=day.split('-').map(Number);
 // Weekday is Gregorian arithmetic; a historical timezone can skip a civil day.
 const first=new Date(0);first.setUTCFullYear(y,m-1,1);
 const cells:(string|null)[]=Array(first.getUTCDay()).fill(null);
 for(let d=1;d<=monthLength(y,m);d++) cells.push(dayKey(y,m,d));
 while(cells.length%7) cells.push(null);
 return cells;
}
const object=(v:unknown):v is Record<string,unknown>=>typeof v==='object'&&v!==null&&!Array.isArray(v);
function validate<K extends Collection>(kind:K,items:unknown):Collections[K][]{
 if(!Array.isArray(items)) throw new Error('Invalid collection');
 const ids=new Set<string>();
 return items.map((item:unknown)=>{
  if(!object(item)||typeof item.id!=='string'||!item.id||item.id.length>100||ids.has(item.id)||typeof item.title!=='string'||!item.title.trim()||item.title.length>TITLE_LIMIT) throw new Error('Invalid item');
  ids.add(item.id);
  const {id,title}=item;
  if(kind==='tasks'&&typeof item.done==='boolean'&&(item.due===null||validDay(item.due))&&(item.projectId==null||(typeof item.projectId==='string'&&item.projectId.length>0&&item.projectId.length<=100)))
   return {id,title,done:item.done,due:item.due,...(item.projectId!==undefined?{projectId:item.projectId}:{})} as Collections[K];
  if(kind==='projects'&&typeof item.description==='string'&&item.description.length<=2000&&projectStatuses.some(status=>status===item.status)&&(item.due===null||validDay(item.due))) return {id,title,description:item.description,status:item.status,due:item.due} as Collections[K];
  if(kind==='events'&&validDay(item.day)) return {id,title,day:item.day} as Collections[K];
  if(kind==='notes'&&typeof item.body==='string'&&item.body.length<=NOTE_LIMIT) return {id,title,body:item.body} as Collections[K];
  throw new Error('Invalid item');
 });
}
export function loadItems<K extends Collection>(storage:StoragePort,kind:K):Collections[K][]{
 const raw=storage.getItem(organizerKeys[kind]);
 if(raw===null) return [];
 const value:unknown=JSON.parse(raw);
 if(!object(value)||value.version!==1) throw new Error('Unsupported local data');
 return validate(kind,value.items);
}
export function changeItems<K extends Collection>(storage:StoragePort,kind:K,change:(items:Collections[K][])=>Collections[K][]):Collections[K][]{
 const next=validate(kind,change(loadItems(storage,kind)));
 storage.setItem(organizerKeys[kind],JSON.stringify({version:1,items:next}));
 return next;
}
export function updateItem<T extends {id:string}>(items:T[],id:string,update:(item:T)=>T|null):T[]{
 const index=items.findIndex(item=>item.id===id);
 if(index<0) throw new Error('Item no longer exists');
 const next=items.slice();
 const item=update(next[index]);
 if(item===null) next.splice(index,1);else next[index]=item;
 return next;
}
export function newItemId(){return globalThis.crypto?.randomUUID?.()??`${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;}

export function projectProgress(tasks:Task[],id:string){
 const linked=tasks.filter(task=>task.projectId===id);
 return {done:linked.filter(task=>task.done).length,total:linked.length};
}
export function removeProject(storage:StoragePort,id:string){
 if(projectProgress(loadItems(storage,'tasks'),id).total) throw new Error('Unlink this project’s tasks in Tasks before deleting it.');
 return changeItems(storage,'projects',projects=>updateItem(projects,id,()=>null));
}
