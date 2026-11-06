// Voice names and locales vary between browsers and operating systems.
export function preferredVoice(voices, sourceLanguage, localOnly=false){
 let best=null, bestScore=-1;
 for(const voice of voices){
  const locale=voice.lang.toLowerCase().replaceAll("_","-");
  if(localOnly && !voice.localService)continue;
  const mandarin=/^(?:cmn(?:-|$)|zh(?:$|-(?:cn|sg|tw|hans|hant)(?:-|$)))/.test(locale);
  if(sourceLanguage==="en"?!/^en(?:-|$)/.test(locale):!mandarin)continue;
  if(/cantonese|粤语|廣東話|yue/i.test(voice.name+" "+locale))continue;
  const quality=/natural|neural|premium|enhanced|wavenet/i.test(voice.name)?8:0;
  const regional=sourceLanguage==="zh" && /(?:cn|hans|sg)/.test(locale)?2:0;
  const score=quality+regional+(voice.default?1:0);
  if(score>bestScore){best=voice;bestScore=score}
 }
 return best;
}
