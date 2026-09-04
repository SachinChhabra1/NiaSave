export const navItems = [
  ['overview', 'Overview'],
  ['campaigns', 'Campaigns'],
  ['accounts', 'Accounts'],
  ['pipeline', 'Pipeline'],
  ['resources', 'BD team'],
  ['studios', 'Studios'],
  ['activations', 'Activations'],
  ['insights', 'Insights & reports'],
]

export const executives = [
  { id: 'r1', name: 'Arjun Rao', initials: 'AR', territory: 'Hosur', targeted: 980, engaged: 152, qualified: 48, contracted: 120, live: 86, medianDays: 29, overdue: 2, forecastAccuracy: 91, activeAccounts: 14 },
  { id: 'r2', name: 'Priya Rao', initials: 'PR', territory: 'Pune', targeted: 860, engaged: 112, qualified: 36, contracted: 96, live: 58, medianDays: 37, overdue: 4, forecastAccuracy: 84, activeAccounts: 11 },
  { id: 'r3', name: 'Ananya Mehta', initials: 'AM', territory: 'NCR', targeted: 1050, engaged: 138, qualified: 44, contracted: 80, live: 0, medianDays: 42, overdue: 3, forecastAccuracy: 76, activeAccounts: 16 },
  { id: 'r4', name: 'Rohit Kapur', initials: 'RK', territory: 'Oragadam', targeted: 780, engaged: 124, qualified: 39, contracted: 72, live: 0, medianDays: 39, overdue: 1, forecastAccuracy: 88, activeAccounts: 9 },
  { id: 'r5', name: 'Vikram Sen', initials: 'VS', territory: 'Hosur', targeted: 710, engaged: 86, qualified: 17, contracted: 64, live: 0, medianDays: 51, overdue: 5, forecastAccuracy: 69, activeAccounts: 8 },
]

export const stageOrder = [
  'Discovery',
  'Demand diagnosed',
  'Solution fit',
  'Proposal',
  'Commercial',
  'Contracted',
  'Studio allocated',
  'Mobilisation',
  'Live',
]

export const initialCampaigns = [
  { id: 'c1', name: 'Auto corridor retention', studio: 'Hosur', audience: 'Auto & components', status: 'Live', contacts: 740, engaged: 116, qualified: 38, contracted: 120, live: 86, owner: 'Arjun Rao', start: '12 Aug 2026' },
  { id: 'c2', name: 'Chakan workforce stability', studio: 'Pune', audience: 'Manufacturing HR', status: 'Live', contacts: 1120, engaged: 158, qualified: 44, contracted: 96, live: 58, owner: 'Priya Rao', start: '18 Aug 2026' },
  { id: 'c3', name: 'Oragadam capacity launch', studio: 'Oragadam', audience: 'Plant leadership', status: 'Scheduled', contacts: 860, engaged: 0, qualified: 0, contracted: 0, live: 0, owner: 'Rohit Kapur', start: '09 Sep 2026' },
  { id: 'c4', name: 'NCR logistics operators', studio: 'NCR', audience: 'Logistics & 3PL', status: 'Completed', contacts: 1660, engaged: 338, qualified: 102, contracted: 270, live: 198, owner: 'Ananya Mehta', start: '02 Jul 2026' },
]

export const initialStudios = [
  { id: 's1', name: 'Oragadam', corridor: 'Coromandel', capacity: 610, live: 312, contracted: 148, pipeline: 312, gap: 88, coverage: 76 },
  { id: 's2', name: 'Hosur', corridor: 'Wellington', capacity: 480, live: 286, contracted: 120, pipeline: 256, gap: 64, coverage: 72 },
  { id: 's3', name: 'Pune', corridor: 'Deccan', capacity: 520, live: 278, contracted: 102, pipeline: 232, gap: 70, coverage: 70 },
  { id: 's4', name: 'NCR', corridor: 'Rajputana', capacity: 560, live: 276, contracted: 116, pipeline: 340, gap: 64, coverage: 71 },
]

export const initialAccounts = [
  { id: 'a1', name: 'Apex Mobility', segment: 'Automotive', studio: 'Hosur', contacts: 5, relationship: 'Champion', demand: 120, lastTouch: 'Today, 11:32' },
  { id: 'a2', name: 'Northstar Components', segment: 'Auto components', studio: 'Pune', contacts: 4, relationship: 'Active', demand: 96, lastTouch: 'Yesterday' },
  { id: 'a3', name: 'Meridian Services', segment: 'Business services', studio: 'NCR', contacts: 7, relationship: 'Developing', demand: 80, lastTouch: '2 days ago' },
  { id: 'a4', name: 'Vector Engineering', segment: 'Industrial manufacturing', studio: 'Oragadam', contacts: 3, relationship: 'Active', demand: 72, lastTouch: 'Today, 09:14' },
  { id: 'a5', name: 'Keystone Logistics', segment: 'Logistics & 3PL', studio: 'Hosur', contacts: 6, relationship: 'Developing', demand: 64, lastTouch: '4 days ago' },
  { id: 'a6', name: 'BluePeak Electronics', segment: 'Electronics', studio: 'Oragadam', contacts: 4, relationship: 'New', demand: 150, lastTouch: '6 days ago' },
]

