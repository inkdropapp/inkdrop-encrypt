// @flow
import type { EncryptedData } from './types'
import type { PlainDataEncodingType, EncryptedDataEncodingType } from './types'

export interface CryptoBase {
  deriveKey(
    password: string,
    salt: string | Buffer,
    iter: number
  ): Promise<string>;
  calcMD5Hash(
    binaryContent: string | Buffer,
    outputEncoding: 'base64' | 'hex'
  ): string;
  encrypt(
    key: string,
    data: string | Buffer,
    opts?: {
      outputEncoding?: EncryptedDataEncodingType,
      inputEncoding?: PlainDataEncodingType
    }
  ): Promise<EncryptedData>;
  decrypt(
    key: string,
    data: EncryptedData,
    opts: {
      outputEncoding?: PlainDataEncodingType,
      inputEncoding: EncryptedDataEncodingType
    }
  ): Promise<*>;
}
