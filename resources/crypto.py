import math
import os
import random
import hashlib
import functools

from typing import List
from operator import itemgetter

export = lambda x: x  # public api
wordlist: List[str] = None

FRAGMENTS = [
    "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",     #  characters
    "0123456789",                                               #  digits
    "!§$%/()´`^°*~#|,:._-€@",                                    #  punctuation
    "\\?\"[{'&>;+}=]<"                                          #  special
]


def requires_wordlist(f):
    @functools.wraps(f)
    def wrapper(*args, **kwargs):
        _init_wordlist()
        return f(*args, **kwargs)
    return wrapper


def inject_config(f):
    @functools.wraps(f)
    def wrapper(binstr, config):
        f_mapping = itemgetter('characters', 'digits', 'punctuation', 'special')(config)
        chars = ''.join([b[0] for b in zip(FRAGMENTS, f_mapping) if b[1]])
        return f(binstr, chars, config["length"])
    return wrapper


def _init_wordlist():
    global wordlist
    if wordlist is not None:
        return
    wordlist = get_wordlist()


@requires_wordlist
def generate_mnemonic(num):
    mnemonic = []
    for _ in range(12):
        chunk = num & 0b11111111111
        mnemonic.append(wordlist[chunk])
        num >>= 11
    return mnemonic


@requires_wordlist
def retrieve_chunks(lst):
    return [wordlist.index(w) for w in lst]


@requires_wordlist
def find_impostors(lst):
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


def calc_checksum(bitstr):
    return hashlib.sha256(bitstr).digest()[1] & 0b1111


def hash_extend(seed, config):
    seed = bytearray(seed)
    seed.append(config["length"])
    config = itemgetter('characters', 'digits', 'punctuation', 'special')(config)
    seed.append(
        functools.reduce(lambda c, p: c | p, (i<<abs(s-3) for s, i in enumerate(map(int, config))))
    )
    return hashlib.sha512(seed).digest()


@inject_config
def encode_log(binstr, chars, length):
    gen_bitmask = lambda n: (1<<n)-1
    def rtv(leftchar, leftbits):
        tmp = leftchar >> leftbits
        if (tmp & high_bitmask) < len(chars):
            return leftbits, high_bitmask
        return leftbits+1, low_bitmask
    
    def pad_random(start_seed):
        rand = random.Random(start_seed)
        while not check_len():
            yield rand.getrandbits(8)

    num_maxbits = math.ceil(math.log(len(chars), 2))
    num_minbits = math.floor(math.log(len(chars), 2))
    
    high_bitmask = gen_bitmask(num_maxbits)
    low_bitmask = gen_bitmask(num_minbits)

    res = []
    leftchar = 0
    leftbits = 0
    def code(iterable):  # encode
        nonlocal leftchar, leftbits
        for c in iterable:
            # Shift into our buffer, and output any 6bits ready
            leftchar = ((leftchar << 8) | c) & 0xffff
            leftbits += 1
            leftbits, BITMASK = rtv(leftchar, leftbits)
            res.append(chars[(leftchar >> leftbits) & BITMASK])
            if leftbits >= num_minbits:
                leftbits -= num_minbits
                _, BITMASK = rtv(leftchar, leftbits)
                res.append(chars[(leftchar >> leftbits) & BITMASK])
    
    def end():  # flush left bits
        nonlocal leftchar, leftbits
        if leftbits == 0:
            return
        # PAD to 7-bit
        orig = leftchar
        leftchar = (leftchar & gen_bitmask(leftbits)) << (num_maxbits-leftbits) 
        if leftchar >= len(chars):  # as always: 7-bit might be to large
            # PAD to 6-bit
            leftchar = orig
            leftchar = (leftchar & gen_bitmask(leftbits)) << (num_minbits-leftbits) 
        res.append(chars[leftchar])
    
    def check_len():  # check if buffer is long enough
        more = 1 if leftbits != 0 else 0
        return len(res) >= length + more
    
    code(binstr)
    if check_len():
        # if buffer is already long enough, flush bits and end
        end()
    else:
        # add pseudo-random seeded pattern
        code(pad_random(res[-1]))
        end()
    
    return ''.join(res[:length])


@export
def generate_phrase(config):
    seed = os.urandom(16)
    checksum = calc_checksum(seed)
    
    binstr = (int.from_bytes(seed, byteorder='big') << 4) | checksum
    return generate_mnemonic(binstr), encode_log(hash_extend(seed, config), config)


@export
def from_phrase(phrase, config):
    chunks = retrieve_chunks(phrase)
    bitstr, checksum = retrieve_bitstr(chunks)
    if checksum != calc_checksum(bitstr):
        raise Exception("ChecksumError: Checksum doesn't match! Probably you misstyped something.")

    return phrase, encode_log(hash_extend(bitstr, config), config)


@export
def check_checksum(phrase):
    chunks = retrieve_chunks(phrase)
    bitstr, checksum = retrieve_bitstr(chunks)
    return checksum == calc_checksum(bitstr)
