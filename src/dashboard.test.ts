import {test,expect} from 'bun:test';
import {defaultLayout,parseLayout,loadLayout,saveLayout,beginEdit,moveWidget,placeWidget,toggleWidget,LAYOUT_KEY,FOCUS_KEY,loadFocus,saveFocus} from './dashboard';
test('validates unique known widgets and preserves intentional empty layouts',()=>{
 expect(parseLayout(JSON.stringify(defaultLayout()))).toEqual(defaultLayout());
 expect(parseLayout('{"version":1,"widgets":[]}').widgets).toEqual([]);
 for(const widgets of [['unknown'],['focus','focus'],null])expect(()=>parseLayout(JSON.stringify({version:1,widgets}))).toThrow();
 expect(loadLayout({getItem:()=>'{broken'}).layout).toEqual(defaultLayout());
 expect(loadLayout({getItem:()=>null}).layout).toEqual(defaultLayout());
});

test('layout edits are drafts; moves are bounded and add/remove stays unique',()=>{
 const saved=defaultLayout();let draft=beginEdit(saved);
 draft=moveWidget(draft,'focus',-1);
 expect(draft.widgets[0]).toBe('focus');
 expect(saved).toEqual(defaultLayout());
 expect(moveWidget(draft,'focus',-100)).toEqual(draft);
 expect(moveWidget(draft,'unknown' as any,1)).toEqual(draft);
 draft=toggleWidget(draft,'calendar',true);draft=toggleWidget(draft,'calendar',true);
 expect(draft.widgets.filter(id=>id==='calendar').length).toBe(1);
 draft=toggleWidget(draft,'focus',false);expect(draft.widgets.includes('focus')).toBe(false);
 draft=placeWidget(draft,'calendar','summary');expect(draft.widgets[0]).toBe('calendar');
 expect(placeWidget(draft,'calendar','calendar')).toEqual(draft);
});
test('only explicit apply writes the layout, without changing other storage',()=>{
 const data=new Map([['apps','unchanged'],['files','untouched']]);
 const storage={getItem:(k:string)=>data.get(k)??null,setItem:(k:string,v:string)=>{data.set(k,v)}};
 let draft=toggleWidget(beginEdit(defaultLayout()),'focus',false);
 expect(data.has(LAYOUT_KEY)).toBe(false);
 draft=beginEdit(defaultLayout());expect(draft).toEqual(defaultLayout());
 saveLayout(storage,{version:1,widgets:[]});
 expect(loadLayout(storage).layout.widgets).toEqual([]);
 expect(data.get('apps')).toBe('unchanged');expect(data.get('files')).toBe('untouched');
 expect(()=>saveLayout({setItem:()=>{throw new Error('quota')}},draft)).toThrow();
});

 test('focus note survives layout changes and invalid or unavailable storage is reported',()=>{
 const map=new Map<string,string>();const storage={getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{map.set(k,v)}};
 expect(loadFocus(storage).value).toBe('');
 saveFocus(storage,'One clear priority');saveLayout(storage,{version:1,widgets:[]});expect(loadFocus(storage).value).toBe('One clear priority');
 expect(()=>saveFocus(storage,'x'.repeat(4001))).toThrow();
 map.set(FOCUS_KEY,'{bad');expect(loadFocus(storage).error).toBeTruthy();
 });
