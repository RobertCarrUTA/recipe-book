import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
for(const file of ['data/recipes.json','icons/icon.svg','manifest.webmanifest','LICENSE.md','NOTICE']){
  const destination=path.join(root,'public',file);
  await fs.mkdir(path.dirname(destination),{recursive:true});
  await fs.copyFile(path.join(root,file),destination);
}
