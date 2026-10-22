import {readFile,readdir} from 'node:fs/promises';
import vm from 'node:vm';
const html=await readFile(new URL('./public/index.html',import.meta.url),'utf8');
const js=html.match(/<script>([\s\S]*?)<\/script>/)[1];
new vm.Script(js);
for(const file of await readdir(new URL('./public/',import.meta.url)))if(/\.(mp3|zip|wav|flac)$/i.test(file))throw new Error('Audiodatei im Veröffentlichungsordner: '+file);
console.log('PASS: Browser-JavaScript syntaktisch gültig; keine Audioarchive in public.');
