import { installDemoIsolation } from './isolation';
installDemoIsolation('open-fire');
import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient, withInterceptors, HttpResponse, HttpErrorResponse } from '@angular/common/http';
import { provideAnimations } from '@angular/platform-browser/animations';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AppComponent } from '../app/app.component';
import { JeniusAuthService } from '../app/jenius-auth.service';
import { AnalyticsService } from '../app/analytics.service';
import { DemoStore } from './store';
const store=new DemoStore();
bootstrapApplication(AppComponent,{providers:[provideRouter([]),provideAnimations(),
  {provide:JeniusAuthService,useValue:{initialize:async()=>({username:'Demo Portfolio',userId:'jenius-demo'}),startLogin:async()=>{},startRegistration:async()=>{},logout:()=>location.reload()}},
  {provide:AnalyticsService,useValue:{showPrompt:false,consent:'denied'}},
  provideHttpClient(withInterceptors([(request)=>{
    try {return of(new HttpResponse({status:200,body:structuredClone(store.handle(request.method,new URL(request.urlWithParams,location.origin),request.body))}));}
    catch(error){return throwError(()=>new HttpErrorResponse({status:422,error:{message:(error as Error).message},url:request.url}));}
  }]))
]}).then(() => window.parent.postMessage({type:'jenius-demo-ready'}, '*')).catch(error=>{window.parent.postMessage({type:'jenius-demo-error'}, '*');document.body.append('The demo could not start. Please open the full app.');console.error(error);});
