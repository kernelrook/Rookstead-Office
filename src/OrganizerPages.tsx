import {useEffect,useState,type ReactNode} from 'react';
import {Modal} from './Modal';
import {changeItems,dateForDay,loadItems,localDay,monthCells,newItemId,NOTE_LIMIT,organizerKeys,projectProgress,projectStatuses,removeProject,shiftMonth,TITLE_LIMIT,updateItem,validDay,type CalendarEvent,type Collection,type Collections,type Note,type Project,type Task} from './organizer';
import './OrganizerPages.css';

const shortDate=new Intl.DateTimeFormat(undefined,{month:'short',day:'numeric',year:'numeric'});
const longDate=new Intl.DateTimeFormat(undefined,{weekday:'long',month:'long',day:'numeric',year:'numeric'});
const monthLabel=new Intl.DateTimeFormat(undefined,{month:'long',year:'numeric'});
const weekdays=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
function useCollection<K extends Collection>(kind:K){
 const read=()=>{try{return {items:loadItems(localStorage,kind),unavailable:false}}catch{return {items:[],unavailable:true}}};
 const [data,setData]=useState(read);
 const [status,setStatus]=useState('');
 const [error,setError]=useState('');
 useEffect(()=>{
  const listener=(event:StorageEvent)=>{if(event.key===null||event.key===organizerKeys[kind]){setData(read());setStatus('')}};
  window.addEventListener('storage',listener);
  return ()=>window.removeEventListener('storage',listener);
 },[kind]);
 function write(action:()=>Collections[K][],message:string){
  setError('');setStatus('');
  try{setData({items:action(),unavailable:false});setStatus(message);return true}
  catch{setError('Changes were not saved. Browser storage may be blocked, full, or changed in another tab.');return false}
 }
 return {...data,status,error,write,change:(change:(items:Collections[K][])=>Collections[K][],message:string)=>write(()=>changeItems(localStorage,kind,change),message),retry:()=>setData(read())};
}
function Header({title,detail,action}:{title:string;detail:string;action?:ReactNode}){
 return <header className="rs-org-heading"><div><h1>{title}</h1><p>{detail}</p></div>{action}</header>;
}
function Feedback({data}:{data:{unavailable:boolean;status:string;error:string;retry:()=>void}}){
 return <>{data.unavailable&&<div className="rs-org-warning" role="alert">Local data couldn’t be read. Existing data hasn’t been changed. <button className="secondary" onClick={data.retry}>Retry</button></div>}{data.error&&<p className="rs-org-warning" role="alert">{data.error}</p>}<p className="rs-org-status" role="status">{data.status}</p></>;
}
function Empty({children}:{children:ReactNode}){return <p className="rs-org-empty">{children}</p>}
function Due({day}:{day:string|null}){return day?<time dateTime={day}>Due {shortDate.format(dateForDay(day))}</time>:null}
function DeletePrompt({label,title,close,remove,error}:{label:string;title:string;close:()=>void;remove:()=>void;error:string}){
 return <Modal title={`Delete ${label}`} close={close} className="rs-org-dialog"><p>Delete <strong>{title}</strong> from this browser? This can’t be undone.</p>{error&&<p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button className="secondary" onClick={close}>Cancel</button><button className="danger" onClick={remove}>Delete {label}</button></div></Modal>;
}
function Editor({title,close,save,error,children}:{title:string;close:()=>void;save:()=>void;error:string;children:ReactNode}){
 return <Modal title={title} close={close} className="rs-org-dialog"><form onSubmit={event=>{event.preventDefault();save()}}>{children}{error&&<p className="form-error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="secondary" onClick={close}>Cancel</button><button className="primary">Save</button></div></form></Modal>;
}
const localNote='Saved in this browser only. No sync.';

export function TasksPage(){
 const data=useCollection('tasks');const projects=useCollection('projects');
 const [filter,setFilter]=useState('All');
 const [draft,setDraft]=useState<Task|null>(null);
 const [deleting,setDeleting]=useState<Task|null>(null);
 const [problem,setProblem]=useState('');
 const open=(task:Task)=>{setProblem('');setDraft(task)};
 const visible=data.items.filter(task=>filter==='All'||task.done===(filter==='Completed'));
 const total=data.items.length, done=data.items.filter(task=>task.done).length;
 function save(){
  if(!draft)return;
  const title=draft.title.trim();
  if(!title||(draft.due!==null&&!validDay(draft.due))){setProblem('Enter a title and a valid due date, or leave the date blank.');return}
  const id=draft.id;
  if(data.change(items=>{
   if(!projects.unavailable&&draft.projectId&&!loadItems(localStorage,'projects').some(project=>project.id===draft.projectId)) throw new Error('Project unavailable');
   return id?updateItem(items,id,item=>({...item,title,due:draft.due,projectId:draft.projectId})):[{...draft,title,id:newItemId()},...items];
  },id?'Task updated.':'Task added.')) setDraft(null);else setProblem('Task wasn’t saved. Check storage or the selected project and try again.');
 }
 return <section className="rs-org">
  <Header title="Tasks" detail="Keep track of what needs doing." action={<button className="primary" disabled={data.unavailable} onClick={()=>open({id:'',title:'',due:null,done:false,projectId:null})}>+ Add task</button>}/>
  <div className="rs-org-toolbar"><Filter label="Task filter" options={['All','Open','Completed']} value={filter} select={setFilter}/><span>{data.unavailable?'':`${total-done} open · ${done} completed`}</span></div>
  <Feedback data={data}/>
  {!data.unavailable&&(visible.length?<ul className="rs-org-rows">{visible.map(task=>{
   const project=projects.items.find(item=>item.id===task.projectId);
   return <li key={task.id} className="rs-org-row"><label className="rs-org-check"><input aria-label={`Complete ${task.title}`} type="checkbox" checked={task.done} onChange={e=>{const checked=e.target.checked;data.change(items=>updateItem(items,task.id,item=>({...item,done:checked})),checked?'Task completed.':'Task reopened.')}}/></label><div className="rs-org-row-info"><h2 data-done={task.done}>{task.title}</h2><div className="rs-org-meta"><Due day={task.due}/>{project&&<span>{project.title}</span>}</div></div><RowActions title={task.title} edit={()=>open(task)} remove={()=>{setProblem('');setDeleting(task)}}/></li>;
  })}</ul>:<Empty>{filter==='All'?'No tasks yet. Add a task to get started.':`No ${filter.toLowerCase()} tasks.`}</Empty>)}
  <p className="rs-org-local">{localNote}</p>
  {draft&&<Editor title={draft.id?'Edit task':'Add task'} close={()=>setDraft(null)} save={save} error={problem}>
   <label>Task title<input autoFocus required maxLength={TITLE_LIMIT} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></label>
   <label>Due date (optional)<input type="date" max="9999-12-31" value={draft.due??''} onChange={e=>setDraft({...draft,due:e.target.value||null})}/></label>
   {!projects.unavailable&&(projects.items.length>0||draft.projectId)&&<label>Project (optional)<select aria-label="Project (optional)" value={draft.projectId??''} onChange={e=>setDraft({...draft,projectId:e.target.value||null})}><option value="">No project</option>{draft.projectId&&!projects.items.some(item=>item.id===draft.projectId)&&<option value={draft.projectId}>Unavailable project</option>}{projects.items.map(item=><option key={item.id} value={item.id}>{item.title}</option>)}</select></label>}
  </Editor>}
  {deleting&&<DeletePrompt label="task" title={deleting.title} close={()=>setDeleting(null)} error={problem} remove={()=>{if(data.change(items=>updateItem(items,deleting.id,()=>null),'Task deleted.'))setDeleting(null);else setProblem('Task wasn’t deleted. Try again.')}}/>}
 </section>;
}
function Filter({label,options,value,select}:{label:string;options:readonly string[];value:string;select:(value:string)=>void}){
 return <div className="rs-org-filter" role="group" aria-label={label}>{options.map(option=><button key={option} aria-pressed={option===value} onClick={()=>select(option)}>{option}</button>)}</div>;
}
function RowActions({title,edit,remove}:{title:string;edit:()=>void;remove:()=>void}){
 return <div className="rs-org-actions"><button aria-label={`Edit ${title}`} onClick={edit}>Edit</button><button aria-label={`Delete ${title}`} onClick={remove}>Delete</button></div>;
}

export function ProjectsPage(){
 const data=useCollection('projects');const tasks=useCollection('tasks');
 const [filter,setFilter]=useState('All');
 const [draft,setDraft]=useState<Project|null>(null);
 const [deleting,setDeleting]=useState<Project|null>(null);
 const [problem,setProblem]=useState('');
 const open=(project:Project)=>{setProblem('');setDraft(project)};
 const visible=data.items.filter(project=>filter==='All'||project.status===filter);
 function save(){
  if(!draft)return;
  const project={...draft,title:draft.title.trim(),description:draft.description.trim()};
  if(!project.title||(project.due!==null&&!validDay(project.due))){setProblem('Enter a name and a valid due date, or leave the date blank.');return}
  if(data.change(items=>project.id?updateItem(items,project.id,()=>project):[{...project,id:newItemId()},...items],project.id?'Project updated.':'Project added.'))setDraft(null);
  else setProblem('Project wasn’t saved. Check browser storage and try again.');
 }
 function remove(){
  if(!deleting)return;
  if(projectProgress(tasks.items,deleting.id).total){setProblem('Unlink this project’s tasks in Tasks before deleting it.');return}
  if(data.write(()=>removeProject(localStorage,deleting.id),'Project deleted.'))setDeleting(null);
  else setProblem('Project wasn’t deleted. Check linked tasks and browser storage.');
 }
 return <section className="rs-org">
  <Header title="Projects" detail="Track work by status and see progress from linked tasks." action={<button className="primary" disabled={data.unavailable} onClick={()=>open({id:'',title:'',description:'',status:'Planned',due:null})}>+ Add project</button>}/>
  <div className="rs-org-toolbar"><Filter label="Project status" options={['All',...projectStatuses]} value={filter} select={setFilter}/><span>{data.unavailable?'':`${visible.length} ${visible.length===1?'project':'projects'}`}</span></div>
  <Feedback data={data}/>
  {!data.unavailable&&(visible.length?<ul className="rs-org-rows">{visible.map(project=>{
   const progress=projectProgress(tasks.items,project.id);
   return <li key={project.id} className="rs-org-row"><div className="rs-org-row-info"><h2>{project.title}</h2><div className="rs-org-meta"><span className="rs-org-tag" data-project-status={project.status}>{project.status}</span><Due day={project.due}/><span>{tasks.unavailable?'Task progress unavailable':progress.total?`${progress.done} of ${progress.total} tasks complete`:'No linked tasks'}</span></div>{project.description&&<p>{project.description}</p>}</div><RowActions title={project.title} edit={()=>open(project)} remove={()=>{setProblem('');setDeleting(project)}}/></li>;
  })}</ul>:<Empty>{filter==='All'?'No projects yet. Add a project, then link tasks from Tasks.':`No ${filter.toLowerCase()} projects.`}</Empty>)}
  <p className="rs-org-local">{localNote}</p>
  {draft&&<Editor title={draft.id?'Edit project':'Add project'} close={()=>setDraft(null)} save={save} error={problem}>
   <label>Project name<input autoFocus required maxLength={TITLE_LIMIT} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></label>
   <label>Description (optional)<textarea maxLength={2000} rows={3} value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})}/></label>
   <label>Status<select aria-label="Status" value={draft.status} onChange={e=>setDraft({...draft,status:e.target.value as Project['status']})}>{projectStatuses.map(status=><option key={status}>{status}</option>)}</select></label>
   <label>Due date (optional)<input type="date" max="9999-12-31" value={draft.due??''} onChange={e=>setDraft({...draft,due:e.target.value||null})}/></label>
  </Editor>}
  {deleting&&<DeletePrompt label="project" title={deleting.title} close={()=>setDeleting(null)} error={problem} remove={remove}/>}
 </section>;
}

