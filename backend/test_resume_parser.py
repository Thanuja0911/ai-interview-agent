"""
Unit tests for resume_parser.py.

Run with: python -m unittest test_resume_parser -v
from the backend/ directory. Pdfplumber is mocked — no PDF files,
network, or API key required.
"""

import io
import unittest
from unittest.mock import MagicMock, patch

from resume_parser import clean_resume_text, extract_text_from_pdf, parse_resume


class MockPage:
    """Minimal stand-in for a pdfplumber page."""

    def __init__(self, text):
        self._text = text

    def extract_text(self):
        return self._text


def make_pdf_mock(page_texts):
    """Build a mock pdfplumber.open() return value holding the given pages."""
    pdf_mock = MagicMock()
    pdf_mock.__enter__.return_value = pdf_mock
    pdf_mock.pages = [MockPage(text) for text in page_texts]
    return pdf_mock


class ExtractTextFromPdfTests(unittest.TestCase):
    def test_joins_multiple_pages_with_double_newline(self):
        with patch(
            "resume_parser.pdfplumber.open",
            return_value=make_pdf_mock(["Page one", "Page two"]),
        ):
            result = extract_text_from_pdf(b"fake pdf bytes")

        self.assertEqual(result, "Page one\n\nPage two")

    def test_skips_pages_with_no_text(self):
        with patch(
            "resume_parser.pdfplumber.open",
            return_value=make_pdf_mock(["Page one", "", None]),
        ):
            result = extract_text_from_pdf(b"fake pdf bytes")

        self.assertEqual(result, "Page one")

    def test_returns_none_when_no_page_has_text(self):
        with patch(
            "resume_parser.pdfplumber.open",
            return_value=make_pdf_mock(["", None, "   "]),
        ):
            result = extract_text_from_pdf(b"fake pdf bytes")

        self.assertIsNone(result)

    def test_returns_none_and_does_not_raise_on_exception(self):
        with patch("resume_parser.pdfplumber.open", side_effect=Exception("corrupt PDF")):
            result = extract_text_from_pdf(b"garbage bytes")

        self.assertIsNone(result)

    def test_passes_bytes_wrapped_in_bytesio(self):
        with patch(
            "resume_parser.pdfplumber.open",
            return_value=make_pdf_mock(["Page one"]),
        ) as pdf_open:
            extract_text_from_pdf(b"pdf bytes")

        pdf_open.assert_called_once()
        opened_arg = pdf_open.call_args[0][0]
        self.assertIsInstance(opened_arg, io.BytesIO)
        self.assertEqual(opened_arg.getvalue(), b"pdf bytes")


class CleanResumeTextTests(unittest.TestCase):
    def test_collapses_three_or_more_newlines_into_two(self):
        self.assertEqual(
            clean_resume_text("line1\n\n\n\nline2"),
            "line1\n\nline2",
        )

    def test_collapses_runs_of_spaces_into_one(self):
        self.assertEqual(
            clean_resume_text("Senior   Engineer    at  Stripe"),
            "Senior Engineer at Stripe",
        )

    def test_strips_whitespace_per_line_and_wraps(self):
        self.assertEqual(
            clean_resume_text("  \n  padded line  \n\t"),
            "padded line",
        )


class ParseResumeTests(unittest.TestCase):
    def test_extracts_then_cleans_text(self):
        with patch(
            "resume_parser.pdfplumber.open",
            return_value=make_pdf_mock(["Page  one\n\n\n\n  content  "]),
        ):
            result = parse_resume(b"fake pdf bytes")

        self.assertEqual(result, "Page one\n\ncontent")

    def test_returns_none_when_extraction_fails(self):
        with patch("resume_parser.pdfplumber.open", side_effect=Exception("boom")):
            result = parse_resume(b"garbage bytes")

        self.assertIsNone(result)


if __name__ == "__main__":
    unittest.main()