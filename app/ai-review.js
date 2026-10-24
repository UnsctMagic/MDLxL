import {encodeAiValue,decodeAiValue,ignoreAiAlias,pointer} from '../src/ai-model.js';
import {createChanges} from '../src/history-store.js';
import {prepareModelSaveAsync} from './model-save.js';

export async function aiCheckpoint(bridge,id,{includeBaseline=false,baseline,restore,restoreReview}={}) {
  const target=bridge.requireTarget(id);
  if(restore) {
    const state=bridge.state();
    if(state.session.paintProject?.dirty||Object.keys(state.session.uvPreviews||{}).length||Object.keys(state.session.animationDrafts||{}).length)throw Error('Apply or cancel the current preview before resuming this task.');
    await bridge.host().restoreContext(restore);bridge.advance(id,true);
  }
  if(baseline)target.review={before:decodeAiValue(baseline),changed:restoreReview?.changed===true,phase:restoreReview?.changed?'pending':'unchanged',changes:restoreReview?.changes||[],animation:!!restoreReview?.animation};
  const state=bridge.state();
  const bytes=(await prepareModelSaveAsync(state.doc,'mdx')).bytes;
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  bridge.requireTarget(id);
  return {fingerprint:Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join(''),path:state.session.path||null,name:state.doc.name,
    context:bridge.context(id),review:reviewStatus(target.review),...(includeBaseline&&target.review?{baseline:encodeAiValue(target.review.before)}:{})};
}
export const reviewStatus=review=>({changed:!!review?.changed,phase:review?.phase||'unchanged',changes:review?.changes||[],animation:!!review?.animation,summary:review?.summary||''});
export async function beginAiReview(bridge,id,options) {
  const target=bridge.requireTarget(id);
  if(target.review)return target.review;
  const before=structuredClone(bridge.state().model);
  const image=(await bridge.dispatch('mdlxl_capture',{target:id},options)).image;
  bridge.requireTarget(id);
  return target.review={before,image,changed:false,phase:'unchanged',changes:[],animation:false};
}
const containsTrack=value=>value&&typeof value==='object'&&!ArrayBuffer.isView(value)&&(Array.isArray(value.Keys)||Object.values(value).some(containsTrack));
export function recordAiChange(review,result,model) {
  review.changed=true;review.phase='pending';delete review.inspectedRevision;delete review.summary;
  const changes=createChanges(review.before,model,{ignore:ignoreAiAlias});
  review.changes=changes.slice(0,100).map(c=>({path:pointer(c.path),kind:c.kind}));
  review.animation ||= changes.some(c=>/\/(?:Sequences|GlobalSequences)(?:\/|$)|\/Keys(?:\/|$)/.test(pointer(c.path))||containsTrack(c.before)||containsTrack(c.after));
}
export async function reviewAiModel(bridge,args,options) {
  const target=bridge.requireTarget(args.target),review=target.review;
  if(args.action==='status')return reviewStatus(review);
  if(!review?.changed)return {changed:false,phase:'unchanged'};
  if(args.action==='finish') {
    if(typeof args.summary!=='string'||!args.summary.trim())throw Error('Explain the review result.');
    if(args.outcome==='passed'&&(review.phase!=='inspected'||review.inspectedRevision!==bridge.state().doc.revision||!review.passed))throw Error('Inspect and pass the current model checks and images before completing the task.');
    review.phase=args.outcome==='passed'?'verified':args.outcome==='needs-correction'?'correcting':'blocked';review.summary=args.summary;
    return reviewStatus(review);
  }
  if(args.action!=='inspect')throw Error('Unknown review action.');
  if(typeof args.checksCode!=='string'||!args.checksCode.trim())throw Error('Provide read-only checksCode returning [{name,passed,actual?,expected?}] for the requested result. The original model is available as before.');
  const revision=bridge.state().doc.revision,state=bridge.state();
  const tested=await window.desktop.aiScript({requestId:options.requestId,code:args.checksCode,model:structuredClone(state.model),before:structuredClone(review.before),selection:structuredClone(target.selection),context:bridge.contextFor(args.target),references:{}});
  bridge.requireTarget(args.target);
  if(createChanges(state.model,tested.model,{ignore:ignoreAiAlias}).length||createChanges(review.before,tested.before,{ignore:ignoreAiAlias}).length)throw Error('Verification code must inspect model and before without changing either. Use an edit tool to correct the result, then inspect again.');
  const checks=encodeAiValue(tested.value);
  if(!Array.isArray(checks)||!checks.length||checks.length>100||checks.some(c=>!c||typeof c.name!=='string'||!c.name.trim()||typeof c.passed!=='boolean'))throw Error('Verification must return 1–100 named checks with boolean passed results.');
  const validation=await bridge.dispatch('mdlxl_document',{target:args.target,action:'validate'},options);
  const images=[],poses=[];
  if(review.image)images.push({label:'Before the task',image:review.image});
  images.push({label:'After the edit',image:(await bridge.dispatch('mdlxl_capture',{target:args.target},options)).image});
  if(review.animation) {
    const interval=state.globalSeqId==null?state.model.Sequences[state.sequence]?.Interval:[0,state.model.GlobalSequences[state.globalSeqId]];
    const samples=args.frames|| (interval?[interval[0],(interval[0]+interval[1])/2,interval[1]]:[]);
    if(new Set(samples).size<3)throw Error('Animation verification needs at least three distinct frames. Select the edited sequence and provide frames.');
    poses.push(await bridge.dispatch('mdlxl_sample',{target:args.target,frames:samples},options));
    try {
      for(const frame of samples) {
        await bridge.dispatch('mdlxl_view',{target:args.target,frame,playing:false},options);
        images.push({label:`After; animation frame ${frame}`,image:(await bridge.dispatch('mdlxl_capture',{target:args.target},options)).image});
      }
    } finally {
      bridge.requireTarget(args.target);
      await bridge.dispatch('mdlxl_view',{target:args.target,frame:state.time,playing:state.playing},options);
    }
  }
  bridge.requireTarget(args.target);
  const current=bridge.state();
  const drafts=!!current.session.paintProject?.dirty||Object.keys(current.session.uvPreviews||{}).length>0||Object.keys(current.session.animationDrafts||{}).length>0;
  const structural=validation.results.every(r=>!r.error&&!r.readOnly&&!r.diagnostics?.some(d=>d.severity==='error'));
  review.passed=checks.every(c=>c.passed)&&structural&&!drafts&&current.doc.revision===revision;
  review.phase='inspected';review.inspectedRevision=revision;
  return {review:{...reviewStatus(review),passed:review.passed,checks,validation,poses,pendingPreviews:!!drafts,next:'Inspect the images. Correct failures, or call mdlxl_review finish with outcome passed and a short visual assessment. Structural checks do not prove appearance.'},images};
}
