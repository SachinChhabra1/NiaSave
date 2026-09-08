// One taxonomy for member navigation and the canonical Save product configuration.
export const saveCategories = [
  {id:'all',name:'All essentials',hindi:'सभी सामान',icon:'essentials'},
  {id:'food',name:'Food & snacks',hindi:'खाना और स्नैक्स',icon:'food'},
  {id:'ration',name:'Ration & cooking',hindi:'राशन और खाना पकाना',icon:'ration'},
  {id:'cleaning',name:'Cleaning',hindi:'सफाई',icon:'cleaning'},
  {id:'personal-care',name:'Personal care',hindi:'व्यक्तिगत देखभाल',icon:'personal'},
  {id:'clothing',name:'Clothing',hindi:'कपड़े',icon:'clothing'},
  {id:'footwear',name:'Footwear',hindi:'जूते-चप्पल',icon:'footwear'},
  {id:'insurance',name:'Insurance',hindi:'बीमा',icon:'insurance'}
];
const legacy = {'All':'all','Cooking':'ration','Home care':'cleaning','Personal care':'personal-care'};
export function categoryId(value) {
  return saveCategories.find(c=>c.id===value||c.name===value)?.id || (Object.hasOwn(legacy,value) ? legacy[value] : null);
}
export const goodsCategory = value => {
  const id=categoryId(value);
  return id && !['all','insurance'].includes(id) ? id : null;
};
export const categoryIcons = {
  essentials:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  food:'<path d="M3 13h18a9 9 0 0 1-18 0ZM8 5v4m4-6v6m4-4v4M7 21h10"/>',
  ration:'<path d="M5 7h14l2 14H3L5 7Zm0 0 2-4h10l2 4M12 11v7m0-4-3-2m3 5 3-2"/>',
  cleaning:'<path d="M9 3h10v3l-5 2v3m-5-8v4H6m3 0 2 4M9 11h7l3 10H6l3-10Zm9-2h3m-2-3 2-1"/>',
  personal:'<rect x="5" y="8" width="14" height="13" rx="5"/><path d="M9 8V4h6v4M10 3h8m-9 11h6m-5 3h4"/>',
  clothing:'<path d="m8 3-6 4 3 5 3-2v11h8V10l3 2 3-5-6-4a4 4 0 0 1-8 0Z"/>',
  footwear:'<path d="M3 11V7h5l3 6 8 2a3 3 0 0 1 2 3v3H3V11Zm0 7h18M10 11l3-1m0 3 3-1"/>',
  insurance:'<path d="m12 2 9 4v6c0 5-9 10-9 10S3 17 3 12V6l9-4Zm-4 10 3 3 5-6"/>'
};
