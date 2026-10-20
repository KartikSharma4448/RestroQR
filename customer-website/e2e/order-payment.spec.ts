import { expect, test } from '@playwright/test';

const orderId='11111111-1111-4111-8111-111111111111';
const token='a'.repeat(64);
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN1cAAAAASUVORK5CYII=','base64');
test.beforeEach(async ({ page }) => {
  await page.route('**/api/public/orders', route => route.fulfill({json:{success:true,data:{
    orderRef:'ORD-PAYTEST',total:'20.00',emailConfirmation:'queued',payment:{orderId,token},
    items:[{name:'Sample Tea',quantity:2,price:'10.00'}],
  }}}));
});
async function checkout(page: import('@playwright/test').Page) {
  await page.goto('/r/customer-email/t/test-table');
  await page.getByRole('button',{name:'Add Sample Tea',exact:true}).click();
  await page.getByRole('button',{name:/Review & Place Order/}).click();
  await page.getByLabel('Email for order confirmation').fill('buyer@example.test');
  await page.getByRole('button',{name:'Place Order',exact:true}).click();
}
test('UPI amount, proof submission, private token and restored checkout work',async ({page})=>{
  const qrDataUrl = await require('../../backend/node_modules/qrcode').toDataURL('upi://pay?pa=cafe%40upi&pn=Payment+Cafe&am=20.00&cu=INR');
  let choice='unselected';
  let posted=false;
  let paid=false;
  await page.route(`**/api/public/order-payments/${orderId}**`,async route=>{
    expect(route.request().headers()['x-order-token']).toBe(token);
    expect(route.request().url()).not.toContain(token);
    if(route.request().url().endsWith('/proof')) {
      posted=true; choice='upi_submitted';
      expect(route.request().postDataBuffer()?.toString()).toContain('TX12345678');
      return route.fulfill({json:{success:true,data:{choice}}});
    }
    await route.fulfill({json:{success:true,data:{orderRef:'ORD-PAYTEST',total:'20.00',payeeName:'Payment Cafe',upiId:'cafe@upi',choice,
      orderStatus:paid?'payment_received':'pending',transactionId:posted?'TX12345678':null,
      upiUrl:paid?null:'upi://pay?pa=cafe%40upi&pn=Payment+Cafe&am=20.00&cu=INR',qrDataUrl}}});
  });
  await checkout(page);
  await expect(page.getByText('Payment Cafe',{exact:true})).toBeVisible();
  await expect(page.getByRole('link',{name:'Open UPI app'})).toHaveAttribute('href',/am=20\.00/);
  await expect(page.getByRole('img',{name:'UPI payment QR'})).toBeVisible();
  await page.getByLabel('Transaction ID',{exact:true}).fill('TX12345678');
  await page.getByLabel('Payment screenshot').setInputFiles({name:'proof.png',mimeType:'image/png',buffer:png});
  await page.getByRole('region',{name:'Order payment'}).screenshot({path:test.info().outputPath('upi-checkout.png')});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.getByRole('button',{name:'Submit payment proof'}).click();
  await expect(page.getByText(/Proof submitted/)).toBeVisible();
  expect(posted).toBe(true);
  await page.reload();
  await expect(page.getByText(/Proof submitted/)).toBeVisible();
  paid=true;
  await page.getByRole('button',{name:'Refresh payment status'}).click();
  await expect(page.getByText('Payment confirmed by restaurant',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Order More Dishes'}).click();
  await page.getByRole('button',{name:'View last order & payment',exact:true}).click();
  await expect(page.getByText('Payment confirmed by restaurant',{exact:true})).toBeVisible();
});
test('cash selection remains unpaid and failed submission can be retried',async({page})=>{
  let choice='unselected'; let attempts=0;
  await page.route(`**/api/public/order-payments/${orderId}**`,async route=>{
    if(route.request().url().endsWith('/cash')){
      if(++attempts===1)return route.fulfill({status:503,json:{error:{message:'Temporary payment error'}}});
      choice='cash'; return route.fulfill({json:{success:true,data:{choice}}});
    }
    return route.fulfill({json:{success:true,data:{orderRef:'ORD-PAYTEST',total:'20.00',payeeName:'Payment Cafe',upiId:null,choice,orderStatus:'pending',upiUrl:null,qrDataUrl:null}}});
  });
  await checkout(page);
  await page.getByRole('button',{name:'Choose cash',exact:true}).click();
  await expect(page.getByRole('region',{name:'Order payment'}).getByRole('alert')).toHaveText('Temporary payment error');
  await page.getByRole('button',{name:'Choose cash',exact:true}).click();
  await expect(page.getByText('Cash selected. Awaiting payment confirmation at the counter.')).toBeVisible();
  await expect(page.getByText('Payment confirmed by restaurant',{exact:true})).toHaveCount(0);
  await page.screenshot({path:test.info().outputPath('cash-checkout.png'),fullPage:true});
});
