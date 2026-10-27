import io

from docx import Document
from pypdf import PdfReader


class DocumentError(ValueError):
    pass


def extract_document(data: bytes, filename: str) -> str:
    extension = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    try:
        if extension == "txt":
            text = data.decode("utf-8")
        elif extension == "pdf":
            reader = PdfReader(io.BytesIO(data), strict=True)
            if len(reader.pages) > 100:
                raise DocumentError("Document has too many pages")
            text = "\n".join(page.extract_text() or "" for page in reader.pages)
        elif extension == "docx":
            document = Document(io.BytesIO(data))
            text = "\n".join(paragraph.text for paragraph in document.paragraphs)
        else:
            raise DocumentError("Only PDF, DOCX, and TXT documents are supported")
    except DocumentError:
        raise
    except Exception as exc:
        raise DocumentError("The document is malformed or could not be read") from exc
    text = text.replace("\x00", "").strip()
    if not text:
        raise DocumentError("No readable text was found in the document")
    return text[:100_000]
