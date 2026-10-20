const http = require('node:http');

const menu = {
  success: true,
  data: {
    restaurant: { name: 'Receipt Test Cafe', qrMode: 'multi', logoUrl: null, coverImageUrl: null },
    categories: [{
      id: 'sample-category', name: 'Drinks', displayOrder: 1,
      items: [{
        id: '11111111-1111-4111-8111-111111111111', name: 'Sample Tea',
        description: null, price: '10.00', imageUrl: null, badge: 'veg', isAvailable: true,
      }],
    }],
  },
};

let retryAvailable = false;
// Sample cafe presentation is isolated from real restaurant data.
const cafeMenu={success:true,data:{restaurant:{name:'Willow & Stone Cafe',qrMode:'multi',logoUrl:null,
  coverImageUrl:'/screenshots/cafe-hero.png',ownerPhotoUrl:'/logo-icon.png',address:'Civil Lines, Jaipur',
  customerEmailRequired:true,waiterCallingEnabled:true},categories:[
  {id:'cafe-brunch',name:'All-day brunch',displayOrder:1,items:[
    {...menu.data.categories[0].items[0],id:'11111111-1111-4111-8111-111111111112',name:'Grilled sourdough sandwich',description:'Toasted sourdough, grilled vegetables, melted cheese and a little house pesto.',price:'240.00',imageUrl:'/screenshots/cafe-hero.png'},
    {...menu.data.categories[0].items[0],id:'11111111-1111-4111-8111-111111111113',name:'Herbed mushroom toast',description:'Sauteed mushrooms, garlic butter and fresh herbs on toast.',price:'195.00',emoji:'\u{1F35E}'},
  ]},
  {id:'cafe-coffee',name:'Coffee & coolers',displayOrder:2,items:[
    {...menu.data.categories[0].items[0],id:'11111111-1111-4111-8111-111111111114',name:'Classic cappuccino',description:'Espresso with steamed milk and a soft layer of foam.',price:'150.00',emoji:'\u{2615}'},
    {...menu.data.categories[0].items[0],id:'11111111-1111-4111-8111-111111111115',name:'Mint & lime cooler',description:'Lime, fresh mint and sparkling water over ice.',price:'160.00',emoji:'\u{1F379}'},
  ]},
  {id:'cafe-sides',name:'Small plates',displayOrder:3,items:[
    {...menu.data.categories[0].items[0],id:'11111111-1111-4111-8111-111111111116',name:'Rosemary fries',description:'Crisp fries, rosemary salt and house dip.',price:'180.00',emoji:'\u{1F35F}'},
  ]},
  {id:'cafe-dessert',name:'Something sweet',displayOrder:4,items:[
    {...menu.data.categories[0].items[0],id:'11111111-1111-4111-8111-111111111117',name:'Chocolate brownie',description:'Warm chocolate brownie with vanilla ice cream.',price:'190.00',emoji:'\u{1F36B}',isAvailable:false},
  ]},
]}};
http.createServer((request, response) => {
  response.setHeader('Content-Type', 'application/json');
  // Isolated fixture state only, never a real account/order mutation.
  if (request.method === 'POST' && request.url.startsWith('/__audit/retry')) {
    retryAvailable = request.url.includes('available=true');
    return response.end(JSON.stringify({ ok: true }));
  }
  if (request.method === 'GET' && request.url === '/health') {
    return response.end(JSON.stringify({ ok: true }));
  }
  if(request.method==='GET' && request.url==='/api/public/menu/cafe-redesign')return response.end(JSON.stringify(cafeMenu));
  if(request.method==='GET' && request.url==='/api/public/menu/cafe-long-name')return response.end(JSON.stringify({...cafeMenu,data:{...cafeMenu.data,restaurant:{...cafeMenu.data.restaurant,name:'The Little Neighbourhood Coffeehouse & All-Day Kitchen',coverImageUrl:null}}}));
  if (request.method === 'GET' && request.url === '/api/public/menu/receipt-test') {
    return response.end(JSON.stringify(menu));
  }
  if (request.method === 'GET' && request.url === '/api/public/menu/waiter-menu') {
    return response.end(JSON.stringify({...menu,data:{...menu.data,restaurant:{...menu.data.restaurant,waiterCallingEnabled:true}}}));
  }
  if (request.method === 'GET' && request.url === '/api/public/menu/customer-email') {
    return response.end(JSON.stringify({ ...menu, data: { ...menu.data,
      restaurant: { ...menu.data.restaurant, customerEmailRequired: true,
        address: 'Jaipur, Rajasthan', ownerPhotoUrl: '/logo-icon.png' },
    } }));
  }
  if (request.method === 'GET' && request.url === '/api/public/menu/emoji-menu') {
    return response.end(JSON.stringify({ ...menu, data: { ...menu.data, categories: [{
      ...menu.data.categories[0], items: [{ ...menu.data.categories[0].items[0], emoji: '\u{2615}' }],
    }] } }));
  }
  if (request.method === 'GET' && request.url === '/api/public/menu/options-menu') {
    return response.end(JSON.stringify({ ...menu, data: { ...menu.data, categories: [{
      ...menu.data.categories[0], items: [{ ...menu.data.categories[0].items[0], name: 'Pizza', price: '90.00', options: {
        variants: [
          { id: '22222222-2222-4222-8222-222222222222', name: 'Small', price: '100.00', isAvailable: true },
          { id: '33333333-3333-4333-8333-333333333333', name: 'Large', price: '180.00', isAvailable: true },
          { id: '66666666-6666-4666-8666-666666666666', name: 'Sold size', price: '250.00', isAvailable: false },
        ], addOns: [
          { id: '44444444-4444-4444-8444-444444444444', name: 'Cheese', price: '20.00', isAvailable: true },
          { id: '55555555-5555-4555-8555-555555555555', name: 'Sauce', price: '0.00', isAvailable: true },
          { id: '77777777-7777-4777-8777-777777777777', name: 'Sold add-on', price: '5.00', isAvailable: false },
        ],
      } }],
    }] } }));
  }
  if (request.method === 'GET' && request.url === '/api/public/menu/pending-profile') {
    return response.end(JSON.stringify({ ...menu, data: { ...menu.data,
      restaurant: { ...menu.data.restaurant, orderingEnabled: false },
    } }));
  }
  if (request.method === 'GET' && request.url === '/api/public/menu/retry-test' && retryAvailable) {
    return response.end(JSON.stringify(menu));
  }
  if (request.method === 'GET' && request.url === '/api/public/menu/large-menu') {
    return response.end(JSON.stringify({ ...menu, data: { ...menu.data, categories: [{
      ...menu.data.categories[0],
      items: Array.from({ length: 51 }, (_, index) => ({
        ...menu.data.categories[0].items[0],
        id: `11111111-1111-4111-8111-${String(index + 1).padStart(12, '0')}`,
        name: `Dish ${index + 1}`,
      })),
    }] } }));
  }
  // Order POSTs must be intercepted by the test; this fixture never writes data.
  response.statusCode = 404;
  response.end(JSON.stringify({ success: false }));
}).listen(4319, '127.0.0.1');
