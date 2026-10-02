const {buildSync}=require('esbuild');
const {execFileSync}=require('node:child_process');
const path=require('node:path');
buildSync({entryPoints:['client/auth.tsx'],bundle:true,minify:true,format:'esm',outfile:'public/js/auth.js',target:'es2022',define:{'process.env.NODE_ENV':'"production"'}});
execFileSync(process.execPath,[path.join(path.dirname(require.resolve('@tailwindcss/cli/package.json')),'dist/index.mjs'),'-i','client/auth.css','-o','public/css/auth.css','--minify'],{stdio:'inherit'});
