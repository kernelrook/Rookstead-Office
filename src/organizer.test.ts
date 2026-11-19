import {expect,test} from 'bun:test';
import * as model from './organizer';

test('validates leap days and constructs the month grid across year boundaries',()=>{
 expect(model.validDay('2024-02-29')).toBe(true);
 for(const invalid of ['2100-02-29','2024-02-30','2024-2-01','0000-01-01','2024-00-15']) expect(model.validDay(invalid)).toBe(false);
 expect(model.shiftMonth('2026-12-15',1)).toBe('2027-01-01');
 expect(model.shiftMonth('2027-01-01',-1)).toBe('2026-12-01');
 const days=model.monthCells('2024-02-19');
 expect(days.slice(0,5)).toEqual([null,null,null,null,'2024-02-01']);
 expect(days.filter(Boolean).at(-1)).toBe('2024-02-29');
 expect(days.length%7).toBe(0);
});
test('today uses local calendar fields and date labels round-trip the entered day',()=>{
 const late=new Date(2026,10,19,23,45);
 expect(model.localDay(late)).toBe('2026-11-19');
 expect(model.localDay(model.dateForDay('2026-03-08'))).toBe('2026-03-08');
});

const task={id:'task-example',title:'Draft outline',done:false,due:'2026-11-19'};
function memory(){
 const items=new Map<string,string>();
 return {setItem:(key:string,value:string)=>{items.set(key,value)},getItem:(key:string)=>items.get(key)??null};
}
test('versioned collections are isolated and preserve other workspace keys',()=>{
 const store=memory();store.setItem('legacy-focus','existing focus');
 model.changeItems(store,'tasks',()=>[task]);
 model.changeItems(store,'notes',()=>[{id:'note-example',title:'Outline',body:'A separate note'}]);
 model.changeItems(store,'events',()=>[{id:'event-example',title:'Review',day:'2026-11-19'}]);
 expect(model.loadItems(store,'tasks')).toEqual([task]);
 expect(JSON.parse(store.getItem(model.organizerKeys.tasks)!).version).toBe(1);
 expect(model.loadItems(store,'events')[0].day).toBe(task.due);
 expect(store.getItem('legacy-focus')).toBe('existing focus');
});
test('rejected invalid and future state is never overwritten',()=>{
 const store=memory();const key=model.organizerKeys.tasks;
 for(const value of ['{',JSON.stringify({version:2,items:[]}),JSON.stringify({version:1,items:[task,task]}),JSON.stringify({version:1,items:[{...task,due:'2026-11-31'}]})]){
  store.setItem(key,value);
  expect(()=>model.changeItems(store,'tasks',()=>[])).toThrow();
  expect(store.getItem(key)).toBe(value);
 }
});
test('invalid output and blocked writes do not create a saved result',()=>{
 const store=memory();
 expect(()=>model.changeItems(store,'notes',()=>[{id:'ok',title:'',body:'text'}])).toThrow();
 expect(store.getItem(model.organizerKeys.notes)).toBeNull();
 const blocked={...store,setItem:()=>{throw new Error('quota')}};
 expect(()=>model.changeItems(blocked,'tasks',()=>[task])).toThrow();
 expect(model.loadItems(store,'tasks')).toEqual([]);
});

test('projects respect status and dates; only explicitly linked tasks contribute to progress',()=>{
 const store=memory();
 const project={id:'project-example',title:'Plan',description:'Local project',status:'Planned' as const,due:'2027-01-02'};
 expect(model.changeItems(store,'projects',()=>[project])).toEqual([project]);
 expect(()=>model.changeItems(store,'projects',()=>[{...project,status:'Invalid'} as never])).toThrow();
 model.changeItems(store,'tasks',()=>[task,{...task,id:'linked',projectId:project.id,done:true}]);
 expect(model.projectProgress(model.loadItems(store,'tasks'),project.id)).toEqual({done:1,total:1});
 expect(()=>model.removeProject(store,project.id)).toThrow('Unlink');
 model.changeItems(store,'tasks',tasks=>model.updateItem(tasks,'linked',t=>({...t,projectId:null})));
 expect(model.removeProject(store,project.id)).toEqual([]);
 expect(model.loadItems(store,'tasks')).toHaveLength(2);
});
