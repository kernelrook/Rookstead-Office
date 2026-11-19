import {test,expect} from 'bun:test';
import {packRows,dragThresholdPassed,motionAllowed,dropTarget} from './grid';
import {defaultLayout} from './dashboard';
test('packs mixed cards in order and fills every row including the last',()=>{
 for(const columns of [1,2,12]){
  for(const ids of [defaultLayout().widgets,['focus','files','activity'],['summary','recent','workspace','pinned','calendar'],[]] as any[]){
   const packed=packRows(ids,columns);expect(packed.map(w=>w.id)).toEqual(ids);
   for(const row of new Set(packed.map(w=>w.row)))expect(packed.filter(w=>w.row===row).reduce((sum,w)=>sum+w.span,0)).toBe(columns);
   expect(packed.every(w=>w.span>0&&Number.isInteger(w.span))).toBe(true);
  }
 }
});
test('requires deliberate movement and reduced motion always wins',()=>{
 expect(dragThresholdPassed({x:0,y:0},{x:3,y:4})).toBe(false);expect(dragThresholdPassed({x:0,y:0},{x:9,y:0})).toBe(true);
 expect(motionAllowed(true,false)).toBe(true);expect(motionAllowed(true,true)).toBe(false);expect(motionAllowed(false,false)).toBe(false);
});
test('finds a different target under the pointer without inventing targets in empty space',()=>{
 const boxes=[{id:'focus',left:0,top:0,right:100,bottom:100},{id:'recent',left:110,top:0,right:210,bottom:100}] as any;
 expect(dropTarget(boxes,50,50,'focus')).toBe(null);expect(dropTarget(boxes,150,50,'focus')).toBe('recent');expect(dropTarget(boxes,105,50,'focus')).toBe(null);
});
