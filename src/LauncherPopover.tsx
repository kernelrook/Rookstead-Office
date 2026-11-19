import {useLayoutEffect, useRef, type ReactNode} from 'react';
import './launcher-popover.css';

export function LauncherPopover({children, close}: {children: ReactNode; close: () => void}) {
 const ref = useRef<HTMLDivElement>(null);
 const closeRef = useRef(close);
 closeRef.current = close;
 useLayoutEffect(() => {
  const panel = ref.current!;
  const anchor = document.getElementById('app-launcher-trigger')!;
  const viewport = window.visualViewport;
  function position() {
   const rect = anchor.getBoundingClientRect();
   const left = viewport?.offsetLeft ?? 0;
   const top = viewport?.offsetTop ?? 0;
   const width = viewport?.width ?? innerWidth;
   const bottom = top + (viewport?.height ?? innerHeight);
   const start = Math.max(top + 8, rect.bottom + 8);
   panel.style.width = `${Math.min(364, width - 16)}px`;
   panel.style.left = `${Math.max(left + 8, Math.min(rect.left, left + width - panel.offsetWidth - 8))}px`;
   panel.style.top = `${start}px`;
   panel.style.maxHeight = `${Math.max(0, bottom - start - 8)}px`;
  }
  function outside(event: Event) {
   const target = event.target;
   if (target instanceof Node && !panel.contains(target) && !anchor.contains(target)) closeRef.current();
  }
  function escape(event: KeyboardEvent) {
   if (event.key === 'Escape' && !document.querySelector('dialog[open]')) {
    event.preventDefault(); anchor.focus({preventScroll:true}); closeRef.current();
   }
  }
  position();
  panel.querySelector('input')?.focus({preventScroll:true});
  document.addEventListener('pointerdown', outside);
  document.addEventListener('focusin', outside);
  document.addEventListener('keydown', escape);
  window.addEventListener('resize', position);
  window.addEventListener('scroll', position, {capture:true,passive:true});
  viewport?.addEventListener('resize',position);
  viewport?.addEventListener('scroll',position);
  return () => {
   document.removeEventListener('pointerdown', outside);
   document.removeEventListener('focusin', outside);
   document.removeEventListener('keydown', escape);
   window.removeEventListener('resize', position);
   window.removeEventListener('scroll', position, true);
   viewport?.removeEventListener('resize',position);
   viewport?.removeEventListener('scroll',position);
  };
 }, []);
 return <div id="app-launcher-popover" ref={ref} className="launcher-popover" role="region" aria-label="App launcher">{children}</div>;
}
