import hashlib
import os
import sys
from typing import List

ALPHABET = r"""0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ!§$%/()^*~#|,:._-€@\?"[{\'&>;+}=]<"""

wordlist: List[str] = None


def _init_wordlist():
    global wordlist
    if wordlist is not None:
        return
    wordlist = open('wordlist.txt').read().splitlines()


def generate_mnemonic(num):
    _init_wordlist()
    mnemonic = []
    for _ in range(12):
        # chunk = num & 0b1111111111111111111111
        chunk = num & 0b11111111111
        mnemonic.append(wordlist[chunk])
        num >>= 11
    return ' '.join(mnemonic)


def retrieve_chunks(lst):
    _init_wordlist()
    return [wordlist.index(w) for w in lst]


def find_impostors(lst):
    _init_wordlist()
    return (word for word in lst if word not in wordlist)


def retrieve_bitstr(chunks):
    num = 0
    for chunk in reversed(chunks):
        num <<= 11
        num |= chunk
    checksum = num & 0b1111
    num >>= 4
    bitstr = num.to_bytes(16, byteorder='big')
    return bitstr, checksum


def calc_cecksum(bitstr):
    return hashlib.sha256(bitstr).digest()[1] & 0b1111


def hash_extend(seed):
    value = hashlib.sha256(seed).digest()
    return int.from_bytes(value, byteorder='big')


def convert_to_string(nr):
    out = []
    while nr >= 96:
        out.append(ALPHABET[nr % 96])
        nr //= 96
    out.append(ALPHABET[nr])
    return ''.join(out[::-1])


def main(args):
    if len(args) != 2:
        print(f"Usage: {args[0]} generate|retrieve")
        return -1
    
    if args[1] == 'generate':
        seed = os.urandom(16)
        checksum = calc_cecksum(seed)
        
        # print(seed)
        binstr = int.from_bytes(seed, byteorder='big')
        binstr <<= 4
        binstr |= checksum
        mnemonic = generate_mnemonic(binstr)
        print(f"Mnemonic: {mnemonic}")
        print(f"Password: '{convert_to_string(hash_extend(seed))}'")
    elif args[1] == 'retrieve':
        mnemonic = input('Enter mnemonic: ').split()
        if len(mnemonic) != 12:
            print("Error: Mnemonic must consist of 12 words!", file=sys.stderr)
            return -1
        try:
            chunks = retrieve_chunks(mnemonic)
        except ValueError as e:
            print("Error: The following word(s) don't belong to the wordlist:")
            for impostor in find_impostors(mnemonic):
                print(f"  - {impostor!r}")
            return -1
        bitstr, checksum = retrieve_bitstr(chunks)
        if checksum != calc_cecksum(bitstr):
            print("Error: Checksum doesn't match! Probably you misstyped something.")
            return -1
        res_str = convert_to_string(hash_extend(bitstr))
        print(f"Password: '{res_str}', {len(res_str)}")
    else:
        print(f"Usage: {args[0]} generate|retrieve")
        return -1

    return 0

if __name__ == '__main__':
    exit(main(sys.argv))