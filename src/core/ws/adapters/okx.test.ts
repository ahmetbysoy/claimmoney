import { describe, expect, it } from 'vitest'
import { crc32Signed, okxChecksum, shouldVerifyOkxChecksum } from './okx'

describe('OKX order-book checksum', () => {
  it('uses the exchange-compatible signed CRC32 representation', () => {
    expect(crc32Signed('123456789')).toBe(-873187034)
  })

  it('interleaves bid and ask price/size strings', () => {
    const bids: [string, string][] = [['3366.1', '7'], ['3366', '6']]
    const asks: [string, string][] = [['3366.8', '9'], ['3368', '8']]
    expect(okxChecksum(bids, asks)).toBe(-1881014294)
  })

  it('treats checksum zero as the exchange not supplying CRC data', () => {
    expect(shouldVerifyOkxChecksum(0)).toBe(false)
    expect(shouldVerifyOkxChecksum(-1881014294)).toBe(true)
  })
})
