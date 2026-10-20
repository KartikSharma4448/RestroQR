jest.mock('../../config/database', () => ({ __esModule: true, default: { query: jest.fn() } }));
jest.mock('cloudinary', () => ({ v2: { config: jest.fn(), uploader: { upload_stream: jest.fn(), destroy: jest.fn() } } }));
import pool from '../../config/database';
import { v2 as cloudinary } from 'cloudinary';
import { setMenuEmoji, uploadMenuImage, validateMenuEmoji } from '../../services/menuMediaService';

const bytes = Buffer.from([255, 216, 255, 224, 0, 0, 0, 0, 0, 0, 0, 0]);
const file = { fieldname: 'image', originalname: 'dish.jpg', mimetype: 'image/jpeg', size: bytes.length, buffer: bytes };
const oldFlag = process.env.MENU_MEDIA_ENABLED;
const oldCloud = process.env.CLOUDINARY_URL;
beforeEach(() => {
  jest.resetAllMocks();
  process.env.MENU_MEDIA_ENABLED = 'true';
  process.env.CLOUDINARY_URL = 'cloudinary://test:key@cloud';
  (pool.query as jest.Mock).mockResolvedValue({ rows: [{ id: 'dish', emoji: null, imageUrl: 'https://res.cloudinary.com/test/dish.jpg' }] });
  (cloudinary.uploader.upload_stream as jest.Mock).mockImplementation((_options, cb) => ({
    end: () => cb(null, { secure_url: 'https://res.cloudinary.com/test/dish.jpg', public_id: 'new-dish-asset' }),
  }));
  (cloudinary.uploader.destroy as jest.Mock).mockResolvedValue({ result: 'ok' });
});
afterAll(() => {
  if (oldFlag === undefined) delete process.env.MENU_MEDIA_ENABLED; else process.env.MENU_MEDIA_ENABLED = oldFlag;
  if (oldCloud === undefined) delete process.env.CLOUDINARY_URL; else process.env.CLOUDINARY_URL = oldCloud;
});

it.each(['\u{1F355}', '\u{2615}', '\u{2615}\uFE0F', '\u{1F468}\u200D\u{1F373}'])('accepts one emoji %s', value => {
  expect(validateMenuEmoji(value)).toBe(value);
});
it.each(['pizza', '<script>', '', 'xx', '\u{1F355}\u{1F355}', '\u200D', 5, undefined, {}])('rejects invalid emoji %j', value => {
  expect(() => validateMenuEmoji(value)).toThrow();
});
it('allows explicit removal', () => { expect(validateMenuEmoji(null)).toBeNull(); });
it('uses owner-scoped SQL and switches from image to emoji', async () => {
  await setMenuEmoji('dish', 'restaurant', '\u{1F355}');
  expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('image_url=NULL'), ['\u{1F355}', 'dish', 'restaurant']);
  expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('restaurant_id=$3'), expect.any(Array));
});
it('rejects another restaurant item without uploading', async () => {
  (pool.query as jest.Mock).mockResolvedValue({ rows: [] });
  await expect(uploadMenuImage('dish', 'other', file)).rejects.toMatchObject({ statusCode: 404 });
  expect(cloudinary.uploader.upload_stream).not.toHaveBeenCalled();
});
it('rejects renamed SVG, invalid bytes, oversized files and missing files', async () => {
  await expect(uploadMenuImage('dish', 'restaurant', { ...file, buffer: Buffer.from('<svg/>') })).rejects.toMatchObject({ statusCode: 400 });
  const large = Buffer.alloc(5 * 1024 * 1024 + 1); bytes.copy(large);
  await expect(uploadMenuImage('dish', 'restaurant', { ...file, buffer: large, size: large.length })).rejects.toMatchObject({ statusCode: 400 });
  await expect(uploadMenuImage('dish', 'restaurant')).rejects.toMatchObject({ statusCode: 400 });
  expect(cloudinary.uploader.upload_stream).not.toHaveBeenCalled();
});
it('fails closed when the flag or storage is missing', async () => {
  process.env.MENU_MEDIA_ENABLED = 'false';
  await expect(setMenuEmoji('dish', 'restaurant', null)).rejects.toMatchObject({ statusCode: 503 });
  await expect(uploadMenuImage('dish', 'restaurant', file)).rejects.toMatchObject({ statusCode: 503 });
  process.env.MENU_MEDIA_ENABLED = 'true';
  delete process.env.CLOUDINARY_URL;
  await expect(uploadMenuImage('dish', 'restaurant', file)).rejects.toMatchObject({ code: 'IMAGE_STORAGE_UNAVAILABLE' });
});
it('saves only a successful provider URL and clears the emoji', async () => {
  await uploadMenuImage('dish', 'restaurant', file);
  expect(cloudinary.uploader.upload_stream).toHaveBeenCalledWith(expect.objectContaining({ format: 'jpg', timeout: 30000 }), expect.any(Function));
  expect(pool.query).toHaveBeenLastCalledWith(expect.stringContaining('emoji=NULL'), ['https://res.cloudinary.com/test/dish.jpg', 'dish', 'restaurant']);
  expect(cloudinary.uploader.destroy).not.toHaveBeenCalled();
});
it('does not save anything after a provider failure', async () => {
  (cloudinary.uploader.upload_stream as jest.Mock).mockImplementation((_options, cb) => ({ end: () => cb(new Error('provider failure')) }));
  await expect(uploadMenuImage('dish', 'restaurant', file)).rejects.toMatchObject({ code: 'IMAGE_UPLOAD_FAILED' });
  expect(pool.query).toHaveBeenCalledTimes(1);
});
it('cleans up only the new asset if the item disappears during upload', async () => {
  (pool.query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: 'dish' }] }).mockResolvedValueOnce({ rows: [] });
  await expect(uploadMenuImage('dish', 'restaurant', file)).rejects.toMatchObject({ statusCode: 404 });
  expect(cloudinary.uploader.destroy).toHaveBeenCalledWith('new-dish-asset', expect.any(Object));
});
