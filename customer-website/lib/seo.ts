export const SITE_URL = 'https://restroqr.thekartiksharma.in';
export const SITE_NAME = 'RestroQR';
export const HOME_TITLE = 'Free Restaurant & Cafe Management App | RestroQR';
export const HOME_DESCRIPTION = 'Manage your restaurant or cafe for free with RestroQR. Create digital QR menus, take table orders, track revenue and manage dishes with the Android owner app.';
export const SOCIAL_IMAGE = '/restroqr-social-preview.jpg';

export const homeSchema = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'WebSite', '@id': `${SITE_URL}/#website`, name: SITE_NAME,
      alternateName: 'RestroQR Restaurant Management', url: `${SITE_URL}/` },
    { '@type': 'SoftwareApplication', '@id': `${SITE_URL}/#app`, name: SITE_NAME,
      url: `${SITE_URL}/`, description: HOME_DESCRIPTION, operatingSystem: 'Android',
      applicationCategory: 'BusinessApplication', image: `${SITE_URL}${SOCIAL_IMAGE}`,
      downloadUrl: `${SITE_URL}/download/restroqr-owner.apk`,
      isPartOf: { '@id': `${SITE_URL}/#website` },
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'INR', url: `${SITE_URL}/#pricing` },
      featureList: ['Digital QR menus', 'Table ordering', 'Live order board', 'Menu availability management', 'Revenue and item analytics'],
      screenshot: ['owner-overview.png', 'owner-orders.png', 'owner-menu.png', 'owner-qr.png']
        .map(file => `${SITE_URL}/screenshots/${file}`),
    },
  ],
};
