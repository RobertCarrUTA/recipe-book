import * as DialogPrimitive from '@radix-ui/react-dialog';
import {X} from 'lucide-react';
import {useId, useRef, type ReactNode, type KeyboardEventHandler} from 'react';

export function Dialog({open,onClose,title,description,children,className='',footer,onKeyDown}:{open:boolean;onClose:()=>void;title:string;description?:string;children:ReactNode;className?:string;footer?:ReactNode;onKeyDown?:KeyboardEventHandler<HTMLDivElement>}){
  const descriptionId=useId();
  const opener=useRef<HTMLElement|null>(null);
  return <DialogPrimitive.Root open={open} onOpenChange={next=>{if(!next)onClose();}}><DialogPrimitive.Portal><DialogPrimitive.Overlay className="dialog-overlay"/><DialogPrimitive.Content className={`dialog ${className}`} aria-describedby={description?descriptionId:undefined} onKeyDown={onKeyDown} onOpenAutoFocus={()=>{opener.current=document.activeElement instanceof HTMLElement ? document.activeElement : null;}} onCloseAutoFocus={event=>{if(opener.current?.isConnected){event.preventDefault();opener.current.focus({preventScroll:true});}}}>
    <header className="dialog-heading"><div><DialogPrimitive.Title>{title}</DialogPrimitive.Title>{description&&<DialogPrimitive.Description id={descriptionId}>{description}</DialogPrimitive.Description>}</div><DialogPrimitive.Close className="icon-button" aria-label="Close dialog"><X size={20}/></DialogPrimitive.Close></header>
    <div className="dialog-body">{children}</div>{footer&&<footer className="dialog-footer">{footer}</footer>}
  </DialogPrimitive.Content></DialogPrimitive.Portal></DialogPrimitive.Root>;
}
export function ConfirmDialog({open,onClose,onConfirm,title,description,confirmLabel='Confirm',children}:{open:boolean;onClose:()=>void;onConfirm:()=>void;title:string;description:string;confirmLabel?:string;children?:ReactNode}){
  return <Dialog open={open} onClose={onClose} title={title} description={description} footer={<><button className="button" onClick={onClose} autoFocus>Cancel</button><button className="button danger" onClick={()=>{onConfirm();onClose();}}>{confirmLabel}</button></>}>{children}</Dialog>;
}
