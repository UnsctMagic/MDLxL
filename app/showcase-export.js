export function showcaseExportPreferences(preferences,target){
  return {...preferences,capture:{...preferences?.capture,fps:target?30:preferences?.capture?.fps||30,recordingQuality:preferences?.capture?.recordingQuality||'high'}};
}
