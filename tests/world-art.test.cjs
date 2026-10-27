'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(process.env.THOMAS_HTML_SOURCE || path.join(__dirname,'..','thomas_the_tank_engine_island_of_sodor_adventure.html'),'utf8');
const shell=html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
test('standalone artwork has unique IDs and every local picture reference resolves',()=>{
 const ids=[...shell.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
 assert.equal(new Set(ids).size,ids.length);
 for(const m of shell.matchAll(/(?:href="#|url\(#)([\w-]+)/g))assert.ok(ids.includes(m[1]),m[1]);
 assert.doesNotMatch(shell,/<image\b|(?:src|href)="https?:|<link\b|@import/);
});
test('narration data precedes the browser adapter so recorded guidance is available at startup',()=>{
 const order=[...html.matchAll(/<script\b[^>]*id="([^"]+)"/g)].map(m=>m[1]);
 for(const id of ['narration-data','ui-narration-data','game-audio','game-core'])assert.ok(order.indexOf(id)<order.indexOf('game-runtime'),id);
});
