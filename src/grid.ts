import {widgetCatalog,type WidgetId} from './dashboard';
export type PackedWidget={id:WidgetId;span:number;row:number};
export function packRows(ids:WidgetId[],columns:number):PackedWidget[]{
 const result:PackedWidget[]=[];let row: {id:WidgetId;weight:number}[]=[];let total=0;let rowIndex=0;
 function flush(){if(!row.length)return;const sizes=row.map(w=>Math.floor(w.weight/total*columns));let remaining=columns-sizes.reduce((a,b)=>a+b,0);const fractions=row.map((w,i)=>({i,f:w.weight/total*columns-sizes[i]})).sort((a,b)=>b.f-a.f||a.i-b.i);for(let i=0;i<remaining;i++)sizes[fractions[i].i]++;row.forEach((w,i)=>result.push({id:w.id,span:sizes[i],row:rowIndex}));row=[];total=0;rowIndex++;}
 for(const id of ids){const weight=columns===12?(widgetCatalog.find(w=>w.id===id)?.span??12):id==='summary'?columns:1;if(total+weight>columns)flush();row.push({id,weight});total+=weight;if(total===columns)flush()}
 flush();return result;
}
export function dragThresholdPassed(start:{x:number;y:number},point:{x:number;y:number}):boolean{return Math.hypot(point.x-start.x,point.y-start.y)>=7}
export function motionAllowed(enabled:boolean,reduced:boolean){return enabled&&!reduced}
export function dropTarget(boxes:{id:WidgetId;left:number;top:number;right:number;bottom:number}[],x:number,y:number,source:WidgetId):WidgetId|null{return boxes.find(b=>b.id!==source&&x>=b.left&&x<=b.right&&y>=b.top&&y<=b.bottom)?.id??null}
