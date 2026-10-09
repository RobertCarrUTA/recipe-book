import {createRoot} from 'react-dom/client';
import {AppProvider,createAppStore} from './store';
import {App} from './App';
import './styles.css';
const store=createAppStore();
const root=createRoot(document.getElementById('root')!);
root.render(<AppProvider store={store}><App/></AppProvider>);
void store.loadRecipes();
if(import.meta.hot)import.meta.hot.dispose(()=>{root.unmount();store.dispose();});
