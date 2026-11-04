// Fictional prices, products and Nests. No external source or live identifiers.
const rows = [
 ['rice','Rice','5 kg',245,'🍚'],['atta','Whole wheat atta','5 kg',210,'🌾'],
 ['oil','Sunflower oil','1 litre',125,'🌻'],['dal','Toor dal','1 kg',115,'🫘'],
 ['moong','Moong dal','1 kg',105,'🫘'],['chana','Chana dal','1 kg',85,'🫘'],
 ['sugar','Sugar','1 kg',42,'🥣'],['salt','Iodised salt','1 kg',20,'🧂'],
 ['tea','Tea','250 g',95,'🍵'],['poha','Poha','500 g',38,'🥣'],
 ['suji','Suji','500 g',32,'🌾'],['besan','Besan','500 g',55,'🌾'],
 ['soap','Bath soap','100 g',28,'🧼'],['detergent','Laundry powder','1 kg',72,'🫧'],
 ['dishwash','Dishwash bar','200 g',22,'🧽'],['toothpaste','Toothpaste','100 g',45,'🪥'],
 ['shampoo','Shampoo','180 ml',85,'🧴'],['biscuits','Biscuits','200 g',30,'🍪'],
 ['turmeric','Turmeric','100 g',25,'🌿'],['chilli','Chilli powder','100 g',32,'🌶️'],
];
export const products = rows.map(([id,name,pack,price,emoji])=>({id:'demo-'+id,name:'DEMO '+name,pack,price,pricePaise:price*100,emoji,test:true,category:'Essentials'}));
export const member = {id:'preview-member',name:'DEMO fictional member',role:'member',locationIds:['DEMO-NEST-01','DEMO-NEST-02'],test:true};
export function seedInvestorDemo(s, time=Date.now()) {
 if(s.investorDemoSeed) return s;
 const end=new Date(time+365*86400000).toISOString();
 Object.assign(s,{dummy:true,beat:{beatDate:new Date(time).toISOString().slice(0,10),open:true,closed:false,opening:Object.fromEntries(products.map(p=>[p.id,100]))},orders:[],reservations:[],payments:[],settlements:[],scans:[],commerce:{sessions:{},accounts:{[member.id]:member},requests:{},limits:{},tickets:[],audit:[],config:{verified:false,reserveMinutes:120,products,staffLocations:{},support:'DEMO only. No real pickup or payment.',locations:['01','02'].map((n)=>({id:'DEMO-NEST-'+n,name:'DEMO '+(n==='01'?'Neem':'Peepal')+' Nest',address:'Fictional pickup Nest · no real collection',modes:['pickup'],test:true,windowStart:new Date(time).toISOString(),windowEnd:end}))}}});
 s.commerce.config.beatDate=s.beat.beatDate;
 s.investorDemoSeed={version:1,at:new Date(time).toISOString()};
 return s;
}
