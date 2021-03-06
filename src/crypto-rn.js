// @flow
import type { CryptoBase } from './crypto'
import type { EncryptedData } from './types'
import { EncryptError, DecryptError } from './types'
import type {
  PlainDataEncodingType,
  EncryptedDataEncodingType,
  CRYPTO_ALGORITHM
} from './types'

const algorithm: CRYPTO_ALGORITHM = 'aes-256-gcm'

export type AesGcmEncryptedData = {
  iv: string,
  tag: string,
  content: string
}

export type AesGcmCryptoModule = {
  decrypt(
    base64Ciphertext: string,
    base64Key: string,
    iv: string,
    tag: string,
    isBinary: boolean
  ): Promise<string>,
  encrypt(
    plainText: string,
    inBinary: boolean,
    base64Key: string
  ): Promise<AesGcmEncryptedData>
}

export type MD5Module = {
  stringMd5(data: string): string,
  binaryMd5(data: string | ArrayBuffer): string
}

export type PBKDF2Module = {
  hash(
    password: ArrayBuffer | string,
    salt: ArrayBuffer | string,
    iterations: number,
    keyLength: number,
    algorithm: 'SHA512'
  ): Promise<ArrayBuffer>
}

const keyBase64Memo: { [string]: string } = {}

export default class CryptoBaseRN implements CryptoBase {
  crypto: AesGcmCryptoModule
  md5: MD5Module
  pbkdf2: PBKDF2Module
  constructor(
    crypto: AesGcmCryptoModule,
    md5: MD5Module,
    pbkdf2: PBKDF2Module
  ) {
    this.crypto = crypto
    this.md5 = md5
    this.pbkdf2 = pbkdf2
  }

  /**
   * @private
   */
  encodeKeyToBase64(key: string): string {
    const base64 =
      keyBase64Memo[key] || Buffer.from(key, 'utf8').toString('base64')
    return (keyBase64Memo[key] = base64)
  }

  /**
   * @returns {string} The derived key
   */
  async deriveKey(
    password: string,
    salt: string | Buffer,
    iter: number
  ): Promise<string> {
    const bufSalt = salt instanceof Buffer ? salt : Buffer.from(salt, 'hex')
    const abSalt = bufSalt.buffer.slice(
      bufSalt.byteOffset,
      bufSalt.byteOffset + bufSalt.byteLength
    )
    const derivation = await this.pbkdf2.hash(
      password,
      abSalt,
      iter,
      256 / 8,
      'SHA512'
    )
    const buffer = Buffer.from(derivation)
    return buffer.toString('base64').substring(0, 32)
  }

  calcMD5Hash(
    content: string | Buffer,
    outputEncoding: 'base64' | 'hex'
  ): string {
    const data =
      content instanceof Buffer
        ? content.toString('binary')
        : Buffer.from(content, 'base64').toString('binary')
    const hexHash = this.md5.binaryMd5(data)
    return outputEncoding === 'hex'
      ? hexHash
      : Buffer.from(hexHash, 'hex').toString('base64')
  }

  async encrypt(
    key: string,
    data: string | Buffer,
    opts?: {
      outputEncoding?: EncryptedDataEncodingType,
      inputEncoding?: PlainDataEncodingType
    }
  ): Promise<EncryptedData> {
    const { outputEncoding, inputEncoding } = opts || {}
    if (typeof key !== 'string') {
      throw new EncryptError('Invalid key. it must be a String')
    }

    const keyBase64 = this.encodeKeyToBase64(key)
    const isBinary =
      inputEncoding === 'binary' ||
      inputEncoding === 'base64' ||
      data instanceof Buffer
    const plainData = data instanceof Buffer ? data.toString('base64') : data
    const sealed = await this.crypto.encrypt(plainData, isBinary, keyBase64)

    let encrypted
    if (typeof outputEncoding !== 'string') {
      encrypted = Buffer.from(sealed.content, 'base64')
    } else {
      if (outputEncoding === 'base64') {
        encrypted = sealed.content
      } else {
        const buf = Buffer.from(sealed.content, 'base64')
        encrypted =
          !outputEncoding || outputEncoding === 'binary'
            ? buf
            : buf.toString(outputEncoding)
      }
    }

    return {
      algorithm: algorithm,
      content: encrypted,
      iv: sealed.iv,
      tag: sealed.tag
    }
  }

  async decrypt(
    key: string,
    data: EncryptedData,
    opts: {
      outputEncoding?: PlainDataEncodingType,
      inputEncoding: EncryptedDataEncodingType
    }
  ): Promise<*> {
    const { inputEncoding, outputEncoding } = opts || {}
    if (typeof key !== 'string') {
      throw new DecryptError('Invalid key. it must be a String')
    }
    if (typeof data !== 'object') {
      throw new DecryptError('Invalid data, it must be an Object')
    }

    const keyBase64 = this.encodeKeyToBase64(key)
    const isBinary =
      !outputEncoding ||
      outputEncoding === 'binary' ||
      outputEncoding === 'base64'
    let ciphertext: string
    if (data.content instanceof Buffer) {
      ciphertext = data.content.toString('base64')
    } else if (inputEncoding === 'base64') {
      ciphertext = data.content
    } else if (typeof inputEncoding === 'string') {
      ciphertext = Buffer.from(data.content, inputEncoding).toString('base64')
    } else {
      throw new DecryptError('Invalid data, it must be an Object')
    }
    const unsealed = await this.crypto.decrypt(
      ciphertext,
      keyBase64,
      data.iv,
      data.tag,
      isBinary
    )

    return outputEncoding === 'binary'
      ? Buffer.from(unsealed, 'base64')
      : unsealed
  }
}
