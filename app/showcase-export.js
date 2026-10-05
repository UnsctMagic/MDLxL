export const LOW_SIZE_DURATION_ERROR='Low Size GIF previews cannot be longer than 5 seconds.';
export function validateShowcaseExport(target,length,playlist=[]){
  if((target==='low-size'||target==='low-size-main')&&(Number(length)>5||playlist.some(row=>Number(row.seconds)>5)||playlist.reduce((sum,row)=>sum+(Number(row.seconds)||0),0)>5))throw Error(LOW_SIZE_DURATION_ERROR);
}
export function showcaseExportPreferences(preferences,target){
  return {...preferences,capture:{...preferences?.capture,fps:target?30:preferences?.capture?.fps||30,recordingQuality:preferences?.capture?.recordingQuality||'high'}};
}
