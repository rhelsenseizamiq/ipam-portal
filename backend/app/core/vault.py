"""Vault encryption utilities — AES-256-GCM with per-cabinet HKDF key derivation.

Pure functions with no FastAPI dependencies. Import these into services only.
"""
import base64
import os

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.hashes import SHA256
from cryptography.hazmat.primitives.kdf.hkdf import HKDF


def _derive_cabinet_key(master_key_b64: str, cabinet_id: str) -> bytes:
    """Derive a per-cabinet 256-bit AES key using HKDF-SHA256."""
    master_key = base64.b64decode(master_key_b64)
    return HKDF(
        algorithm=SHA256(),
        length=32,
        salt=cabinet_id.encode(),
        info=b"cabinet-vault",
    ).derive(master_key)


def encrypt_password(master_key_b64: str, cabinet_id: str, plaintext: str) -> tuple[str, str]:
    """Encrypt a plaintext password with AES-256-GCM.

    Returns:
        (ciphertext_b64, iv_b64) — both base64-encoded strings safe for MongoDB storage.
    """
    key = _derive_cabinet_key(master_key_b64, cabinet_id)
    iv = os.urandom(12)
    ciphertext = AESGCM(key).encrypt(iv, plaintext.encode(), None)
    return base64.b64encode(ciphertext).decode(), base64.b64encode(iv).decode()


def decrypt_password(
    master_key_b64: str,
    cabinet_id: str,
    ciphertext_b64: str,
    iv_b64: str,
) -> str:
    """Decrypt a ciphertext produced by encrypt_password.

    Raises:
        cryptography.exceptions.InvalidTag: if the ciphertext has been tampered with.
    """
    key = _derive_cabinet_key(master_key_b64, cabinet_id)
    iv = base64.b64decode(iv_b64)
    ciphertext = base64.b64decode(ciphertext_b64)
    return AESGCM(key).decrypt(iv, ciphertext, None).decode()
