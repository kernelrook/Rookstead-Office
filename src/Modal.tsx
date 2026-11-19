import {useEffect,useRef,type ReactNode} from 'react';
export function Modal({title,close,children,className=''}:{title:string;close:()=>void;children:ReactNode;className?:string}) {
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const dialog=ref.current!;const opener=document.activeElement;dialog.showModal();return ()=>{dialog.close();queueMicrotask(()=>{if(opener instanceof HTMLElement&&opener.isConnected)opener.focus()})}},[]);
 return <dialog ref={ref} className={className} aria-label={title} onCancel={e=>{e.preventDefault();close()}} onClick={e=>{if(e.target===e.currentTarget){const r=e.currentTarget.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close()}}}><div className="modal-header"><h2>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={close}>×</button></div>{children}</dialog>;
}
