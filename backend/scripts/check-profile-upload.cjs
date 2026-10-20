const assert = require('node:assert/strict');
const fs = require('node:fs');
const { randomBytes } = require('node:crypto');
const { spawnSync } = require('node:child_process');

// Never fall back to the application's production database.
const connection = process.env.RESTROQR_ACCEPTANCE_DATABASE_URL;
let target;
try { target = new URL(connection); } catch { target = null; }
if (!target || target.hostname !== '127.0.0.1' ||
    !['postgres:', 'postgresql:'].includes(target.protocol) || target.search || target.hash ||
    !/^\/restroqr_auth_acceptance_[a-z0-9_]+$/.test(target.pathname) ||
    process.env.RESTROQR_LIVE_UPLOAD_TEST !== 'true') {
  console.error('Requires an isolated local acceptance database and RESTROQR_LIVE_UPLOAD_TEST=true.');
  process.exit(1);
}
const local = require('dotenv').parse(fs.readFileSync('.env'));
assert.ok(local.CLOUDINARY_URL, 'Configure local Cloudinary credentials first');
Object.assign(process.env, {
  DATABASE_URL: connection, NODE_ENV: 'test',
  JWT_SECRET: randomBytes(32).toString('hex'),
  OWNER_EMAIL_SIGNUP_ENABLED: 'true', OWNER_PROFILE_ACTIVATION_ENABLED: 'true',
  CLOUDINARY_URL: local.CLOUDINARY_URL,
});
const migration = spawnSync(process.execPath, [require.resolve('node-pg-migrate/bin/node-pg-migrate'),
  'up', '--migrations-dir', 'migrations', '--migration-file-language', 'js'],
{ env: process.env, stdio: 'inherit' });
if (migration.status !== 0) process.exit(1);
require('ts-node/register/transpile-only');
const express = require('express');
const request = require('supertest');
const { v2: cloudinary } = require('cloudinary');
const pool = require('../src/config/database').default;
const { authenticate, requireRole } = require('../src/middleware/auth');
const { signToken } = require('../src/utils/token');
const router = require('../src/routes/owner/restaurant').default;
const { createRestaurant } = require('../src/services/ownerRestaurantService');
const assets = new Set();
const uploadStream = cloudinary.uploader.upload_stream.bind(cloudinary.uploader);
cloudinary.uploader.upload_stream = (options, callback) => uploadStream(
  { ...options, timeout: 30000 }, (error, result) => {
    if (result?.public_id) assets.add(result.public_id);
    callback(error, result);
  });
const app = express();
app.use(express.json());
app.use('/api/owner', authenticate, requireRole('owner'), router);
app.use((error, _req, res, _next) => {
  res.status(error.statusCode || 500).json({ success: false, error: { code: error.code } });
});
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=', 'base64');
const endpoint = '/api/owner/restaurant/profile-images';
let passed = 0;
function check(name) { passed++; console.log('PASS ' + name); }

(async () => {
  try {
    assert.equal((await pool.query('SELECT id FROM owners')).rowCount, 0,
      'This test requires a fresh empty disposable database');
    const owners = [];
    for (let i = 0; i < 2; i++) {
      const owner = (await pool.query(`INSERT INTO owners
        (name,email,password_hash,email_verified_at,firebase_uid,google_subject)
        VALUES ($1,$2,$3,NOW(),$4,$5) RETURNING id`,
      ['Synthetic Owner', `upload-${i}@example.test`, 'not-a-login-password', `fixture-${i}`, `subject-${i}`])).rows[0];
      const restaurant = await createRestaurant({ ownerId: owner.id, name: 'Synthetic Cafe',
        address: 'Test address', phone: '9999999999' });
      owners.push({ ...owner, restaurant, token: signToken(owner.id, 'owner') });
    }
    const auth = `Bearer ${owners[0].token}`;
    assert.equal((await request(app).post(endpoint).attach('ownerPhoto', png, 'owner.png')).status, 401);
    assert.equal((await request(app).post(endpoint).set('Authorization', `Bearer ${signToken(owners[0].id, 'admin')}`)
      .attach('ownerPhoto', png, 'owner.png')).status, 403);
    check('missing login and wrong role rejected');
    assert.equal((await request(app).post(endpoint).set('Authorization', auth)
      .attach('ownerPhoto', Buffer.from('not an image'), 'fake.png')).status, 400);
    assert.equal((await request(app).post(endpoint).set('Authorization', auth)
      .attach('ownerPhoto', Buffer.alloc(5 * 1024 * 1024 + 1), 'large.png')).status, 400);
    assert.equal((await request(app).post(endpoint).set('Authorization', auth)
      .attach('unexpected', png, 'owner.png')).status, 400);
    assert.equal(assets.size, 0);
    check('invalid, oversized and unexpected uploads rejected before provider calls');
    const response = await request(app).post(endpoint).set('Authorization', auth)
      .attach('ownerPhoto', png, 'owner.png').attach('cover', png, 'cover.png');
    assert.equal(response.status, 200, 'Multipart profile upload must succeed');
    const setup = response.body.data;
    assert.equal(setup.required.ownerPhoto, true);
    assert.equal(setup.required.restaurantCover, true);
    assert.equal(assets.size, 2);
    check('two-image multipart request uploads owner photo and cover');
    for (const url of [setup.ownerPhotoUrl, setup.coverImageUrl]) {
      const image = await fetch(url, { signal: AbortSignal.timeout(15000) });
      const bytes = Buffer.from(await image.arrayBuffer());
      assert.equal(image.status, 200);
      const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
      const pngImage = bytes.subarray(0, 8).equals(png.subarray(0, 8));
      assert.ok(jpeg || pngImage, 'Returned image must contain valid image bytes');
    }
    check('both saved image URLs deliver real image bytes');
    const saved = await request(app).get('/api/owner/restaurant/onboarding').set('Authorization', auth);
    assert.equal(saved.body.data.ownerPhotoUrl, setup.ownerPhotoUrl);
    assert.equal(saved.body.data.coverImageUrl, setup.coverImageUrl);
    check('profile reload restores saved URLs from PostgreSQL');
    const other = await request(app).get('/api/owner/restaurant/onboarding')
      .set('Authorization', `Bearer ${owners[1].token}`);
    assert.equal(other.body.data.ownerPhotoUrl, null);
    assert.equal(other.body.data.coverImageUrl, null);
    check('another owner remains untouched');
    const activated = await request(app).put('/api/owner/restaurant/business-upi')
      .set('Authorization', auth).send({ businessUpiId: 'synthetic@bank' });
    assert.equal(activated.body.data.completionPercent, 100);
    assert.equal(activated.body.data.orderingEnabled, true);
    check('profile activation uses saved photos and business details');
    console.log(`Passed ${passed} live integration checks. No production database used.`);
  } catch (error) {
    console.error('Profile upload integration failed:', error.code || error.name);
    process.exitCode = 1;
  } finally {
    for (const publicId of assets) {
      try {
        const result = await cloudinary.uploader.destroy(publicId,
          { resource_type: 'image', invalidate: true, timeout: 20000 });
        assert.equal(result.result, 'ok');
        console.log('Deleted synthetic test image');
      } catch {
        console.error('Test image cleanup failed:', publicId);
        process.exitCode = 1;
      }
    }
    await pool.end();
    process.exit(process.exitCode || 0);
  }
})();
