export const LAYOUT_KEY='rookstead.central.dashboard.v1';
export const widgetCatalog = [
 {id:'summary',title:'Today’s summary',description:'Date and actual workspace totals',span:12},
 {id:'focus',title:'Today / Focus',description:'A private, browser-local focus note',span:5},
 {id:'recent',title:'Recent work',description:'Tools you actually opened from Central',span:4},
 {id:'activity',title:'Activity',description:'Latest actual launch clicks',span:3},
 {id:'pinned',title:'Pinned apps',description:'Quick access to your everyday tools',span:5},
 {id:'files',title:'Working files',description:'Recent files saved in this browser',span:4},
 {id:'workspace',title:'Workspace',description:'Local storage and connection boundaries',span:3},
 {id:'calendar',title:'Calendar',description:'Local events and task due dates',span:4},
 {id:'projects',title:'Projects',description:'Local projects and linked tasks',span:5},
] as const;
export type WidgetId=typeof widgetCatalog[number]['id'];
export type Layout={version:1;widgets:WidgetId[]};
export function defaultLayout():Layout{return{version:1,widgets:['summary','focus','recent','activity','pinned','files','workspace']}}
export function parseLayout(raw:string):Layout{
 const value=JSON.parse(raw);
 if(!value||value.version!==1||!Array.isArray(value.widgets)||value.widgets.length>widgetCatalog.length||new Set(value.widgets).size!==value.widgets.length||value.widgets.some((id:unknown)=>!widgetCatalog.some(w=>w.id===id)))throw new Error('Invalid dashboard layout.');
 return{version:1,widgets:[...value.widgets]};
}
export function loadLayout(storage:Pick<Storage,'getItem'>):{layout:Layout;error?:string}{
 try{const raw=storage.getItem(LAYOUT_KEY);return{layout:raw===null?defaultLayout():parseLayout(raw)}}catch{return{layout:defaultLayout(),error:'The saved dashboard layout could not be read. Defaults are shown; nothing has been overwritten.'}}
}
export function beginEdit(layout:Layout):Layout{return{version:1,widgets:[...layout.widgets]}}
export function moveWidget(layout:Layout,id:WidgetId,delta:number):Layout{
 const from=layout.widgets.indexOf(id);const to=from+delta;
 if(from<0||to<0||to>=layout.widgets.length||!Number.isInteger(delta))return beginEdit(layout);
 const widgets=[...layout.widgets];widgets.splice(from,1);widgets.splice(to,0,id);return{version:1,widgets};
}
export function placeWidget(layout:Layout,id:WidgetId,target:WidgetId):Layout{
 const from=layout.widgets.indexOf(id),to=layout.widgets.indexOf(target);
 return from<0||to<0?beginEdit(layout):moveWidget(layout,id,to-from);
}
export function toggleWidget(layout:Layout,id:WidgetId,enabled:boolean):Layout{
 if(!widgetCatalog.some(w=>w.id===id))return beginEdit(layout);
 return {version:1,widgets:enabled?layout.widgets.includes(id)?[...layout.widgets]:[...layout.widgets,id]:layout.widgets.filter(w=>w!==id)};
}
export function saveLayout(storage:Pick<Storage,'setItem'>,layout:Layout){storage.setItem(LAYOUT_KEY,JSON.stringify(parseLayout(JSON.stringify(layout))))}
export const FOCUS_KEY='rookstead.central.focus.v1';
export function loadFocus(storage:Pick<Storage,'getItem'>):{value:string;error?:string}{
 try{const raw=storage.getItem(FOCUS_KEY);if(raw===null)return{value:''};const value=JSON.parse(raw);if(typeof value!=='string'||value.length>4000)throw new Error('Invalid focus');return{value}}catch{return{value:'',error:'The saved focus note could not be read. Existing data has not been overwritten.'}}
}
export function saveFocus(storage:Pick<Storage,'setItem'>,value:string){if(value.length>4000)throw new Error('Focus note is too long.');storage.setItem(FOCUS_KEY,JSON.stringify(value))}
