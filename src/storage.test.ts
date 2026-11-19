import {test,expect} from 'bun:test';
import {safeFilename, storageError, fileMatches, folderPath, directoryEntries, checkMove, type FolderMeta, type FileMeta} from './storage';
test('normalizes file names without paths, controls or blank names',()=>{
 expect(safeFilename('../report.txt')).toBe('.._report.txt');
 expect(safeFilename('  notes.txt  ')).toBe('notes.txt');
 expect(()=>safeFilename('   ')).toThrow();
 expect(safeFilename('a\\b\n.txt')).toBe('a_b_.txt');
 expect(safeFilename('x'.repeat(300)).length).toBe(180);
});
test('reports quota and unavailable storage without exposing underlying errors',()=>{
 expect(storageError({name:'QuotaExceededError'})).toContain('full');
 expect(storageError({name:'SecurityError',message:'hidden'})).not.toContain('hidden');
 expect(storageError(new Error('secret'))).toContain('unavailable');
});
test('searches only file metadata case-insensitively',()=>{
 expect(fileMatches({name:'Report.txt',type:'text/plain'},'REPORT')).toBe(true);
 expect(fileMatches({name:'Report.txt',type:'text/plain'},'image')).toBe(false);
});

const first: FolderMeta = {id:'a',name:'Projects',parentId:null,createdAt:1};
const child: FolderMeta = {id:'b',name:'Drafts',parentId:'a',createdAt:2};
const other: FolderMeta = {id:'c',name:'Archive',parentId:null,createdAt:3};
const legacy: FileMeta = {id:'1',name:'Legacy.txt',type:'text/plain',size:7,createdAt:4};
const small: FileMeta = {id:'2',name:'File 2.txt',type:'text/plain',size:2,createdAt:6,parentId:'a'};
const big: FileMeta = {id:'3',name:'File 10.txt',type:'text/plain',size:10,createdAt:5,parentId:'a'};
const folders = [first,child,other];
const files = [big,legacy,small];
const ids = (entries: {id:string}[]) => entries.map(entry=>entry.id);

test('builds ancestor breadcrumbs and resolves legacy files in root',()=>{
 expect(ids(folderPath(folders,'b'))).toEqual(['a','b']);
 expect(ids(directoryEntries({files,folders},null,'',{key:'name',direction:'asc'}))).toEqual(['c','a','1']);
 expect(ids(directoryEntries({files,folders},'b','',{key:'name',direction:'asc'}))).toEqual([]);
});
test('sorts each directory with folders first and searches only its own entries',()=>{
 const listing = (key:'name'|'date'|'size',direction:'asc'|'desc',query='') =>
  ids(directoryEntries({files,folders},'a',query,{key,direction}));
 expect(listing('name','asc')).toEqual(['b','2','3']);
 expect(listing('date','asc')).toEqual(['b','3','2']);
 expect(listing('size','desc')).toEqual(['b','3','2']);
 expect(listing('size','asc','text/plain')).toEqual(['2','3']);
 expect(listing('name','asc','legacy')).toEqual([]);
});
test('rejects moving a folder into itself or a descendant',()=>{
 expect(()=>checkMove(folders,['a'],'a')).toThrow('itself');
 expect(()=>checkMove(folders,['a'],'b')).toThrow('itself');
 expect(()=>checkMove(folders,[],'missing')).toThrow('no longer exists');
 expect(()=>checkMove(folders,['a'],'c')).not.toThrow();
});
