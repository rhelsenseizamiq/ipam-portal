import bcrypt as _bcrypt

# bcrypt silently truncated at 72 bytes in v4; v5 raises ValueError instead.
# Encode and truncate explicitly so behaviour is consistent across versions.
_BCRYPT_MAX_BYTES = 72


def _encode(plain: str) -> bytes:
    return plain.encode()[:_BCRYPT_MAX_BYTES]


def hash_password(plain: str) -> str:
    return _bcrypt.hashpw(_encode(plain), _bcrypt.gensalt(rounds=12)).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return _bcrypt.checkpw(_encode(plain), hashed.encode())
