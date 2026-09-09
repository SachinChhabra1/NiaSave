// History links are supplied only by the fresh, signed Central passkey session.
// Never derive ownership from names, phone numbers or member request bodies.
export function memberOwnerIds(actor){
  return [...new Set([actor?.id,...(actor?.identitySource==='central-passkey'&&Array.isArray(actor.historyIds)?actor.historyIds:[])])].filter(id=>typeof id==='string'&&id.length>0);
}
export const ownsMemberRecord=(actor,id)=>memberOwnerIds(actor).includes(id);
