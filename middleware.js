import {memberInvitation} from './lib/commerce/member-invitation.mjs';
import {staffPageAccess} from './lib/staff-pages.mjs';
export const config={runtime:'nodejs',matcher:'/:path*'};
export default async function middleware(request){return memberInvitation(request)||await staffPageAccess(request);}
