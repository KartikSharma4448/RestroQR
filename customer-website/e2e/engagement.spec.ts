import {test,expect} from '@playwright/test';
const token='a'.repeat(64),claim='b'.repeat(64);
test('restaurant shows order, reviews, UPI and owner-enabled rewards without overflow',async({page})=>{
  const qr=await require('../../backend/node_modules/qrcode').toDataURL('upi://pay?pa=cafe%40upi&pn=Cafe&cu=INR',{width:280,margin:2});
  await page.route('**/api/public/order-board/**',route=>route.fulfill({json:{data:[]}}));
  await page.route('**/api/public/engagement/**',route=>route.fulfill({json:{data:{
    loyalty:{scheme:'both',visitReward:'Complimentary tea',spendReward:'Cheesy dip',thresholdCents:30000},
    reviewsEnabled:true,reviews:[{rating:5,body:'A very long review '.repeat(50),submitted_at:'2026-10-20T00:00:00Z'}],summary:{count:1,average:'5.0'},
    payment:{upiId:'cafe@upi',url:'upi://pay?pa=cafe%40upi&pn=Cafe&cu=INR',qr},
  }}}));
  await page.goto('/r/customer-email/t/test-table');
  await expect(page.getByText('7 paid visit dates: Complimentary tea')).toBeVisible();
  await page.getByRole('button',{name:'Reviews',exact:true}).click();await expect(page.getByText('5.0/5 · 1 published reviews')).toBeVisible();
  await page.getByRole('button',{name:'Pay',exact:true}).click();
  const qrImage=page.getByRole('img',{name:'Restaurant UPI payment QR'});await expect(qrImage).toBeVisible();expect(await qrImage.evaluate((el:HTMLImageElement)=>el.naturalWidth===280)).toBe(true);
  await expect(page.getByRole('link',{name:'Open UPI app'})).toHaveAttribute('href',/^upi:\/\/pay\?/);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:test.info().outputPath('restaurant-services.png'),fullPage:true});
});
test('private reward keeps secrets in fragment/body, not HTTP query, and shows redemption state',async({page})=>{
  let status='available';
  await page.route('**/api/public/rewards/view',route=>{
    expect(new URL(route.request().url()).search).toBe('');expect(route.request().postDataJSON()).toEqual({token,claim});
    return route.fulfill({json:{data:{restaurant:'Test Cafe',reward:'Cheesy dip',kind:'spend',status,expiresAt:'2027-01-01T00:00:00Z'}}});
  });
  await page.goto(`/reward#${token}.${claim}`);await expect(page.getByText('Cheesy dip',{exact:true})).toBeVisible();
  await expect(page.getByText(claim,{exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:test.info().outputPath('private-reward.png'),fullPage:true});
  status='redeemed';await page.reload();await expect(page.getByText('redeemed',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Copy claim code'})).toHaveCount(0);
});
test('paid guest submits one moderated review without OTP and handles errors',async({page})=>{
  let submitted=false,attempts=0;
  await page.route('**/api/public/reviews/view',route=>route.fulfill({json:{data:{restaurant:'Test Cafe',submitted}}}));
  await page.route('**/api/public/reviews/submit',route=>{
    attempts++;expect(route.request().postDataJSON()).toEqual({token,rating:4,body:'Lovely food'});
    if(attempts===1)return route.fulfill({status:503,json:{error:{message:'Temporary failure'}}});
    submitted=true;return route.fulfill({json:{data:{submitted:true}}});
  });
  await page.goto(`/visit#${token}`);await page.getByRole('button',{name:'4 stars',exact:true}).click();await page.getByLabel('Your review').fill('Lovely food');
  await page.getByRole('button',{name:'Submit review'}).click();await expect(page.getByRole('alert').filter({hasText:'Temporary failure'})).toBeVisible();
  await page.getByRole('button',{name:'Submit review'}).click();await expect(page.getByRole('status')).toContainText('submitted for moderation');
  await page.reload();await expect(page.getByRole('button',{name:'Submit review'})).toHaveCount(0);await expect(page.getByLabel(/OTP|password/)).toHaveCount(0);
});
