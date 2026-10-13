// Call only after verifying the existing staff session. This grants no other desk.
export function canAccessSaveStaff(staff,env=process.env){
  if(!staff||typeof staff.email!=='string')return false;
  if(staff.role==='admin')return true;
  const email=staff.email.trim().toLowerCase();
  if(!email)return false;
  const allowed=String(env.NIASAVE_SAVE_OPERATOR_EMAILS||'').split(/[,;\s]+/).map(value=>value.trim().toLowerCase()).filter(Boolean);
  return allowed.includes(email);
}