export function CalendarPage({openTasks}:{openTasks:()=>void}){
 const events=useCollection('events');const tasks=useCollection('tasks');
 const today=localDay();
 const [day,setDay]=useState(today);
 const [draft,setDraft]=useState<CalendarEvent|null>(null);
 const [deleting,setDeleting]=useState<CalendarEvent|null>(null);
 const [problem,setProblem]=useState('');
 const open=(item:CalendarEvent)=>{setProblem('');setDraft(item)};
 const actualEvents=events.items.filter(item=>item.day===day);
 const dueTasks=tasks.items.filter(item=>item.due===day);
 const counts=new Map<string,{events:number;tasks:number}>();
 for(const {day:key} of events.items){const count=counts.get(key)??{events:0,tasks:0};count.events++;counts.set(key,count)}
 for(const {due:key} of tasks.items){if(key){const count=counts.get(key)??{events:0,tasks:0};count.tasks++;counts.set(key,count)}}
 function save(){
  if(!draft)return;
  const event={...draft,title:draft.title.trim()};
  if(!event.title||!validDay(event.day)){setProblem('Enter a title and a valid date.');return}
  if(events.change(items=>event.id?updateItem(items,event.id,()=>event):[...items,{...event,id:newItemId()}],event.id?'Event updated.':'Event added.')){setDay(event.day);setDraft(null)}
  else setProblem('Event wasn’t saved. Check browser storage and try again.');
 }
 return <section className="rs-org">
  <Header title="Calendar" detail="Plan all-day events and see when tasks are due." action={<button className="primary" disabled={events.unavailable} onClick={()=>open({id:'',title:'',day})}>+ Add event</button>}/>
  <Feedback data={events}/>
  <div className="rs-org-calendar">
   <section aria-labelledby="rs-org-month">
    <div className="rs-org-toolbar rs-org-month-tools"><h2 id="rs-org-month" aria-live="polite">{monthLabel.format(dateForDay(shiftMonth(day,0)))}</h2><div><button className="secondary" aria-label="Previous month" disabled={day.startsWith('0001-01')} onClick={()=>setDay(shiftMonth(day,-1))}>‹</button><button className="secondary" onClick={()=>setDay(localDay())}>Today</button><button className="secondary" aria-label="Next month" disabled={day.startsWith('9999-12')} onClick={()=>setDay(shiftMonth(day,1))}>›</button></div></div>
    <div className="rs-org-month-grid">
     {weekdays.map(name=><span className="rs-org-weekday" key={name}>{name}</span>)}
     {monthCells(day).map((key,index)=>{
      if(!key)return <span className="rs-org-blank" key={`blank${index}`} aria-hidden="true"/>;
      const count=counts.get(key);
      const label=longDate.format(dateForDay(key))+(count?`, ${count.events} ${count.events===1?'event':'events'}, ${count.tasks} ${count.tasks===1?'task':'tasks'} due`:'');
      return <button type="button" key={key} aria-label={label} aria-current={key===today?'date':undefined} aria-pressed={key===day} onClick={()=>setDay(key)}><span>{Number(key.slice(-2))}</span>{count&&<span className="rs-org-day-marks" aria-hidden="true">{count.events>0&&<i/>}{count.tasks>0&&<i data-task=""/>}</span>}</button>;
     })}
    </div>
   </section>
   <section className="rs-org-agenda" aria-labelledby="rs-org-day">
    <div className="rs-org-agenda-date"><span>DAY AGENDA</span><h2 id="rs-org-day">{longDate.format(dateForDay(day))}</h2></div>
    {actualEvents.length>0&&<ul className="rs-org-rows">{actualEvents.map(event=><li className="rs-org-row" key={event.id}><div className="rs-org-row-info"><h3>{event.title}</h3><div className="rs-org-meta">All day</div></div><RowActions title={event.title} edit={()=>open(event)} remove={()=>{setProblem('');setDeleting(event)}}/></li>)}</ul>}
    {dueTasks.length>0&&<ul className="rs-org-rows" aria-label="Tasks due">{dueTasks.map(task=><li className="rs-org-row" key={task.id}><div className="rs-org-row-info"><h3 data-done={task.done}>{task.title}</h3><div className="rs-org-meta">{task.done?'Completed task':'Task due'}</div></div></li>)}</ul>}
    {!events.unavailable&&!tasks.unavailable&&!actualEvents.length&&!dueTasks.length&&<Empty>No events or tasks due on this day.</Empty>}
    {tasks.unavailable&&<p className="rs-org-warning">Due tasks couldn’t be read.</p>}
    {!!dueTasks.length&&<button className="rs-org-text" onClick={openTasks}>Open Tasks <span aria-hidden="true">→</span></button>}
   </section>
  </div>
  <p className="rs-org-local">{localNote}</p>
  {draft&&<Editor title={draft.id?'Edit event':'Add event'} close={()=>setDraft(null)} save={save} error={problem}>
   <label>Event title<input autoFocus required maxLength={TITLE_LIMIT} value={draft.title} onChange={e=>setDraft({...draft,title:e.target.value})}/></label>
   <label>All-day date<input required type="date" max="9999-12-31" value={draft.day} onChange={e=>setDraft({...draft,day:e.target.value})}/></label>
  </Editor>}
  {deleting&&<DeletePrompt label="event" title={deleting.title} close={()=>setDeleting(null)} error={problem} remove={()=>{if(events.change(items=>updateItem(items,deleting.id,()=>null),'Event deleted.'))setDeleting(null);else setProblem('Event wasn’t deleted. Try again.')}}/>}
 </section>;
}

