import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

import { AppComponent } from './app.component';
import { AuthComponent } from './auth/auth.component';
import { AuthGuard } from './auth/auth.guard';
import { ExecutionOrderComponent } from './execution-order/execution-order.component';
import { ServiceInvoiceComponent } from './service-invoice/service-invoice.component';


const routes: Routes = [
  { path: '', component: ServiceInvoiceComponent },
  { path: 'login', component: AuthComponent },
  { path: 'service-invoice', component: ServiceInvoiceComponent }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
