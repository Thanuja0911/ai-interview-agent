import pdfplumber
import io
from typing import Optional


def extract_text_from_pdf(file_bytes: bytes) -> Optional[str]:
    """
    Extract all text from a PDF given its raw bytes.

    We accept bytes (not a file path) because FastAPI gives us
    an UploadFile object — reading it gives bytes, not a path.
    We wrap the bytes in io.BytesIO to give pdfplumber a file-like
    object it can seek through, without writing anything to disk.

    Returns None if extraction fails — callers handle this gracefully.
    """
    try:
        with pdfplumber.open(io.BytesIO(file_bytes)) as pdf:
            pages = []
            for page in pdf.pages:
                text = page.extract_text()
                if text:  # Some pages may be images with no extractable text
                    pages.append(text.strip())

        full_text = "\n\n".join(pages)

        if not full_text.strip():
            return None

        return full_text

    except Exception as e:
        # Log the error but don't crash the server
        print(f"[resume_parser] PDF extraction failed: {e}")
        return None


def clean_resume_text(raw_text: str) -> str:
    """
    Light cleaning pass on extracted resume text.

    pdfplumber sometimes produces extra whitespace, repeated newlines,
    or odd characters from PDF encoding. This keeps the text clean
    before we inject it into prompts — garbage in, garbage out applies
    to LLM context just as much as any data pipeline.
    """
    import re

    # Collapse 3+ consecutive newlines into 2
    text = re.sub(r'\n{3,}', '\n\n', raw_text)

    # Collapse multiple spaces into one
    text = re.sub(r' {2,}', ' ', text)

    # Strip leading/trailing whitespace per line
    lines = [line.strip() for line in text.split('\n')]
    text = '\n'.join(lines)

    return text.strip()


def parse_resume(file_bytes: bytes) -> Optional[str]:
    """
    Public interface for resume parsing.
    Orchestrates extraction + cleaning in one call.

    The main.py endpoint only needs to call this —
    it doesn't need to know about the two-step process.
    """
    raw_text = extract_text_from_pdf(file_bytes)
    if raw_text is None:
        return None
    return clean_resume_text(raw_text)