import { test, expect } from 'bun:test';
import { validUrl, parseState, initialState, selectApps, loadState, saveState, recordLaunch } from './model';
test('allows only explicit http and https destinations without credentials', () => {
 expect(validUrl('https://example.com/app')).toBe(true);
 expect(validUrl('http://localhost:8080/')).toBe(true);
 for (const value of ['javascript:alert(1)', 'data:text/html,x', '//example.com', '/app', 'https://u:***@localhost', 'https://']) expect(validUrl(value)).toBe(false);
});
test('validates complete configuration atomically and rejects corrupt storage', () => {
 const state = initialState();
 expect(parseState(JSON.stringify(state))).toEqual(state);
 expect(() => parseState('{')).toThrow();
 expect(() => parseState(JSON.stringify({...state, apps:[{id:'x', name:'Unsafe', url:'javascript:x', category:'Work', description:'', pinned:false}]}))).toThrow();
 expect(() => parseState(JSON.stringify({...state, theme:'invisible'}))).toThrow();
 expect(() => parseState(JSON.stringify({...state, apps:[{id:'x',name:'A',url:'https://example.com',category:'Work',description:'',pinned:false},{id:'x',name:'B',url:'https://example.com',category:'Work',description:'',pinned:false}]}))).toThrow();
});

test('filters by category and ranks exact names before descriptions', () => {
 const apps = [
 {id:'a', name:'Notes archive',description:'',category:'Knowledge',url:'https://example.com',pinned:false},
 {id:'b', name:'Notes',description:'',category:'Create',url:'https://example.com',pinned:false},
 {id:'c', name:'Library',description:'notes',category:'Knowledge',url:'https://example.com',pinned:true}];
 expect(selectApps(apps as any, 'notes').map(a=>a.id)).toEqual(['b','a','c']);
 expect(selectApps(apps as any, '', 'Knowledge').map(a=>a.id)).toEqual(['c','a']);
 expect(selectApps(apps as any, 'missing')).toEqual([]);
});
test('persists valid state, preserves corrupted input, and reports unavailable storage', () => {
 const memory = new Map<string,string>();
 const storage = {getItem:(k:string)=>memory.get(k)??null,setItem:(k:string,v:string)=>{memory.set(k,v)}};
 expect(loadState(storage).state).toEqual(initialState());
 const state = {...initialState(), theme:'dark' as const};
 saveState(storage,state);
 expect(loadState(storage).state.theme).toBe('dark');
 storage.setItem('rookstead.central.v1','broken');
 expect(loadState(storage).error).toBeTruthy();
 expect(storage.getItem('rookstead.central.v1')).toBe('broken');
 expect(()=>saveState({setItem:()=>{throw new Error('blocked')}},state)).toThrow();
});


test("starts dark and upgrades the old system default without losing apps", () => {
 const fresh = loadState({getItem:()=>null});
 expect(fresh.state.theme).toBe("dark");
 const old = {...fresh.state, theme:"system"};
 const restored = loadState({getItem:()=>JSON.stringify(old)});
 expect(restored.state.theme).toBe("dark");
 expect(restored.state.apps).toEqual(fresh.state.apps);
});

test('migrates old recent launches into bounded real history and records repeated launches', () => {
 const old = {...initialState(), history:undefined, apps:[{id:'one',name:'Reader',description:'',category:'Knowledge',url:'https://example.com',pinned:true,lastOpened:100}]};
 const migrated = parseState(JSON.stringify(old));
 expect(migrated.history).toEqual([{appId:'one',name:'Reader',at:100}]);
 const next = recordLaunch(migrated, migrated.apps[0], 200);
 expect(next.history.map(e=>e.at)).toEqual([200,100]);
 expect(next.apps[0].lastOpened).toBe(200);
 expect(parseState(JSON.stringify({...next,history:[]})).history).toEqual([]);
 expect(()=>parseState(JSON.stringify({...next,history:[{appId:'one',name:'Reader',at:-1}]}))).toThrow();
 let many=next;
 for(let i=0;i<250;i++) many=recordLaunch(many,many.apps[0],i);
 expect(many.history.length).toBe(200);
});

test('migrates appearance preferences without losing apps and rejects invalid options',()=>{
 const old={...initialState(),palette:undefined,accent:undefined,motion:undefined,apps:[{id:'reader',name:'Reader',description:'',category:'Knowledge',url:'https://example.com',pinned:true}]};
 const state=parseState(JSON.stringify(old));expect(state.palette).toBe('graphite');expect(state.accent).toBe('copper');expect(state.motion).toBe(true);expect(state.apps[0].id).toBe('reader');
 expect(()=>parseState(JSON.stringify({...state,palette:'unknown'}))).toThrow();expect(()=>parseState(JSON.stringify({...state,motion:'yes'}))).toThrow();
 expect(parseState(JSON.stringify({...state,palette:'slate',accent:'sage',motion:false})).motion).toBe(false);
});
