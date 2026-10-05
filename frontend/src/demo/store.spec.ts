import { DemoStore } from './store';
const url=(path:string)=>new URL('https://demo.invalid/api'+path);
describe('DemoStore',()=>{
  it('updates sample data locally and resets in a fresh store',()=>{
    const store=new DemoStore();
    store.handle('PUT',url('/users/me/retirement'),{monthlySavings:800});
    expect(store.retirement.monthlySavings).toBe(800);
    expect(new DemoStore().retirement.monthlySavings).toBe(400);
    store.handle('POST',url('/portfolio'),{symbol:'AAPL',quantity:2,averageCost:200,watchOnly:false});
    expect(store.portfolio.length).toBe(4);
    expect(store.dashboard.stocks.length).toBe(4);
  });
  it('rejects unsupported endpoints instead of forwarding them',()=>{
    expect(()=>new DemoStore().handle('POST',url('/private'),{})).toThrowError(/full app/);
  });
});
