import {useEffect, useRef, useState, type ReactNode} from 'react';
import {Modal} from './Modal';
import {checkMove, createFolder, deleteEntries, directoryEntries, folderPath, listDirectory, moveEntries, readFile, renameEntry, safeFilename, storageError, uploadFiles, type Directory, type Entry, type Sort} from './storage';
import './StoragePage.css';

const sortOptions: [string, string][] = [['name-asc','Name: A–Z'],['name-desc','Name: Z–A'],['date-desc','Date: newest'],['date-asc','Date: oldest'],['size-desc','Size: largest'],['size-asc','Size: smallest']];
const dateFormat = new Intl.DateTimeFormat(undefined,{dateStyle:'medium'});
const emptyDirectory: Directory = {files:[],folders:[]};
const itemCount = (count:number) => `${count} ${count===1?'item':'items'}`;
type Action = 'create'|'rename'|'move'|'delete';
const titles: Record<Action,string> = {create:'New folder',rename:'Rename',move:'Move items',delete:'Delete items'};
function bytes(size:number){return size<1024?`${size} B`:size<1024**2?`${(size/1024).toFixed(1)} KB`:size<1024**3?`${(size/1024**2).toFixed(1)} MB`:`${(size/1024**3).toFixed(1)} GB`;}
function Glyph({kind}:{kind:'folder'|'file'|'upload'|'search'}){
 const paths:Record<typeof kind,ReactNode>={folder:<path d="M3 7a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>,file:<path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6m-6 4h6"/>,upload:<path d="M12 16V3m-5 5 5-5 5 5M4 16v5h16v-5"/>,search:<><circle cx="10.5" cy="10.5" r="5.5"/><path d="m15 15 5 5"/></>};
 return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[kind]}</svg>;
}

