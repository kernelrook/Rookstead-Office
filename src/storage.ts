export type FileMeta = {id:string; name:string; type:string; size:number; createdAt:number; parentId?:string|null};
type StoredFile = FileMeta & {blob:Blob};
export type FolderMeta = {id:string; name:string; parentId:string|null; createdAt:number};
export type Directory = {files:FileMeta[]; folders:FolderMeta[]};
export type Entry = ({kind:'folder'} & FolderMeta) | ({kind:'file'} & FileMeta);
export type Sort = {key:'name'|'date'|'size'; direction:'asc'|'desc'};

class StorageIssue extends Error {}
export function safeFilename(name:string):string {
 const safe=name.trim().replace(/[\\/\u0000-\u001f\u007f<>:"|?*]/g,'_').slice(0,180);
 if (!safe || safe==='.' || safe==='..') throw new StorageIssue('Enter a file name.');
 return safe;
}
export function storageError(error:unknown):string {
 if (error instanceof StorageIssue) return error.message;
 return typeof error==='object' && error!==null && 'name' in error && error.name==='QuotaExceededError'
 ? 'Browser storage is full. Download a backup and remove files before uploading again.'
 : 'File storage is unavailable. Check browser permissions or try again. No successful save is claimed.';
}
export function fileMatches(file:Pick<FileMeta,'name'|'type'>,query:string):boolean {
 return `${file.name} ${file.type}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
}

export function folderPath(folders:FolderMeta[],id:string|null):FolderMeta[] {
 const byId=new Map(folders.map(folder=>[folder.id,folder]));
 const visited=new Set<string>();
 const path:FolderMeta[]=[];
 for(let cursor=id;cursor!==null;){
  if(visited.has(cursor)) throw new StorageIssue('The folder hierarchy is invalid.');
  const folder=byId.get(cursor);
  if(!folder) throw new StorageIssue('That folder no longer exists.');
  path.push(folder);
  visited.add(cursor);
  cursor=folder.parentId;
 }
 return path.reverse();
}
export function checkMove(folders:FolderMeta[],ids:string[],target:string|null):void {
 const selected=new Set(ids);
 if(folderPath(folders,target).some(folder=>selected.has(folder.id)))
  throw new StorageIssue('A folder cannot be moved into itself or one of its subfolders.');
}
const names=new Intl.Collator(undefined,{numeric:true,sensitivity:'base'});
export function directoryEntries({files,folders}:Directory,parentId:string|null,query:string,sort:Sort):Entry[] {
 const entries:Entry[]=[
  ...folders.filter(folder=>folder.parentId===parentId && fileMatches({name:folder.name,type:''},query)).map(folder=>({...folder,kind:'folder' as const})),
  ...files.filter(file=>(file.parentId??null)===parentId && fileMatches(file,query)).map(file=>({...file,kind:'file' as const})),
 ];
 return entries.sort((a,b)=>{
  if(a.kind!==b.kind) return a.kind==='folder'?-1:1;
  const byName=names.compare(a.name,b.name);
  const primary=sort.key==='date'?a.createdAt-b.createdAt:sort.key==='size'&&a.kind==='file'&&b.kind==='file'?a.size-b.size:byName;
  return (sort.direction==='asc'?1:-1)*primary || byName || a.id.localeCompare(b.id);
 });
}

const filesStore='files';
const foldersStore='folders';
const parentsIndex='parentId';

let opening:Promise<IDBDatabase>|undefined;
let connection:IDBDatabase|undefined;
async function database():Promise<IDBDatabase> {
 if(!globalThis.indexedDB) throw new Error('Unavailable');
 if(connection) return connection;
 // Home and Storage can open concurrently. Share the open request so neither
 // waits silently behind a blocked upgrade with no blocked event of its own.
 if(opening) return opening;
 const request=indexedDB.open('rookstead.central.files',2);
 opening=new Promise((resolve,reject)=>{
  request.onblocked=()=>reject(new StorageIssue('Close other tabs using Rookstead Storage, then retry. No files were changed.'));
  request.onupgradeneeded=event=>{
   const db=request.result;
   const files=event.oldVersion===0?db.createObjectStore(filesStore,{keyPath:'id'}):request.transaction!.objectStore(filesStore);
   // A missing parentId means root. Legacy records and their blobs stay untouched.
   files.createIndex(parentsIndex,'parentId');
   db.createObjectStore(foldersStore,{keyPath:'id'}).createIndex(parentsIndex,'parentId');
  };
  request.onerror=()=>{opening=undefined;reject(request.error)};
  request.onsuccess=()=>{
   const db=request.result;
   opening=undefined;
   connection=db;
   const forget=()=>{if(connection===db) connection=undefined;};
   db.onclose=forget;
   db.onversionchange=()=>{forget();db.close()};
   resolve(db);
  };
 });
 return opening;
}
function requestResult<T>(request:IDBRequest<T>):Promise<T>{
 return new Promise((resolve,reject)=>{
  request.onsuccess=()=>resolve(request.result);
  request.onerror=()=>reject(request.error);
 });
}
async function transact<T>(mode:IDBTransactionMode,run:(files:IDBObjectStore,folders:IDBObjectStore)=>Promise<T>):Promise<T>{
 const db=await database();
 const tx=db.transaction([filesStore,foldersStore],mode);
  const finished=new Promise<void>((resolve,reject)=>{
   tx.oncomplete=()=>resolve();
   tx.onabort=()=>reject(tx.error??new Error('Storage transaction aborted.'));
  });
  void finished.catch(()=>{}); // The request and transaction can fail in either order.
  try{
   const value=await run(tx.objectStore(filesStore),tx.objectStore(foldersStore));
   await finished;
   return value;
  }catch(error){
   try{tx.abort()}catch{/* It already settled. */}
   await finished.catch(()=>{});
   throw error;
  }
}

function fileMetadata(records:StoredFile[]):FileMeta[]{
 return records.map(({blob:_,...meta})=>meta).sort((a,b)=>b.createdAt-a.createdAt);
}
export function listFiles():Promise<FileMeta[]>{
 return transact('readonly',async files=>fileMetadata(await requestResult(files.getAll())));
}
export function listDirectory():Promise<Directory>{
 return transact('readonly',async(files,folders)=>{
  const [records,tree]=await Promise.all([requestResult(files.getAll()),requestResult(folders.getAll())]);
  return {files:fileMetadata(records),folders:tree};
 });
}
async function requireFolder(folders:IDBObjectStore,id:string|null){
 if(id!==null && !await requestResult(folders.get(id))) throw new StorageIssue('That folder no longer exists.');
}
function entryName(kind:Entry['kind'],name:string):string{
 try{return safeFilename(name)}catch(error){
  if(kind==='folder' && error instanceof StorageIssue) throw new StorageIssue('Enter a folder name.');
  throw error;
 }
}
function newId(kind:Entry['kind']):string{
 return kind+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
}
export async function uploadFiles(input:File[],parentId:string|null):Promise<void>{
 const records:StoredFile[]=input.map(file=>{
  if(file.size>50*1024*1024) throw new StorageIssue('Files must be 50 MB or smaller.');
  return {id:newId('file'),name:safeFilename(file.name),type:file.type||'application/octet-stream',size:file.size,createdAt:Date.now(),blob:file,parentId};
 });
 await transact('readwrite',async(files,folders)=>{
  await requireFolder(folders,parentId);
  await Promise.all(records.map(record=>requestResult(files.add(record))));
 });
}
export function readFile(id:string):Promise<StoredFile|undefined>{
 return transact('readonly',async files=>requestResult(files.get(id)));
}
export async function createFolder(name:string,parentId:string|null):Promise<void>{
 const folder:FolderMeta={id:newId('folder'),name:entryName('folder',name),parentId,createdAt:Date.now()};
 await transact('readwrite',async(_files,folders)=>{
  await requireFolder(folders,parentId);
  await requestResult(folders.add(folder));
 });
}
type EntryRef=Pick<Entry,'kind'|'id'>;
async function requireEntry(store:IDBObjectStore,id:string):Promise<FolderMeta|StoredFile>{
 const record=await requestResult(store.get(id));
 if(!record) throw new StorageIssue('An item no longer exists. Refresh the folder and try again.');
 return record;
}
export async function renameEntry(entry:EntryRef,name:string):Promise<void>{
 const safe=entryName(entry.kind,name);
 await transact('readwrite',async(files,folders)=>{
  const store=entry.kind==='file'?files:folders;
  const record=await requireEntry(store,entry.id);
  await requestResult(store.put({...record,name:safe}));
 });
}
export async function moveEntries(entries:EntryRef[],target:string|null):Promise<void>{
 await transact('readwrite',async(files,folders)=>{
  const tree=await requestResult(folders.getAll());
  checkMove(tree,entries.filter(entry=>entry.kind==='folder').map(entry=>entry.id),target);
  const records=await Promise.all(entries.map(async entry=>{
   const store=entry.kind==='file'?files:folders;
   return {store,record:await requireEntry(store,entry.id)};
  }));
  await Promise.all(records.map(({store,record})=>requestResult(store.put({...record,parentId:target}))));
 });
}
export async function deleteEntries(entries:EntryRef[]):Promise<void>{
 await transact('readwrite',async(files,folders)=>{
  const targets=await Promise.all(entries.map(async entry=>{
   const store=entry.kind==='file'?files:folders;
   await requireEntry(store,entry.id);
   if(entry.kind==='folder'){
    const [childFiles,childFolders]=await Promise.all([requestResult(files.index(parentsIndex).count(entry.id)),requestResult(folders.index(parentsIndex).count(entry.id))]);
    if(childFiles || childFolders) throw new StorageIssue('Only empty folders can be deleted. Move or delete their contents first.');
   }
   return {store,id:entry.id};
  }));
  await Promise.all(targets.map(({store,id})=>requestResult(store.delete(id))));
 });
}

// Root-only callers and the original single-file operations remain supported.
export const uploadFile=(file:File)=>uploadFiles([file],null);
export const renameFile=(id:string,name:string)=>renameEntry({id,kind:'file'},name);
export const deleteFile=(id:string)=>deleteEntries([{id,kind:'file'}]);
