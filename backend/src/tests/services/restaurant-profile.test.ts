jest.mock('../../config/database', () => ({ __esModule: true, default: { query: jest.fn(), connect: jest.fn() } }));
jest.mock('cloudinary', () => ({ v2: { config: jest.fn(), uploader: { upload_stream: jest.fn() } } }));
import pool from '../../config/database';
import { v2 as cloudinary } from 'cloudinary';
import { getOwnerProfileSetup, summarizeProfile, validateBusinessUpi, validateProfileImage,
  setBusinessUpi, uploadOwnerProfileImages } from '../../services/restaurantProfileService';

const ready = { id: 'restaurant-id', name: 'Cafe', address: 'Jaipur', profile_image_url: 'https://images.test/owner.jpg',
  cover_image_url: 'https://images.test/cover.jpg', business_upi_id: 'cafe@bank', status: 'active', owner_status: 'active',
  onboarding_required: true, email_verified_at: new Date(), firebase_uid: 'uid', google_subject: 'subject', requires_google_link: false };
const bytes = Buffer.from([255,216,255,224,0,0,0,0,0,0,0,0]);
const file = { fieldname: 'ownerPhoto', originalname: 'photo.jpg', mimetype: 'image/jpeg', size: bytes.length, buffer: bytes };

describe('restaurant profile completion and uploads', () => {
  const prior = { flag: process.env.OWNER_PROFILE_ACTIVATION_ENABLED, cloud: process.env.CLOUDINARY_URL };
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.OWNER_PROFILE_ACTIVATION_ENABLED = 'true';
    process.env.CLOUDINARY_URL = 'cloudinary://test:key@cloud';
    (pool.query as jest.Mock).mockResolvedValue({ rows: [ready] });
  });
  afterAll(() => {
    if (prior.flag === undefined) delete process.env.OWNER_PROFILE_ACTIVATION_ENABLED;
    else process.env.OWNER_PROFILE_ACTIVATION_ENABLED = prior.flag;
    if (prior.cloud === undefined) delete process.env.CLOUDINARY_URL;
    else process.env.CLOUDINARY_URL = prior.cloud;
  });
  it('enables ordering only at complete setup for a new restaurant', () => {
    expect(summarizeProfile(ready)).toMatchObject({ completionPercent: 100, complete: true, orderingEnabled: true });
    expect(summarizeProfile({ ...ready, business_upi_id: null })).toMatchObject({ complete: false, orderingEnabled: false, missing: ['businessUpi'] });
  });
  it.each(['name','address','profile_image_url','cover_image_url','business_upi_id','email_verified_at','firebase_uid'])('blocks incomplete required field %s', (field) => {
    expect(summarizeProfile({ ...ready, [field]: null }).orderingEnabled).toBe(false);
  });
  it('does not silently disable legacy restaurants during rollout', () => {
    expect(summarizeProfile({ ...ready, onboarding_required: false, business_upi_id: null, profile_image_url: null }))
      .toMatchObject({ complete: false, orderingEnabled: true });
  });
  it.each([{ status: 'disabled' }, { owner_status: 'disabled' }, { requires_google_link: true }])('cannot override account restrictions: %j', (override) => {
    expect(summarizeProfile({ ...ready, ...override }).orderingEnabled).toBe(false);
  });
  it.each(['upi://pay?pa=x@y','https://example.test','bad', 'name@', 'a@bank', '<script>@bank'])('rejects invalid business UPI %s', (upi) => {
    expect(() => validateBusinessUpi(upi)).toThrow();
  });
  it('normalizes UPI syntax without claiming bank verification', () => {
    expect(validateBusinessUpi(' Cafe.Store@Bank ')).toBe('cafe.store@bank');
  });
  it('binds payment details to the authenticated owner', async () => {
    await setBusinessUpi('owner-id', 'cafe@bank');
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('WHERE owner_id=$2'), ['cafe@bank', 'owner-id']);
  });
  it('does not return private Firebase identifiers or verified email dates', async () => {
    const setup = await getOwnerProfileSetup('owner-id');
    expect(setup).not.toHaveProperty('firebase_uid');
    expect(setup).not.toHaveProperty('email_verified_at');
  });
  it('rejects SVG or renamed content before contacting the image provider', () => {
    expect(() => validateProfileImage({ ...file, buffer: Buffer.from('<svg></svg>') })).toThrow();
    expect(() => validateProfileImage({ ...file, mimetype: 'image/svg+xml' })).toThrow();
    expect(cloudinary.uploader.upload_stream).not.toHaveBeenCalled();
  });
  it('rejects false size declarations and oversized images', () => {
    expect(() => validateProfileImage({ ...file, size: 0 })).toThrow();
    const large = Buffer.alloc(5 * 1024 * 1024 + 1); bytes.copy(large);
    expect(() => validateProfileImage({ ...file, buffer: large, size: large.length })).toThrow();
  });
  it('does not use a placeholder URL when Cloudinary is unconfigured', async () => {
    delete process.env.CLOUDINARY_URL;
    await expect(uploadOwnerProfileImages('owner-id', { ownerPhoto: file })).rejects.toMatchObject({ statusCode: 503 });
    expect(pool.connect).not.toHaveBeenCalled();
  });
  it('rejects provider decode failure without changing stored photos', async () => {
    (cloudinary.uploader.upload_stream as jest.Mock).mockImplementation((_options, callback) => ({
      end: () => callback(new Error('decode error'), undefined),
    }));
    await expect(uploadOwnerProfileImages('owner-id', { ownerPhoto: file })).rejects.toMatchObject({ code: 'IMAGE_UPLOAD_FAILED' });
    expect(pool.connect).not.toHaveBeenCalled();
  });
  it('stores a decoded/re-encoded provider image using owner-scoped SQL', async () => {
    (cloudinary.uploader.upload_stream as jest.Mock).mockImplementation((_options, callback) => ({
      end: () => callback(null, { secure_url: 'https://res.cloudinary.com/test/owner.jpg' }),
    }));
    const query = jest.fn().mockResolvedValue({ rows: [] });
    const release = jest.fn();
    (pool.connect as jest.Mock).mockResolvedValue({ query, release });
    await uploadOwnerProfileImages('owner-id', { ownerPhoto: file });
    expect(query).toHaveBeenCalledWith(expect.stringContaining('WHERE id=$2'), ['https://res.cloudinary.com/test/owner.jpg', 'owner-id']);
    expect(cloudinary.uploader.upload_stream).toHaveBeenCalledWith(expect.objectContaining({ resource_type: 'image', format: 'jpg' }), expect.any(Function));
    expect(query).toHaveBeenCalledWith('COMMIT');
    expect(release).toHaveBeenCalled();
  });
});
