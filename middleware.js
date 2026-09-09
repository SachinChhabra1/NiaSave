import {memberInvitation} from './lib/commerce/member-invitation.mjs';
export const config={runtime:'nodejs',matcher:'/:path*'};
export default function middleware(request){return memberInvitation(request);}
