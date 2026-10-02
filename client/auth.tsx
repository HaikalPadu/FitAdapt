import {createRoot, type Root} from 'react-dom/client';
import {type AuthFormSplitScreenProps} from '../components/ui/login';
import {Component} from '../components/ui/sign-in-card-2';
let root:Root|undefined;
export function mountAuth(container:HTMLElement,props:AuthFormSplitScreenProps){unmountAuth();root=createRoot(container);root.render(<Component {...props}/>);}
export function unmountAuth(){root?.unmount();root=undefined;}