export const initialOpportunities = [
  {
    id: 'o1', accountId: 'a1', account: 'Apex Mobility', studio: 'Hosur', campaign: 'Auto corridor retention', stage: 'Mobilisation', committed: 120, live: 86, days: 18, nextAction: 'Submit final member list', due: '04 Sep', owner: 'Arjun Rao', probability: 90, value: 960000,
    qualified: { problem: 'New line ramp-up and early worker attrition', profile: 'Assembly operators', requiredDate: '15 Sep 2026', decisionMaker: 'VP People Operations', process: 'HR → Plant Head → Procurement' },
    events: [
      ['Member list draft shared', 'Today, 11:32', 'Draft cohort list received from enterprise HR.'],
      ['Allocation confirmed', '01 Sep, 16:18', 'Hosur slots allocated across two arrival batches.'],
      ['Contract signed', '24 Aug, 14:40', 'Commercial commitment recorded with 120 members.'],
      ['Qualified', '12 Aug, 10:05', 'Need, timing, location and authority confirmed.'],
      ['Campaign launched', '04 Aug, 09:15', 'Account enrolled in Auto corridor retention.'],
    ],
  },
  {
    id: 'o2', accountId: 'a2', account: 'Northstar Components', studio: 'Pune', campaign: 'Chakan workforce stability', stage: 'Contracted', committed: 96, live: 58, days: 26, nextAction: 'Sign mobilisation SOW', due: '05 Sep', owner: 'Priya Rao', probability: 85, value: 768000,
    qualified: { problem: 'Recurring replacement demand', profile: 'Machine operators', requiredDate: '22 Sep 2026', decisionMaker: 'CHRO', process: 'CHRO → CFO' },
    events: [['Contract signed', '27 Aug, 13:20', 'Annual commercial terms agreed.'], ['Proposal accepted', '21 Aug, 15:42', 'Dedicated capacity model selected.'], ['Qualified', '15 Aug, 12:10', 'Demand diagnosed.']],
  },
  {
    id: 'o3', accountId: 'a3', account: 'Meridian Services', studio: 'NCR', campaign: 'NCR logistics operators', stage: 'Demand diagnosed', committed: 80, live: 0, days: 17, nextAction: 'Share proposal v2', due: '06 Sep', owner: 'Ananya Mehta', probability: 40, value: 640000,
    qualified: { problem: 'Seasonal ramp with high no-shows', profile: 'Warehouse associates', requiredDate: '01 Oct 2026', decisionMaker: 'Regional HR Head', process: 'HR → Operations' },
    events: [['Demand diagnosed', '18 Aug, 17:05', '80-member seasonal requirement recorded.'], ['Meeting held', '14 Aug, 11:00', 'Operating model walkthrough completed.']],
  },
  {
    id: 'o4', accountId: 'a4', account: 'Vector Engineering', studio: 'Oragadam', campaign: 'Auto corridor retention', stage: 'Contracted', committed: 72, live: 0, days: 21, nextAction: 'Mobilisation kick-off', due: '08 Sep', owner: 'Rohit Kapur', probability: 85, value: 576000,
    qualified: { problem: 'Dormitory partner instability', profile: 'CNC operators', requiredDate: '28 Sep 2026', decisionMaker: 'Plant HR Lead', process: 'Plant HR → Procurement' },
    events: [['Contract signed', '13 Aug, 10:14', 'Pilot commitment confirmed.'], ['Proposal sent', '08 Aug, 18:02', 'Pilot for 72 members proposed.']],
  },
  {
    id: 'o5', accountId: 'a5', account: 'Keystone Logistics', studio: 'Hosur', campaign: 'NCR logistics operators', stage: 'Solution fit', committed: 64, live: 0, days: 16, nextAction: 'Confirm decision-maker', due: '05 Sep', owner: 'Vikram Sen', probability: 30, value: 512000,
    qualified: { problem: 'Unplanned absenteeism', profile: 'Pickers and packers', requiredDate: '15 Oct 2026', decisionMaker: 'Pending confirmation', process: 'Operations → HR' },
    events: [['Solution fit', '19 Aug, 15:20', 'Hosur Studio fit reviewed.'], ['Discovery held', '15 Aug, 10:30', 'Initial requirements captured.']],
  },
]

export const initialCohorts = [
  { id: 'ac1', account: 'Apex Mobility', studio: 'Hosur', planned: 120, live: 86, arrival: '10–15 Sep', owner: 'Meena Nair', status: 'Mobilising' },
  { id: 'ac2', account: 'Northstar Components', studio: 'Pune', planned: 96, live: 58, arrival: '18–22 Sep', owner: 'Prasshant W.', status: 'Mobilising' },
  { id: 'ac3', account: 'Vector Engineering', studio: 'Oragadam', planned: 72, live: 0, arrival: '24–28 Sep', owner: 'Satish S.', status: 'Planning' },
  { id: 'ac4', account: 'Orbit Logistics', studio: 'NCR', planned: 110, live: 110, arrival: 'Completed 28 Aug', owner: 'Meena Nair', status: 'Live' },
]

export const replyMix = [
  { label: 'Positive', value: 19, color: '#1b7f5c' },
  { label: 'Referral', value: 12, color: '#2c5880' },
  { label: 'Not now', value: 21, color: '#8e6d45' },
  { label: 'No response', value: 48, color: '#dfe5ea' },
]
