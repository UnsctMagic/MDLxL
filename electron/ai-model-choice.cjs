// Conservative local routing: uncertainty stays with the chosen model.
function simpleJob(text, images = []) {
  if (images.length) return false;
  const value=String(text).trim().replace(/^(?:ask\s+)?[A-Za-z]+(?:[:,]|\s+to\b)\s*/i,'');
  if (/\b(shape|spatial|bind|binding|deform|retarget|animate|animation feel|pose|sculpt|smooth|fit|improve|design|create|repair|fix|beautiful|natural|realistic|suggest|recommend)\b/i.test(value)) return false;
  const parts=value.split(/\s*(?:;|\n|\band then\b)\s*/).filter(Boolean);
  return parts.length>0 && parts.every(part=>
    /^(?:read|list|count|report|show)\s+(?:(?:all|the|current|selected)\s+)?(?:names?|bones?|nodes?|geosets?|materials?|textures?|sequences?|flags?|values?|counts?|metadata|diagnostics|selection)\b[^?]*[.?]?$/i.test(part) ||
    /^rename\s+.+\s+to\s+(?:"[^"\n]+"|'[^'\n]+'|[\w .-]+)[.]?$/i.test(part) ||
    /^(?:set|change|recolou?r)\s+.+\s+(?:to|=)\s*(?:[-+]?\d+(?:\.\d+)?(?:\s*[, ]\s*[-+]?\d+(?:\.\d+)?)*|true|false|on|off|#[0-9a-f]{6}|red|green|blue|black|white|yellow|transparent)[.]?$/i.test(part) ||
    /^(?:set|change)\s+.+\b(?:visibility|visible|hidden)\b.+\b(?:from|between)\s+\d+\s+(?:to|and)\s+\d+[.]?$/i.test(part)
  );
}
function lighterModels(models, chosen) {
  const tier=id=>/nano|haiku/i.test(id)?1:/mini|luna/i.test(id)?2:3;
  const rank=tier(chosen||'');
  return (models||[]).filter(m=>m.id!==chosen && tier(m.id)<rank).sort((a,b)=>tier(a.id)-tier(b.id));
}
module.exports={simpleJob,lighterModels};
