export const getToday = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};
export const TODAY = getToday();
export const DEPTS = ['Engineering / Track', 'Signal & Telecom', 'Electrical / Traction', 'Mechanical', 'Bridges'];
export const CATS = ['Track', 'Signals & Communication', 'Electrical & Power', 'Mechanical', 'Bridges'];
export const CAT_DEPT = Object.fromEntries(CATS.map((c, i) => [c, DEPTS[i]]));
export const SHORT = {
  'Engineering / Track': 'Track',
  'Signal & Telecom': 'Signal',
  'Electrical / Traction': 'Electrical',
  'Mechanical': 'Mechanical',
  'Bridges': 'Bridges',
};
export const PREFIX = { 'Track': 'TRK', 'Signals & Communication': 'SIG', 'Electrical & Power': 'ELE', 'Mechanical': 'MEC', 'Bridges': 'BRG' };
export const WORK = {
  [DEPTS[0]]: ['Rail replacement', 'Sleeper replacement', 'Fastener tightening', 'Track section repair', 'Track switch repair'],
  [DEPTS[1]]: ['Signal repair', 'Network / communication fault', 'Equipment damage repair'],
  [DEPTS[2]]: ['Transformer service', 'Power supply fix', 'Overheating inspection'],
  [DEPTS[3]]: ['Wheel repair', 'Brake repair', 'Motor part replacement', 'Component replacement'],
  [DEPTS[4]]: ['Structure repair', 'Concrete support repair', 'Bridge deck repair', 'Bearing replacement'],
};
export const PRI = ['Critical', 'High', 'Medium', 'Low'];
export const RANK = { Critical: 4, High: 3, Medium: 2, Low: 1 };
export const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const DEPT_TAG_CLASS = {
  'Engineering / Track': 'dept-track',
  'Signal & Telecom': 'dept-signal',
  'Electrical / Traction': 'dept-electrical',
  'Mechanical': 'dept-mechanical',
  'Bridges': 'dept-bridges',
};
export const STORAGE_KEY = 'railmaint_user_store_v3';
export const NAV = [
  ['dashboard', 'Dashboard Overview', 'grid'],
  ['requests', 'Maintenance Requests', 'clipboard'],
  ['blocks', 'Block Optimization', 'calendar'],
  ['assets', 'Asset Management', 'box'],
  ['risk', 'Present Risk Scoring', 'gauge'],
  ['prediction', 'Future Failure Prediction', 'trend'],
  ['whatif', 'What-If Simulator', 'sliders'],
  ['reports', 'Reports & Analytics', 'bars'],
  ['notifications', 'Notifications', 'bell'],
];
