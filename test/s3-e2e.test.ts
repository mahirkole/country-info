import { describe, expect, it } from 'vitest';
import { S3Store } from '../src/object-store.js';

// Needs a signature-checking S3 server: run scripts/dev/s3-e2e.sh.
const ep = process.env.S3_E2E_ENDPOINT;
const d = ep ? describe : describe.skip;

d('S3Store against a signature-checking S3 server', () => {
  const store = (secret = process.env.S3_E2E_SECRET!, now?: () => Date) => new S3Store({ endpoint: ep!, bucket: 'bkt', region: 'eu-west-1', accessKey: process.env.S3_E2E_KEY!, secretKey: secret, prefix: 'pre', now });

  it('puts and gets objects (path with a space), returns null for a missing key', async () => {
    await store().put('commercial/a b.json', Buffer.from('{"x":1}'), 'application/json');
    expect((await store().get('commercial/a b.json'))?.toString()).toBe('{"x":1}');
    expect(await store().get('commercial/missing.json')).toBeNull();
  });

  it('is rejected with a wrong secret key', async () => {
    await expect(store('wrong').put('z', Buffer.from('1'))).rejects.toThrow(/403/);
  });

  it('produces the same presigned signature as boto3 for the same instant', async () => {
    const boto = new URL(process.env.S3_E2E_BOTO_URL!);
    const t = boto.searchParams.get('X-Amz-Date')!;
    const now = new Date(Date.UTC(+t.slice(0, 4), +t.slice(4, 6) - 1, +t.slice(6, 8), +t.slice(9, 11), +t.slice(11, 13), +t.slice(13, 15)));
    const mine = new URL(await store(undefined, () => now).presign('commercial/a b.json', 60));
    expect(mine.pathname).toBe(boto.pathname);
    expect(mine.searchParams.get('X-Amz-Signature')).toBe(boto.searchParams.get('X-Amz-Signature'));
  });
});
