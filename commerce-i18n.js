export const languageOptions = [
  {id:'en', label:'English'},
  {id:'hi', label:'हिन्दी'},
  {id:'ta', label:'தமிழ்'},
  {id:'kn', label:'ಕನ್ನಡ'},
  {id:'mr', label:'मराठी'}
];
export const validLanguage = value => languageOptions.some(l => l.id === value);
const dictionaries = {};
const pending = {};
const loaders = {
  hi: () => import('./commerce-locales/hi.js'),
  ta: () => import('./commerce-locales/ta.js'),
  kn: () => import('./commerce-locales/kn.js'),
  mr: () => import('./commerce-locales/mr.js')
};
// Load only the selected language; English never downloads other dictionaries.
export async function loadLanguage(lang) {
  if(lang === 'en' || dictionaries[lang]) return;
  if(!validLanguage(lang)) throw new Error('unsupported_language');
  pending[lang] ||= loaders[lang]().then(module => {dictionaries[lang] = module.default;}).finally(() => {delete pending[lang];});
  await pending[lang];
}
export function translate(lang, english, hindi) {
  if(lang === 'hi') return hindi || dictionaries.hi?.[english] || english;
  return dictionaries[lang]?.[english] || english;
}
