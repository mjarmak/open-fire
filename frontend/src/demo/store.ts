import type { DashboardResponse, PortfolioHolding, StockAlert, UserRetirementSettings } from '../app/market-dashboard.models';
const now = '2026-10-05T12:00:00Z';
const quotes = [{symbol:'AAPL',name:'Apple',price:225,quantity:12,cost:190},{symbol:'MSFT',name:'Microsoft',price:420,quantity:8,cost:370},{symbol:'NVDA',name:'NVIDIA',price:130,quantity:0,cost:0}];
export class DemoStore {
  portfolio: PortfolioHolding[] = quotes.map((quote,index) => ({id:index+1,symbol:quote.symbol,companyName:quote.name,quantity:quote.quantity,averageCost:quote.cost,watchOnly:quote.quantity === 0}));
  retirement: UserRetirementSettings = {investingStartDate:'2020-01-01',desiredMonthlyIncome:2500,customReturnRate:7,monthlySavings:400,otherSavings:10000,yearlyInflationRate:2.5,safeWithdrawalRate:4};
  dca = {telegramDcaEnabled:false,emailDcaEnabled:false,emailReturnEnabled:false,reminderNote:'Sample monthly contribution plan',reminderDays:['MONDAY']};
  get stocks(): StockAlert[] { return this.portfolio.map(holding => {
    const price = quotes.find(quote => quote.symbol === holding.symbol)?.price ?? 100;
    const value = holding.watchOnly ? null : price * holding.quantity;
    const cost = holding.watchOnly ? null : holding.averageCost * holding.quantity;
    const gain = value === null || cost === null ? null : value - cost;
    return {...holding,positionType:holding.watchOnly ? 'WATCHLIST' : 'HOLDING',latestPrice:price,marketCap:3000000000000,peRatio:28,beta:1.1,realizedVolatilityPercent:22,drawdownPercent:-8,fearScore:35,marketValue:value,costBasis:cost,dayGainLoss:value === null ? null : value*0.006,dayGainLossPercent:0.6,unrealizedGainLoss:gain,unrealizedGainLossPercent:cost ? (gain ?? 0)/cost*100 : null,thirtyDayChangePercent:3.2,alert:false,reason:'Illustrative sample data'};
  }); }
  get dashboard(): DashboardResponse {return {asOf:now,portfolio:this.portfolio,stocks:this.stocks,dailyReport:'Demo portfolio · illustrative prices',notification:{enabled:false,configured:false,provider:'Demo'},indicators:[
    {id:'vix',name:'VIX',category:'Volatility',value:18.2,unit:'index',change:-0.7,status:'normal',source:'Sample data',lastUpdated:now,description:'Illustrative volatility reading'},
    {id:'credit_spread',name:'Credit Spread',category:'Credit',value:3.1,unit:'%',change:0.1,status:'normal',source:'Sample data',lastUpdated:now,description:'Illustrative credit conditions'}]};}
  handle(method:string,url:URL,body:any):unknown {
    const path=url.pathname.replace(/^\/api/,'');
    if (path === '/dashboard') return this.dashboard;
    if (path === '/indicators') return this.dashboard.indicators;
    if (path === '/stocks' || path === '/stocks/prices') return this.stocks;
    if (path === '/notifications/status') return this.dashboard.notification;
    if (path === '/portfolio') {
      if (method === 'POST') {const item={...body,id:Math.max(0,...this.portfolio.map(holding=>holding.id??0))+1};this.portfolio.push(item);return item;}
      return this.portfolio;
    }
    const position=path.match(/^\/portfolio\/(\d+)$/);
    if (position) {const id=Number(position[1]),item=this.portfolio.find(holding=>holding.id===id);if(!item)throw new Error('Sample position not found.');if(method==='DELETE'){this.portfolio=this.portfolio.filter(holding=>holding.id!==id);return null;}if(method==='PUT')Object.assign(item,body,{id});return item;}
    if (path === '/users/me/retirement') {if(method==='PUT')this.retirement={...this.retirement,...body};return this.retirement;}
    if (path === '/users/me/dca') {if(method==='PUT')this.dca={...this.dca,...body};return this.dca;}
    if (path === '/symbols/search') return quotes.filter(quote=>(quote.symbol+' '+quote.name).toLowerCase().includes((url.searchParams.get('q')??url.searchParams.get('query')??'').toLowerCase())).map(quote=>({symbol:quote.symbol,name:quote.name,region:'United States',currency:'USD'}));
    if (path === '/stocks/preview') return this.stocks.find(stock=>stock.symbol===url.searchParams.get('symbol'))??this.stocks[0];
    if (/^\/(stocks|indicators)\/[^/]+\/history$/.test(path)) {
      const id=path.split('/')[2],base=quotes.find(quote=>quote.symbol===id)?.price??18;
      return {id,range:url.searchParams.get('range')??'1M',points:Array.from({length:30},(_,index)=>({timestamp:new Date(Date.UTC(2026,8,6+index)).toISOString(),value:base*(0.94+index*0.002+Math.sin(index/3)*0.01)}))};
    }
    throw new Error('This action is available in the full app.');
  }
}
