// Minimal LZ-String decoder for Obsidian Excalidraw `compressed-json` blocks.
// Adapted to only support `decompressFromBase64`.

const KEY_STR_BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='

const reverseMapCache: Record<string, Record<string, number>> = {}

function getBaseValue(alphabet: string, character: string): number {
  if (!reverseMapCache[alphabet]) {
    const map: Record<string, number> = {}
    for (let i = 0; i < alphabet.length; i += 1) {
      map[alphabet.charAt(i)] = i
    }
    reverseMapCache[alphabet] = map
  }
  return reverseMapCache[alphabet][character]
}

function lzDecompress(
  length: number,
  resetValue: number,
  getNextValue: (index: number) => number,
): string | null {
  const dictionary: string[] = []
  let enlargeIn = 4
  let dictSize = 4
  let numBits = 3
  let entry = ''
  const result: string[] = []
  let i: number
  let w: string
  let bits: number
  let resb: number
  let maxpower: number
  let power: number
  let c: string
  const data = {
    val: getNextValue(0),
    position: resetValue,
    index: 1,
  }

  for (i = 0; i < 3; i += 1) {
    dictionary[i] = String(i)
  }

  bits = 0
  maxpower = 2 ** 2
  power = 1
  while (power !== maxpower) {
    resb = data.val & data.position
    data.position >>= 1
    if (data.position === 0) {
      data.position = resetValue
      data.val = getNextValue(data.index += 1)
    }
    bits |= (resb > 0 ? 1 : 0) * power
    power <<= 1
  }

  switch (bits) {
    case 0:
      bits = 0
      maxpower = 2 ** 8
      power = 1
      while (power !== maxpower) {
        resb = data.val & data.position
        data.position >>= 1
        if (data.position === 0) {
          data.position = resetValue
          data.val = getNextValue(data.index += 1)
        }
        bits |= (resb > 0 ? 1 : 0) * power
        power <<= 1
      }
      c = String.fromCharCode(bits)
      break
    case 1:
      bits = 0
      maxpower = 2 ** 16
      power = 1
      while (power !== maxpower) {
        resb = data.val & data.position
        data.position >>= 1
        if (data.position === 0) {
          data.position = resetValue
          data.val = getNextValue(data.index += 1)
        }
        bits |= (resb > 0 ? 1 : 0) * power
        power <<= 1
      }
      c = String.fromCharCode(bits)
      break
    case 2:
      return ''
    default:
      return null
  }

  dictionary[3] = c
  w = c
  result.push(c)

  while (true) {
    if (data.index > length) return ''

    bits = 0
    maxpower = 2 ** numBits
    power = 1
    while (power !== maxpower) {
      resb = data.val & data.position
      data.position >>= 1
      if (data.position === 0) {
        data.position = resetValue
        data.val = getNextValue(data.index += 1)
      }
      bits |= (resb > 0 ? 1 : 0) * power
      power <<= 1
    }

    let cc = bits
    switch (cc) {
      case 0:
        bits = 0
        maxpower = 2 ** 8
        power = 1
        while (power !== maxpower) {
          resb = data.val & data.position
          data.position >>= 1
          if (data.position === 0) {
            data.position = resetValue
            data.val = getNextValue(data.index += 1)
          }
          bits |= (resb > 0 ? 1 : 0) * power
          power <<= 1
        }
        dictionary[dictSize] = String.fromCharCode(bits)
        cc = dictSize
        dictSize += 1
        enlargeIn -= 1
        break
      case 1:
        bits = 0
        maxpower = 2 ** 16
        power = 1
        while (power !== maxpower) {
          resb = data.val & data.position
          data.position >>= 1
          if (data.position === 0) {
            data.position = resetValue
            data.val = getNextValue(data.index += 1)
          }
          bits |= (resb > 0 ? 1 : 0) * power
          power <<= 1
        }
        dictionary[dictSize] = String.fromCharCode(bits)
        cc = dictSize
        dictSize += 1
        enlargeIn -= 1
        break
      case 2:
        return result.join('')
      default:
        break
    }

    if (enlargeIn === 0) {
      enlargeIn = 2 ** numBits
      numBits += 1
    }

    if (dictionary[cc]) {
      entry = dictionary[cc]
    } else if (cc === dictSize) {
      entry = w + w.charAt(0)
    } else {
      return null
    }

    result.push(entry)

    dictionary[dictSize] = w + entry.charAt(0)
    dictSize += 1
    enlargeIn -= 1
    w = entry

    if (enlargeIn === 0) {
      enlargeIn = 2 ** numBits
      numBits += 1
    }
  }
}

export function decompressFromBase64LzString(input: string): string | null {
  if (input == null) return ''
  if (input === '') return null
  return lzDecompress(input.length, 32, (index: number) => getBaseValue(KEY_STR_BASE64, input.charAt(index)))
}
