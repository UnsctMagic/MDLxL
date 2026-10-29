export function openOptimizeXLWindow(hostWindow = window) {
  const child = hostWindow.open('about:blank', 'MDLxL-OptimizeXL', 'popup=yes,width=1280,height=800');
  child?.focus();
  return child;
}
