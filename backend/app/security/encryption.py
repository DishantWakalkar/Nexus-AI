import os
import base64
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC


def _get_fernet() -> Fernet:
    """
    Derives a Fernet key from SECRET_KEY env var.
    Never stores the key — always derives it at runtime.
    """
    secret = os.environ["SECRET_KEY"].encode()
    salt = os.environ.get("ENCRYPTION_SALT", "nexusai_salt_v1").encode()
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=480_000,
    )
    key = base64.urlsafe_b64encode(kdf.derive(secret))
    return Fernet(key)


def encrypt_token(plain_token: str) -> str:
    """Encrypt an OAuth token before storing in DB."""
    f = _get_fernet()
    return f.encrypt(plain_token.encode()).decode()


def decrypt_token(encrypted_token: str) -> str:
    """Decrypt an OAuth token retrieved from DB."""
    f = _get_fernet()
    return f.decrypt(encrypted_token.encode()).decode()