export function StoragePage(){
 const [data,setData]=useState<Directory>(emptyDirectory);
 const [location,setLocation]=useState<string|null>(null);
 const [query,setQuery]=useState('');
 const [sort,setSort]=useState<Sort>({key:'name',direction:'asc'});
 const [selected,setSelected]=useState<Set<string>>(()=>new Set());
 const [loading,setLoading]=useState(true);
 const [readable,setReadable]=useState(false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [status,setStatus]=useState('');
 const [dialog,setDialog]=useState<{action:Action;entries:Entry[]}|null>(null);
 const [name,setName]=useState('');
 const [target,setTarget]=useState<string|null>(null);
 const [dialogError,setDialogError]=useState('');
 const input=useRef<HTMLInputElement>(null);
 const selectAll=useRef<HTMLInputElement>(null);
 const current=data.folders.find(folder=>folder.id===location)?.id??null;
 const trail=folderPath(data.folders,current);
 const all=directoryEntries(data,current,'',sort);
 const visible=query.trim()?directoryEntries(data,current,query,sort):all;
 const checked=visible.filter(entry=>selected.has(entry.id));
 const fullyChecked=checked.length>0 && checked.length===visible.length;
 const total=all.reduce((sum,entry)=>sum+(entry.kind==='file'?entry.size:0),0);
 const active=readable&&!loading&&!busy;

 useEffect(()=>{
  let alive=true;
  listDirectory().then(result=>{if(alive){setData(result);setReadable(true)}})
   .catch(reason=>{if(alive)setError(storageError(reason))}).finally(()=>{if(alive)setLoading(false)});
  return ()=>{alive=false};
 },[]);
 useEffect(()=>{if(selectAll.current) selectAll.current.indeterminate=checked.length>0&&!fullyChecked},[checked.length,fullyChecked,loading]);
 async function refresh(){
  setError('');
  try{
   const result=await listDirectory();
   setData(result);
   setLocation(id=>result.folders.some(folder=>folder.id===id)?id:null);
   setReadable(true);
  }catch(reason){setReadable(false);setError(storageError(reason))}
 }
 function browse(id:string|null){setLocation(id);setQuery('');setSelected(new Set());setStatus('');setError('');}
 function select(id:string){setSelected(previous=>{const next=new Set(previous);if(next.has(id)) next.delete(id);else next.add(id);return next;});}
 async function upload(files:FileList|null){
  if(!files?.length)return;
  const batch=Array.from(files);
  setBusy(true);setError('');setStatus('');
  try{await uploadFiles(batch,current);setStatus(`${batch.length===1?'1 file':batch.length+' files'} saved in this browser.`);await refresh()}
  catch(reason){setError(storageError(reason))}
  finally{setBusy(false);if(input.current) input.current.value=''}
 }
 async function download(entry:Entry){
  setError('');
  try{
   const saved=await readFile(entry.id);
   if(!saved){setError('That file no longer exists. Refresh the folder and try again.');return;}
   const url=URL.createObjectURL(saved.blob);
   const link=document.createElement('a');link.href=url;link.download=safeFilename(saved.name);link.click();
   setTimeout(()=>URL.revokeObjectURL(url),1000);
  }catch(reason){setError(storageError(reason))}
 }
 function begin(action:Action){
  setName(action==='rename'?checked[0].name:'');setDialogError('');setTarget(current);setStatus('');
  setDialog({action,entries:checked});
 }
 async function submit(){
  if(!dialog||busy)return;
  const {action,entries}=dialog;
  setBusy(true);setDialogError('');
  try{
   if(action==='create') await createFolder(name,current);
   if(action==='rename') await renameEntry(entries[0],name);
   if(action==='move') await moveEntries(entries,target);
   if(action==='delete') await deleteEntries(entries);
   setSelected(new Set());setDialog(null);
   setStatus(action==='create'?'Folder created.':action==='rename'?'Name saved.':`${itemCount(entries.length)} ${action==='move'?'moved':'deleted'}.`);
   await refresh();
  }catch(reason){setDialogError(storageError(reason))}
  finally{setBusy(false)}
 }
 const destinations=dialog?.action==='move'?data.folders.map(folder=>{
  const label=['Local files',...folderPath(data.folders,folder.id).map(part=>part.name)].join(' / ');
  let allowed=true;
  try{checkMove(data.folders,dialog.entries.filter(entry=>entry.kind==='folder').map(entry=>entry.id),folder.id)}catch{allowed=false}
  return {...folder,label,allowed};
 }).sort((a,b)=>a.label.localeCompare(b.label)):[];
 const naming=dialog?.action==='create'||dialog?.action==='rename';
 const nameLabel=dialog?.action==='create'||dialog?.entries[0]?.kind==='folder'?'Folder name':'File name';
 return <section className="rs-storage" aria-label="Local file manager">
  <div className="rs-storage-heading">
   <div><span className="rs-storage-kicker">FILES ON THIS BROWSER</span><h2>File manager</h2></div>
   <div className="rs-storage-create">
    <button className="secondary" disabled={!active} onClick={()=>begin('create')}><span aria-hidden="true">+</span> New folder</button>
    <label className="primary rs-storage-upload"><Glyph kind="upload"/>Upload files<input ref={input} type="file" multiple aria-label="Upload files" disabled={!active} onChange={event=>void upload(event.target.files)}/></label>
   </div>
  </div>
  <div className="rs-storage-location">
   <div role="navigation" aria-label="Current folder" className="rs-storage-crumbs">
    <Glyph kind="folder"/>
    {trail.length?<button disabled={!active} onClick={()=>browse(null)}>Local files</button>:<span aria-current="location">Local files</span>}
    {trail.map((folder,index)=><span className="rs-storage-crumb" key={folder.id}><span aria-hidden="true">/</span>{index===trail.length-1?<span aria-current="location">{folder.name}</span>:<button disabled={!active} onClick={()=>browse(folder.id)}>{folder.name}</button>}</span>)}
   </div>
   <span className="rs-storage-total">{readable?`${itemCount(all.length)} · ${bytes(total)} in this folder`:null}</span>
  </div>
  <div className="rs-storage-filters">
   <label className="rs-storage-search"><Glyph kind="search"/><input type="search" aria-label="Search this folder" placeholder="Search this folder" value={query} disabled={!readable} onChange={event=>{setQuery(event.target.value);setSelected(new Set())}}/></label>
   <label className="rs-storage-sort">Sort by <select aria-label="Sort by" value={`${sort.key}-${sort.direction}`} disabled={!readable} onChange={event=>{const [key,direction]=event.target.value.split('-') as [Sort['key'],Sort['direction']];setSort({key,direction});}}>{sortOptions.map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label>
  </div>
  {error&&<div className="rs-storage-alert" role="alert">{error}{!readable&&<button className="secondary" disabled={loading} onClick={()=>{setLoading(true);void refresh().finally(()=>setLoading(false));}}>Retry</button>}</div>}
  <div className="rs-storage-selection" aria-label="Selection actions">
   <span>{checked.length?`${checked.length} selected`:query.trim()?`${itemCount(visible.length)} found`:'Select items to manage them'}</span>
   {checked.length>0&&<div>
    <button disabled={!active||checked.length!==1||checked[0].kind!=='file'} onClick={()=>void download(checked[0])}>Download</button>
    <button disabled={!active||checked.length!==1} onClick={()=>begin('rename')}>Rename</button>
    <button disabled={!active} onClick={()=>begin('move')}>Move</button>
    <button disabled={!active} onClick={()=>begin('delete')}>Delete</button>
    <button disabled={busy} onClick={()=>setSelected(new Set())}>Clear</button>
   </div>}
  </div>
  <table className="rs-storage-table" aria-label="Folder contents">
   <thead><tr><th scope="col" className="rs-storage-check"><input ref={selectAll} type="checkbox" aria-label="Select all visible items" disabled={!active||!visible.length} checked={fullyChecked} onChange={()=>setSelected(fullyChecked?new Set():new Set(visible.map(entry=>entry.id)))}/></th><th scope="col">Name</th><th scope="col" className="rs-storage-date">Date added</th><th scope="col" className="rs-storage-size">Size</th></tr></thead>
   <tbody>{readable&&visible.map(entry=><tr key={entry.id} data-selected={selected.has(entry.id)||undefined}>
    <td className="rs-storage-check"><input type="checkbox" aria-label={`Select ${entry.name}`} checked={selected.has(entry.id)} disabled={!active} onChange={()=>select(entry.id)}/></td>
    <td><div className="rs-storage-item" data-kind={entry.kind}><Glyph kind={entry.kind}/><div>{entry.kind==='folder'?<button aria-label={`Open ${entry.name}`} disabled={!active} onClick={()=>browse(entry.id)}>{entry.name}</button>:<span>{entry.name}</span>}<small>{entry.kind==='folder'?'Folder':entry.type}</small><small className="rs-storage-mobile-meta">{dateFormat.format(entry.createdAt)}{entry.kind==='file'?` · ${bytes(entry.size)}`:''}</small></div>{entry.kind==='folder'&&<span className="rs-storage-chevron" aria-hidden="true">›</span>}</div></td>
    <td className="rs-storage-date">{dateFormat.format(entry.createdAt)}</td><td className="rs-storage-size">{entry.kind==='file'?bytes(entry.size):'—'}</td>
   </tr>)}</tbody>
  </table>
  {(loading||!readable||!visible.length)&&<div className="rs-storage-empty"><Glyph kind={query.trim()?'search':'folder'}/><div><h3>{loading?'Reading local files…':!readable?'Local files aren’t available':query.trim()?'No matching items':'This folder is empty'}</h3><p>{loading?'Opening browser storage.':!readable?'Retry once browser storage is available.':query.trim()?'Try a different name or file type.':'Upload files here or create a folder to organize them.'}</p>{active&&query.trim()&&<button onClick={()=>{setQuery('');setSelected(new Set());}}>Clear search</button>}</div></div>}
  <p className="rs-storage-status" role="status">{busy&&!dialog?'Working…':status}</p>
  <details className="rs-storage-notes"><summary>Storage limits & backups</summary><p>Files stay in this browser and are not synced. Clearing site data removes them. Maximum 50 MB per file; available space depends on browser quota.</p><p>Files are downloaded, never previewed or executed here. Settings exports don’t include your files; download important files separately.</p></details>
  {dialog&&<Modal title={titles[dialog.action]} className="rs-storage-dialog" close={()=>{if(!busy)setDialog(null)}}>
   <form onSubmit={event=>{event.preventDefault();void submit()}}>
    {naming&&<label>{nameLabel}<input autoFocus required maxLength={180} value={name} disabled={busy} onChange={event=>setName(event.target.value)}/></label>}
    {dialog.action==='move'&&<><p>Choose a destination for {itemCount(dialog.entries.length)}.</p><label>Destination folder<select autoFocus value={target??''} disabled={busy} onChange={event=>setTarget(event.target.value||null)}><option value="">Local files</option>{destinations.map(folder=><option key={folder.id} value={folder.id} disabled={!folder.allowed}>{folder.label}</option>)}</select></label></>}
    {dialog.action==='delete'&&<p>Delete {dialog.entries.length===1?<strong>{dialog.entries[0].name}</strong>:itemCount(dialog.entries.length)} from this browser? This cannot be undone. Only empty folders can be deleted.</p>}
    {dialogError&&<p className="form-error" role="alert">{dialogError}</p>}
    <div className="modal-actions"><button type="button" className="secondary" disabled={busy} onClick={()=>setDialog(null)}>Cancel</button><button className={dialog.action==='delete'?'danger':'primary'} disabled={busy||(dialog.action==='move'&&target===current)}>{dialog.action==='delete'?'Delete permanently':dialog.action==='move'?'Move here':dialog.action==='create'?'Create folder':'Save name'}</button></div>
   </form>
  </Modal>}
 </section>;
}
