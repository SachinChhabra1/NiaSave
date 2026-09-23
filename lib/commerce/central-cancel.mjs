import {CommerceError} from './core.mjs';

const fail=(code='invalid_cancel_request',status=400)=>{throw new CommerceError(code,status);};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const keyPattern=/^[a-zA-Z0-9_-]{16,100}$/;

/** Central changes the order and releases its hold in one revision-checked transaction. */
export async function cancelFromCentral(central,subject,body,idempotencyKey){
  if(!uuid.test(body?.orderId||'')||!Number.isInteger(body.expectedRevision)||
    body.expectedRevision<1||!keyPattern.test(idempotencyKey||''))fail();
  const request={orderId:body.orderId,expectedRevision:body.expectedRevision,idempotencyKey};
  try{return await central.centralMemberRequest('save.cancel',subject,request);}
  catch{
    try{
      const replay=await central.centralMemberRequest('save.retryStatus',subject,{idempotencyKey});
      if(replay.status===200&&replay.body?.committed===true&&
        replay.body?.kind==='save.cancel')return {status:replay.body.resultStatus,
          body:replay.body.result};
    }catch{}
    fail('service_unavailable',503);
  }
}
