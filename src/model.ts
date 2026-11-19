export const STORAGE_KEY = 'rookstead.central.v1';
export const categories = ['Create', 'Communicate', 'Organize', 'Knowledge', 'Other'] as const;
export type Category = typeof categories[number];
export type App = { id: string; name: string; description: string; category: Category; url: string; pinned: boolean; lastOpened?: number };
export type LaunchEvent = {appId:string; name:string; at:number};
export type State = { version: 1; palette:'graphite'|'slate'|'forest'; accent:'copper'|'sage'|'blue'; motion:boolean; history: LaunchEvent[]; apps: App[]; theme: 'light' | 'dark' | 'system'; density: 'comfortable' | 'compact'; newTab: boolean };
export function initialState(): State { return {version: 1, apps: [], history: [], theme: 'dark', palette:'graphite', accent:'copper', motion:true, density: 'comfortable', newTab: true}; }
export function validUrl(value: string): boolean {
  if (!/^https?:\/\//i.test(value) || /[\s\\\u0000-\u001f\u007f]/.test(value)) return false;
  try { const url = new URL(value); return Boolean(url.hostname) && !url.username && !url.password; } catch { return false; }
}
export function parseState(raw: string): State {
 if (raw.length > 1_000_000) throw new Error('Configuration is too large.');
 const s = JSON.parse(raw);
 if (!s || s.version !== 1 || !Array.isArray(s.apps) || s.apps.length > 500 || !['light','dark','system'].includes(s.theme) || !['comfortable','compact'].includes(s.density) || typeof s.newTab !== 'boolean') throw new Error('Not a valid Central configuration.');
 const palette=s.palette??'graphite',accent=s.accent??'copper',motion=s.motion??true;
 if(!['graphite','slate','forest'].includes(palette)||!['copper','sage','blue'].includes(accent)||typeof motion!=='boolean')throw new Error('Invalid appearance preferences.');
 const ids = new Set<string>();
 const apps: App[] = s.apps.map((a: App) => {
  if (!a || typeof a.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(a.id) || ids.has(a.id) || typeof a.name !== 'string' || !a.name.trim() || a.name.length > 80 || typeof a.description !== 'string' || a.description.length > 240 || !categories.includes(a.category) || typeof a.url !== 'string' || a.url.length > 2048 || !validUrl(a.url) || typeof a.pinned !== 'boolean' || (a.lastOpened !== undefined && (!Number.isSafeInteger(a.lastOpened) || a.lastOpened < 0))) throw new Error('An app is invalid or duplicated. Nothing was imported.');
  ids.add(a.id);
  return {id:a.id,name:a.name.trim(),description:a.description,category:a.category,url:a.url,pinned:a.pinned,...(a.lastOpened === undefined ? {} : {lastOpened:a.lastOpened})};
 });
 const history = s.history === undefined ? apps.filter(a=>a.lastOpened !== undefined).map(a=>({appId:a.id,name:a.name,at:a.lastOpened!})).sort((a,b)=>b.at-a.at).slice(0,200) : s.history;
 if (!Array.isArray(history) || history.length > 200 || history.some(e=>!e || typeof e.appId !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(e.appId) || typeof e.name !== 'string' || !e.name.trim() || e.name.length > 80 || !Number.isSafeInteger(e.at) || e.at < 0)) throw new Error('Invalid launch history.');
 return {version:1,palette,accent,motion,apps,history:history.map(e=>({appId:e.appId,name:e.name,at:e.at})),theme:s.theme,density:s.density,newTab:s.newTab};
}

export function selectApps(apps: App[], query = '', category = 'All'): App[] {
 const q = query.trim().toLocaleLowerCase();
 const rank = (a: App) => a.name.toLocaleLowerCase() === q ? 0 : a.name.toLocaleLowerCase().startsWith(q) ? 1 : a.name.toLocaleLowerCase().includes(q) ? 2 : 3;
 return apps.filter(a => (category === 'All' || a.category === category) && `${a.name} ${a.description} ${a.category}`.toLocaleLowerCase().includes(q)).sort((a,b) => (q ? rank(a)-rank(b) : Number(b.pinned)-Number(a.pinned)) || a.name.localeCompare(b.name));
}
export function loadState(storage: Pick<Storage, 'getItem'>): {state: State; error?: string} {
 try { const raw = storage.getItem(STORAGE_KEY); const state = raw === null ? initialState() : parseState(raw); if (state.theme === 'system') state.theme = 'dark'; return {state}; }
 catch { return {state:initialState(),error:'Saved configuration could not be read. Existing data has not been overwritten. Import a valid backup or add an app to start a new configuration.'}; }
}
export function saveState(storage: Pick<Storage, 'setItem'>, state: State) { storage.setItem(STORAGE_KEY, JSON.stringify(parseState(JSON.stringify(state)))); }

export function recordLaunch(state:State, app:App, at=Date.now()):State {
 return {...state,apps:state.apps.map(a=>a.id===app.id?{...a,lastOpened:at}:a),history:[{appId:app.id,name:app.name,at},...state.history].slice(0,200)};
}
