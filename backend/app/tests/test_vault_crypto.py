"""Unit tests for vault AES-256-GCM encryption utilities."""
import base64

import pytest
from cryptography.exceptions import InvalidTag

from app.core.vault import decrypt_password, encrypt_password, _derive_cabinet_key


# A valid 32-byte base64-encoded master key for tests
MASTER_KEY = base64.b64encode(b"A" * 32).decode()
CABINET_A = "60f1a2b3c4d5e6f708091011"
CABINET_B = "aabbccddeeff001122334455"


def test_roundtrip():
    """Encrypted password can be decrypted back to original plaintext."""
    ciphertext, iv = encrypt_password(MASTER_KEY, CABINET_A, "s3cr3t!")
    plaintext = decrypt_password(MASTER_KEY, CABINET_A, ciphertext, iv)
    assert plaintext == "s3cr3t!"


def test_roundtrip_unicode():
    """Unicode passwords survive roundtrip."""
    original = "päss★wörD123"
    ct, iv = encrypt_password(MASTER_KEY, CABINET_A, original)
    assert decrypt_password(MASTER_KEY, CABINET_A, ct, iv) == original


def test_different_cabinets_produce_different_ciphertexts():
    """Same plaintext encrypted for different cabinets yields different ciphertexts."""
    ct_a, iv_a = encrypt_password(MASTER_KEY, CABINET_A, "same-password")
    ct_b, iv_b = encrypt_password(MASTER_KEY, CABINET_B, "same-password")
    assert ct_a != ct_b


def test_cabinet_key_isolation():
    """Key derived for cabinet A cannot decrypt ciphertext from cabinet B."""
    ct_b, iv_b = encrypt_password(MASTER_KEY, CABINET_B, "secret")
    with pytest.raises((InvalidTag, Exception)):
        decrypt_password(MASTER_KEY, CABINET_A, ct_b, iv_b)


def test_tamper_detection():
    """Modifying the ciphertext raises InvalidTag."""
    ct, iv = encrypt_password(MASTER_KEY, CABINET_A, "unchanged")
    raw = base64.b64decode(ct)
    # Flip a byte in the ciphertext body (not just the tag)
    tampered_raw = bytearray(raw)
    tampered_raw[0] ^= 0xFF
    tampered_ct = base64.b64encode(bytes(tampered_raw)).decode()
    with pytest.raises((InvalidTag, Exception)):
        decrypt_password(MASTER_KEY, CABINET_A, tampered_ct, iv)


def test_iv_tamper_detection():
    """Modifying the IV raises InvalidTag."""
    ct, iv = encrypt_password(MASTER_KEY, CABINET_A, "unchanged")
    raw_iv = base64.b64decode(iv)
    tampered_iv = bytearray(raw_iv)
    tampered_iv[0] ^= 0xFF
    with pytest.raises((InvalidTag, Exception)):
        decrypt_password(MASTER_KEY, CABINET_A, ct, base64.b64encode(bytes(tampered_iv)).decode())


def test_unique_ivs_per_encryption():
    """Each call to encrypt_password generates a unique IV."""
    _, iv1 = encrypt_password(MASTER_KEY, CABINET_A, "same")
    _, iv2 = encrypt_password(MASTER_KEY, CABINET_A, "same")
    assert iv1 != iv2


def test_derive_cabinet_key_different_per_cabinet():
    """Different cabinet IDs produce different derived keys."""
    key_a = _derive_cabinet_key(MASTER_KEY, CABINET_A)
    key_b = _derive_cabinet_key(MASTER_KEY, CABINET_B)
    assert key_a != key_b


def test_derive_cabinet_key_32_bytes():
    """Derived key is always 32 bytes (256 bits)."""
    key = _derive_cabinet_key(MASTER_KEY, CABINET_A)
    assert len(key) == 32
