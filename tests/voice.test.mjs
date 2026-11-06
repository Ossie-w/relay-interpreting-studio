import test from "node:test";
import assert from "node:assert/strict";
import {preferredVoice} from "../dist/voice.js";
test("prefer a higher-quality voice in the source language, with an offline fallback",()=>{
 const installed={lang:"en-US",name:"Desktop",localService:true,default:true};
 const natural={lang:"en-GB",name:"Natural",localService:false};
 const voices=[installed,{lang:"fr-FR",name:"Premium"},natural];
 assert.equal(preferredVoice(voices,"en"),natural);
 assert.equal(preferredVoice(voices,"en",true),installed);
});
test("choose Mandarin even when Cantonese appears first in the voice list",()=>{
 const cantonese={lang:"zh-HK",name:"Natural"};
 const mandarin={lang:"cmn-Hans-CN",name:"普通话"};
 assert.equal(preferredVoice([cantonese,mandarin],"zh"),mandarin);
 assert.equal(preferredVoice([cantonese],"zh"),null);
});