const newNote:Note={id:'',title:'',body:''};
export function NotesPage(){
 const data=useCollection('notes');
 const [draft,setDraft]=useState<Note|null>(null);
 const [base,setBase]=useState<Note|null>(null);
 const [query,setQuery]=useState('');
 const [deleting,setDeleting]=useState<Note|null>(null);
 const [switching,setSwitching]=useState<{next:Note|null}|null>(null);
 const [problem,setProblem]=useState('');
 const dirty=draft!==null&&(draft.title!==base?.title||draft.body!==base?.body);
 useEffect(()=>{
  if(!dirty)return;
  const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue=''};
  window.addEventListener('beforeunload',warn);
  return ()=>window.removeEventListener('beforeunload',warn);
 },[dirty]);
 const term=query.trim().toLocaleLowerCase();
 const matches=data.items.filter(note=>!term||`${note.title} ${note.body}`.toLocaleLowerCase().includes(term));
 function choose(note:Note|null){setDraft(note);setBase(note);setProblem('')}
 function select(note:Note|null){if(dirty)setSwitching({next:note});else choose(note)}
 function save(){
  if(!draft)return;
  const name=draft.title.trim();
  if(!name){setProblem('Enter a note title.');return}
  const note={...draft,title:name,id:draft.id||newItemId()};
  if(data.change(items=>draft.id?updateItem(items,note.id,item=>{
   if(item.title!==base?.title||item.body!==base?.body)throw new Error('Note has changed');
   return note;
  }):[note,...items],'Note saved.'))choose(note);else setProblem('Note wasn’t saved. Your draft is still here.');
 }
 return <section className="rs-org">
  <Header title="Notes" detail="Write and find notes, separate from your Home focus." action={<button className="primary" disabled={data.unavailable} onClick={()=>select(newNote)}>+ New note</button>}/>
  <Feedback data={data}/>
  <div className="rs-org-notes">
   <section className="rs-org-note-list" aria-label="Saved notes">
    <label className="rs-org-note-search"><span className="sr-only">Search notes</span><input type="search" value={query} placeholder="Search notes" onChange={e=>setQuery(e.target.value)}/></label>
    {!data.unavailable&&(matches.length?<ul className="rs-org-rows">{matches.map(note=><li key={note.id}><button aria-current={draft?.id===note.id||undefined} onClick={()=>{if(draft?.id!==note.id)select(note)}}><strong>{note.title}</strong>{note.body&&<span>{note.body.slice(0,90).replace(/\s+/g,' ')}</span>}</button></li>)}</ul>:<Empty>{term?'No notes match your search.':'Saved notes will appear here.'}</Empty>)}
   </section>
   <section className="rs-org-note-editor" aria-label="Note editor">
    {draft?<form onSubmit={e=>{e.preventDefault();save()}}>
     <div className="rs-org-note-actions"><span>{dirty?'Unsaved changes':draft.id?'Editing saved note':'New note'}</span><div>{draft.id&&<button className="secondary" type="button" onClick={()=>{setProblem('');setDeleting(draft)}}>Delete note</button>}<button className="primary" disabled={data.unavailable||(!dirty&&!!draft.id)}>Save note</button></div></div>
     <label>Note title<input required maxLength={TITLE_LIMIT} placeholder="Untitled" value={draft.title} onChange={e=>{setProblem('');setDraft({...draft,title:e.target.value})}}/></label>
     <label>Note body<textarea rows={11} maxLength={NOTE_LIMIT} placeholder="Start writing…" value={draft.body} onChange={e=>{setProblem('');setDraft({...draft,body:e.target.value})}}/></label>
     {problem&&!deleting&&<p className="form-error" role="alert">{problem}</p>}
    </form>:<div className="rs-org-note-placeholder"><h2>No note open</h2><p>Select a saved note or create a new one.</p></div>}
   </section>
  </div>
  <p className="rs-org-local">{localNote} Notes are only saved when you choose Save note.</p>
  {switching&&<Modal title="Unsaved note" close={()=>setSwitching(null)} className="rs-org-dialog"><p>Discard changes to this note?</p><div className="modal-actions"><button className="secondary" onClick={()=>setSwitching(null)}>Keep editing</button><button className="danger" onClick={()=>{choose(switching.next);setSwitching(null)}}>Discard changes</button></div></Modal>}
  {deleting&&<DeletePrompt label="note" title={base?.title??deleting.title} close={()=>setDeleting(null)} error={problem} remove={()=>{if(data.change(items=>updateItem(items,deleting.id,()=>null),'Note deleted.')){setDeleting(null);choose(null)}else setProblem('Note wasn’t deleted. Try again.')}}/>}
 </section>;
}
