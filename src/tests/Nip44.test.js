import { describe, it, expect, vi, beforeEach } from 'vitest';
import { encryptContentNip44 } from '../utils/nip44';
import { ndk } from '../lib/ndkSingleton';

// Mock NDK signer.user().encrypt
beforeEach(() => {
  const mockSigner = {
    encrypt: vi.fn().mockImplementation(async (recipient, plaintext, opts) => {
      // simple deterministic fake cipher
      return `enc(${plaintext})for(${recipient})`;
    })
  };
  ndk.signer = {
    user: () => mockSigner
  };
});

describe('nip44 encryption helper', () => {
  it('encrypts plaintext and returns nip44 tags', async () => {
    const plaintext = '123';
    const recipient = 'abc_pubkeyhex';
    const { cipherText, nip44Tags } = await encryptContentNip44(plaintext, recipient);
    expect(cipherText).toBe(`enc(${plaintext})for(${recipient})`);
    expect(nip44Tags).toEqual([
      ['p', recipient],
      ['encryption_algo', 'nip44']
    ]);
  });
}); 