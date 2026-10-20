import {expect,test} from '@playwright/test';
test('table waiter call survives refresh and shows acknowledgement without login',async({page})=>{
 let status:string|null=null;let posted=0;
 await page.route('**/api/public/waiter-calls**',async route=>{
   expect(route.request().postDataJSON()).toEqual({tableToken:'test-table'});
   if(!route.request().url().endsWith('/status')){posted++;status='pending';}
   await route.fulfill({json:{success:true,data:{call:status?{id:'call-1',status}:null}}});
 });
 await page.goto('/r/waiter-menu/t/test-table');
 const section=page.getByRole('region',{name:'Waiter assistance'});
 await section.getByRole('button',{name:'Call waiter',exact:true}).click();
 await expect(section.getByText('Waiter request sent')).toBeVisible();
 await expect(section.getByRole('button',{name:'Requested',exact:true})).toBeDisabled();
 expect(posted).toBe(1);
 await page.reload();
 await expect(section.getByText('Waiter request sent')).toBeVisible();
 status='acknowledged';await page.reload();
 await expect(section.getByText('Request acknowledged')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await section.screenshot({path:test.info().outputPath('waiter-acknowledged.png')});
 status='resolved';await page.reload();
 await expect(section.getByText('Restaurant received your call')).toBeVisible();
 await expect(section.getByRole('button',{name:'Call waiter',exact:true})).toBeEnabled();
 await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('call failures and cooldown remain visible and allow retry without an order',async({page})=>{
 let count=0;
 await page.route('**/api/public/waiter-calls**',async route=>{
   if(route.request().url().endsWith('/status'))return route.fulfill({json:{success:true,data:{call:null}}});
   count++;
   if(count===1)return route.fulfill({status:503,json:{error:{message:'Connection failed. Try again.'}}});
   if(count===2)return route.fulfill({status:429,json:{error:{message:'Please wait one minute before calling again'}}});
   await route.fulfill({json:{success:true,data:{call:{id:'call-1',status:'pending'}}}});
 });
 await page.goto('/r/waiter-menu/t/test-table');
 const section=page.getByRole('region',{name:'Waiter assistance'});
 const button=section.getByRole('button',{name:'Call waiter',exact:true});
 await button.click();await expect(section.getByRole('alert')).toHaveText('Connection failed. Try again.');
 await button.click();await expect(section.getByRole('alert')).toHaveText('Please wait one minute before calling again');
 await button.click();await expect(section.getByText('Waiter request sent')).toBeVisible();
 expect(count).toBe(3);
});
