// Presentation only. The catalogue read was already validated against Central on the server.
export function memberShellState({online,readAsOf,readAt,readFailed=false,pendingCount=0,sourceOwner,signedIn,now=Date.now()}={}){
  if(!online)return pendingCount>0?'queued':'offline';
  if(pendingCount>0)return 'retry';
  // Public Nia catalogues intentionally withhold member inventory and its source clock.
  if(sourceOwner==='niasave'&&signedIn===false&&Number.isFinite(readAt)){
    if(readFailed||readAt>now||now-readAt>60000)return 'stale';
    return 'signin';
  }
  const asOf=Date.parse(readAsOf||'');
  if(!Number.isFinite(asOf)||!Number.isFinite(readAt))return 'checking';
  if(readFailed||readAt>now||now-readAt>60000)return 'stale';
  return 'synced';
}

const paths={
  live:'<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/>',
  earn:'<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M2 12a20 20 0 0 0 20 0M12 12v2"/>',
  shop:'<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18M16 10a4 4 0 0 1-8 0"/>',
  send:'<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>'
};
export function lessNavIcon(name){
  const shape=paths[name];
  return shape?'<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+shape+'</svg>':'';
}
