# NiaSave API

Base: https://niasave-api.vercel.app

## Staff auth
POST /v1/staff/login { email, password } -> { token, staff }
GET /v1/staff/me  Authorization: Bearer <token>
POST /v1/staff/logout
All other /v1/staff/* require Bearer.

Seed (demo password SaveDesk#29Aug):
- admin@nia.one admin
- satish@nia.one studio+hub
- ramesh@nia.one hub
- kavita@nia.one money
- pilot@nia.one pilot

Two different staff ids must sign hub count before cart leave.
