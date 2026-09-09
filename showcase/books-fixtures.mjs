// Synthetic financial history created in Central. It never represents bank activity.
export function memberBooksDemo(time=Date.now()) {
  const d=new Date(time);
  return {memberId:'preview-member',months:[0,1,2].map(i=>{
    const month=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()-3+i,1)).toISOString().slice(0,7);
    const records=[
      ['earning','Salary received','Demo payroll',[18000,19500,21000][i], '01'],
      ['expense','Nest rent','Demo Jat receipt',2464,'03'],
      ['expense','Food & essentials','Demo Sikh receipts',[4000,4400,4900][i],'12'],
      ['expense','Travel & personal spending','Demo consented account statement',[2536,2936,3436][i],'18'],
      ['home','Money sent home','Demo bank transfer',[7000,7500,8000][i],'20'],
    ];
    return {month,complete:true,entries:records.map(([kind,label,source,amount,day],j)=>({reference:`DEMO-BOOKS-${month}-${j}`,date:`${month}-${day}`,kind,label,source,amountPaise:Number(amount)*100,status:'settled',verified:true}))};
  })};
}
