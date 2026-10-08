import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({root:'frontend',base:process.env.RECIPE_BOOK_BASE||'/',publicDir:'../public',plugins:[react()],build:{outDir:'../dist',emptyOutDir:true,sourcemap:false},server:{host:'127.0.0.1'},preview:{host:'127.0.0.1'}});
