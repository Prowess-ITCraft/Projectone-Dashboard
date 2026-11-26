"""What a checklist evidence file may be, decided from its content and not from what it is called.

A file is accepted only when its first bytes are a JPEG, PNG, HEIC or PDF signature AND its extension is one that
kind uses, so a renamed program or a PDF called `photo.jpg` is refused. The size and count limits are settings
(`evidence_max_mb`, `evidence_max_files`), the one place to change them.
"""

from dataclasses import dataclass


@dataclass(frozen=True)
class Kind:
    key: str
    label: str
    media_type: str
    extensions: tuple[str, ...]


KINDS: dict[str, Kind] = {
    "jpeg": Kind("jpeg", "JPG", "image/jpeg", ("jpg", "jpeg")),
    "png": Kind("png", "PNG", "image/png", ("png",)),
    "heic": Kind("heic", "HEIC", "image/heic", ("heic", "heif")),
    "pdf": Kind("pdf", "PDF", "application/pdf", ("pdf",)),
}
ACCEPTED_TEXT = "JPG, PNG, HEIC or PDF"

# The `ftyp` brands that mean a HEIF image
_HEIC_BRANDS = {b"heic", b"heix", b"heim", b"heis", b"hevc", b"hevx", b"mif1", b"msf1"}


def sniff(content: bytes) -> str | None:
    """The kind the bytes really are, or None when they are none of the accepted kinds."""
    if content[:3] == b"\xff\xd8\xff":
        return "jpeg"
    if content[:8] == b"\x89PNG\r\n\x1a\n":
        return "png"
    if content[:5] == b"%PDF-":
        return "pdf"
    if content[4:8] == b"ftyp" and content[8:12] in _HEIC_BRANDS:
        return "heic"
    return None


def extension_of(name: str) -> str:
    return name.rsplit(".", 1)[-1].lower() if "." in name else ""


def check(name: str, content: bytes) -> Kind | None:
    """The kind of an acceptable file, or None when the content is not an accepted kind or the name claims another."""
    key = sniff(content)
    if key is None:
        return None
    kind = KINDS[key]
    return kind if extension_of(name) in kind.extensions else None
