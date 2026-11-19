import {useEffect,useLayoutEffect,useRef,useState,type PointerEvent as ReactPointerEvent} from 'react';
import {placeWidget,type Layout,type WidgetId} from './dashboard';
import {dragThresholdPassed,dropTarget,motionAllowed,packRows} from './grid';
export function useCardGrid(layout:Layout,editing:boolean,motion:boolean,change:(layout:Layout)=>void){
 const gridRef=useRef<HTMLDivElement>(null);const [columns,setColumns]=useState(12);const [draggingId,setDraggingId]=useState<WidgetId|null>(null);const [reduced,setReduced]=useState(()=>matchMedia('(prefers-reduced-motion: reduce)').matches);
 const positions=useRef(new Map<string,DOMRect>());const latest=useRef({layout,change,editing});latest.current={layout,change,editing};
 const pending=useRef<{id:WidgetId;x:number;y:number;pointerId:number;node:HTMLElement;ghost:HTMLElement|null;lastTarget:WidgetId|null;select:string}|null>(null);const suppressClick=useRef(false);
 function nodes(){return Array.from(gridRef.current?.querySelectorAll<HTMLElement>('[data-widget-id]')??[])}
 function capture(){positions.current=new Map(nodes().map(el=>[el.dataset.widgetId!,el.getBoundingClientRect()]))}
 useEffect(()=>{const query=matchMedia('(prefers-reduced-motion: reduce)');const update=()=>setReduced(query.matches);query.addEventListener('change',update);return()=>query.removeEventListener('change',update)},[]);
 useLayoutEffect(()=>{const grid=gridRef.current;if(!grid)return;const observer=new ResizeObserver(([entry])=>{const count=entry.contentRect.width<580?1:entry.contentRect.width<900?2:12;setColumns(old=>{if(old!==count)capture();return count})});observer.observe(grid);return()=>observer.disconnect()},[]);
 useLayoutEffect(()=>{
  const list=nodes();for(const el of list)for(const animation of el.getAnimations())animation.cancel();
  const after=new Map(list.map(el=>[el.dataset.widgetId!,el.getBoundingClientRect()]));
  if(motionAllowed(motion,reduced))for(const el of list){const id=el.dataset.widgetId!,before=positions.current.get(id),next=after.get(id)!;if(!before||id===pending.current?.id)continue;const dx=before.left-next.left,dy=before.top-next.top,sx=before.width/next.width,sy=before.height/next.height;if(Math.abs(dx)+Math.abs(dy)+Math.abs(sx-1)+Math.abs(sy-1)<.5)continue;el.animate([{transform:`translate(${dx}px,${dy}px) scale(${sx},${sy})`},{transform:'none'}],{duration:240,easing:'cubic-bezier(.2,.75,.25,1)',fill:'none'});}
  positions.current=after;
 },[layout.widgets.join('|'),columns,motion,reduced]);
 useEffect(()=>{
  function finish(){const drag=pending.current;if(!drag)return;if(drag.ghost){drag.ghost.remove();document.body.style.userSelect=drag.select;suppressClick.current=true;setTimeout(()=>{suppressClick.current=false},0)}pending.current=null;setDraggingId(null)}
  function move(event:PointerEvent){const drag=pending.current;if(!drag||event.pointerId!==drag.pointerId)return;
   if(!drag.ghost){if(!dragThresholdPassed(drag,{x:event.clientX,y:event.clientY}))return;const rect=drag.node.getBoundingClientRect();const ghost=drag.node.cloneNode(true) as HTMLElement;ghost.removeAttribute('data-widget-id');ghost.setAttribute('data-drag-preview','');ghost.setAttribute('aria-hidden','true');ghost.inert=true;ghost.querySelectorAll('[id]').forEach(el=>el.removeAttribute('id'));Object.assign(ghost.style,{position:'fixed',left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px',margin:'0',pointerEvents:'none',zIndex:'1000',transformOrigin:'top left'});document.body.append(ghost);drag.ghost=ghost;document.body.style.userSelect='none';getSelection()?.removeAllRanges();setDraggingId(drag.id)}
   event.preventDefault();drag.ghost.style.transform=`translate(${event.clientX-drag.x}px,${event.clientY-drag.y}px)`;
   const target=dropTarget(nodes().map(el=>{const rect=el.getBoundingClientRect();return{id:el.dataset.widgetId as WidgetId,left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom}}),event.clientX,event.clientY,drag.id);
   if(target&&target!==drag.lastTarget){capture();const next=placeWidget(latest.current.layout,drag.id,target);latest.current.layout=next;latest.current.change(next);drag.lastTarget=target}
  }
  if(editing){document.addEventListener('pointermove',move,{passive:false});document.addEventListener('pointerup',finish);document.addEventListener('pointercancel',finish)}
  return()=>{document.removeEventListener('pointermove',move);document.removeEventListener('pointerup',finish);document.removeEventListener('pointercancel',finish);finish()};
 },[editing]);
 function onPointerDown(id:WidgetId,event:ReactPointerEvent<HTMLElement>){if(!editing||event.button!==0||!event.isPrimary)return;const target=event.target as HTMLElement;if(target.closest('button,a,input,textarea,select,label,summary,details,[contenteditable="true"]')&&!target.closest('.drag-handle'))return;pending.current={id,x:event.clientX,y:event.clientY,pointerId:event.pointerId,node:event.currentTarget,ghost:null,lastTarget:null,select:document.body.style.userSelect}}
 return{gridRef,columns,packed:packRows(layout.widgets,columns),draggingId,capture,onPointerDown,onClickCapture:(event:React.MouseEvent)=>{if(suppressClick.current){event.preventDefault();event.stopPropagation()}}};
}
