"""Convert a PDF to DOCX with pdf2docx. Usage: pdf_to_docx.py <in.pdf> <out.docx>"""
import sys

from pdf2docx import Converter

src, dst = sys.argv[1], sys.argv[2]
cv = Converter(src)
try:
    cv.convert(dst)
finally:
    cv.close()
