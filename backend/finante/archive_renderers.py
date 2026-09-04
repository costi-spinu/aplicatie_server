"""Renderere locale, fără servicii externe, pentru arhivele financiare."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from hashlib import sha256
from html import escape
from pathlib import Path
import re
import unicodedata
from zipfile import ZIP_DEFLATED, ZipFile


def _display(value):
    if value is None:
        return ""
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return str(value)


def _xml_text(value):
    text = _display(value)
    text = re.sub(
        r"[^\x09\x0A\x0D\x20-\uD7FF\uE000-\uFFFD]",
        "",
        text,
    )
    return escape(text, quote=False)


def _column_name(index):
    result = ""
    while index:
        index, remainder = divmod(index - 1, 26)
        result = chr(65 + remainder) + result
    return result


def _sheet_xml(rows):
    xml_rows = []
    for row_index, row in enumerate(rows, start=1):
        cells = []
        for column_index, value in enumerate(row, start=1):
            reference = f"{_column_name(column_index)}{row_index}"
            style = ' s="1"' if row_index == 1 else ""
            if isinstance(value, (int, float, Decimal)) and not isinstance(value, bool):
                cells.append(
                    f'<c r="{reference}"{style}><v>{_xml_text(value)}</v></c>'
                )
            else:
                cells.append(
                    f'<c r="{reference}"{style} t="inlineStr"><is><t xml:space="preserve">'
                    f"{_xml_text(value)}</t></is></c>"
                )
        xml_rows.append(f'<row r="{row_index}">{"".join(cells)}</row>')

    return (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
        f'<sheetData>{"".join(xml_rows)}</sheetData></worksheet>'
    )


def _record_rows(records):
    rows = [
        [
            "Tip",
            "Data",
            "Descriere / categorie",
            "Sumă",
            "Monedă",
            "Sumă EUR",
            "Utilizator",
            "Sursă",
        ]
    ]
    sections = (
        ("Venit", "venituri"),
        ("Credit", "credite"),
        ("Cheltuială fixă", "cheltuieli_fixe"),
        ("Cheltuială variabilă", "cheltuieli_variabile"),
    )
    for label, key in sections:
        for item in records.get(key, []):
            description = (
                item.get("descriere")
                or item.get("denumire")
                or item.get("categorie")
                or ""
            )
            rows.append(
                [
                    label,
                    item.get("data", ""),
                    description,
                    Decimal(str(item.get("suma") or "0")),
                    item.get("moneda", ""),
                    Decimal(str(item.get("suma_eur") or "0")),
                    item.get("username", ""),
                    item.get("sursa", ""),
                ]
            )
    return rows


def write_xlsx(path, payload):
    report = payload["report"]
    summary_rows = [
        ["Raport financiar arhivat", "Valoare"],
        ["Cont", payload["owner"]["username"]],
        ["Perioadă început", payload["period"]["start"]],
        ["Perioadă sfârșit", payload["period"]["end"]],
        ["Venit brut EUR", Decimal(str(report.get("venit_brut") or "0"))],
        ["Credite EUR", Decimal(str(report.get("deduceri_credite") or "0"))],
        ["Cheltuieli fixe EUR", Decimal(str(report.get("fixe_total") or "0"))],
        ["Cheltuieli variabile EUR", Decimal(str(report.get("variabile") or "0"))],
        ["Ieșiri totale EUR", Decimal(str(report.get("iesiri_totale") or "0"))],
        ["Economii EUR", Decimal(str(report.get("economii") or "0"))],
    ]
    records_rows = _record_rows(payload["records"])

    content_types = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>"""
    package_rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>"""
    workbook = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets><sheet name="Sumar" sheetId="1" r:id="rId1"/><sheet name="Înregistrări" sheetId="2" r:id="rId2"/></sheets>
</workbook>"""
    workbook_rels = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/>
  <Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>"""
    styles = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>
  <fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs>
</styleSheet>"""

    with ZipFile(path, "w", compression=ZIP_DEFLATED) as workbook_file:
        workbook_file.writestr("[Content_Types].xml", content_types)
        workbook_file.writestr("_rels/.rels", package_rels)
        workbook_file.writestr("xl/workbook.xml", workbook)
        workbook_file.writestr("xl/_rels/workbook.xml.rels", workbook_rels)
        workbook_file.writestr("xl/styles.xml", styles)
        workbook_file.writestr("xl/worksheets/sheet1.xml", _sheet_xml(summary_rows))
        workbook_file.writestr("xl/worksheets/sheet2.xml", _sheet_xml(records_rows))

    with ZipFile(path) as workbook_file:
        if workbook_file.testzip() is not None:
            raise ValueError("Fișierul Excel generat nu a trecut verificarea ZIP.")


def _pdf_safe_text(value):
    text = unicodedata.normalize("NFKD", _display(value))
    text = text.encode("ascii", "ignore").decode("ascii")
    return text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")


def _pdf_lines(payload):
    report = payload["report"]
    lines = [
        "RAPORT FINANCIAR ARHIVAT",
        f"Cont: {payload['owner']['username']}",
        f"Perioada: {payload['period']['start']} - {payload['period']['end']}",
        "",
        f"Venit brut: {report.get('venit_brut', '0.00')} EUR",
        f"Credite: {report.get('deduceri_credite', '0.00')} EUR",
        f"Cheltuieli fixe: {report.get('fixe_total', '0.00')} EUR",
        f"Cheltuieli variabile: {report.get('variabile', '0.00')} EUR",
        f"Iesiri totale: {report.get('iesiri_totale', '0.00')} EUR",
        f"Economii: {report.get('economii', '0.00')} EUR",
        "",
        "INREGISTRARI",
    ]
    for row in _record_rows(payload["records"])[1:]:
        line = " | ".join(_display(value) for value in row)
        # Helvetica la 8pt încape rezonabil cu aproximativ 105 caractere/A4.
        lines.append(line[:105])
    return lines


def write_pdf(path, payload):
    lines = _pdf_lines(payload)
    chunks = [lines[index : index + 52] for index in range(0, len(lines), 52)] or [[]]
    page_ids = [4 + index * 2 for index in range(len(chunks))]
    objects = {
        1: b"<< /Type /Catalog /Pages 2 0 R >>",
        2: (
            f"<< /Type /Pages /Kids [{' '.join(f'{item} 0 R' for item in page_ids)}] "
            f"/Count {len(page_ids)} >>"
        ).encode("ascii"),
        3: b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    }

    for index, page_lines in enumerate(chunks):
        page_id = page_ids[index]
        content_id = page_id + 1
        content_parts = ["BT", "/F1 8 Tf", "40 805 Td", "12 TL"]
        for line in page_lines:
            content_parts.append(f"({_pdf_safe_text(line)}) Tj")
            content_parts.append("T*")
        content_parts.append("ET")
        content = "\n".join(content_parts).encode("ascii")
        objects[page_id] = (
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] "
            f"/Resources << /Font << /F1 3 0 R >> >> /Contents {content_id} 0 R >>"
        ).encode("ascii")
        objects[content_id] = (
            f"<< /Length {len(content)} >>\nstream\n".encode("ascii")
            + content
            + b"\nendstream"
        )

    output = bytearray(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
    offsets = {0: 0}
    for object_id in range(1, max(objects) + 1):
        offsets[object_id] = len(output)
        output.extend(f"{object_id} 0 obj\n".encode("ascii"))
        output.extend(objects[object_id])
        output.extend(b"\nendobj\n")
    xref_offset = len(output)
    output.extend(f"xref\n0 {max(objects) + 1}\n".encode("ascii"))
    output.extend(b"0000000000 65535 f \n")
    for object_id in range(1, max(objects) + 1):
        output.extend(f"{offsets[object_id]:010d} 00000 n \n".encode("ascii"))
    output.extend(
        (
            f"trailer\n<< /Size {max(objects) + 1} /Root 1 0 R >>\n"
            f"startxref\n{xref_offset}\n%%EOF\n"
        ).encode("ascii")
    )
    Path(path).write_bytes(output)

    if not output.startswith(b"%PDF-") or not output.rstrip().endswith(b"%%EOF"):
        raise ValueError("Fișierul PDF generat nu a trecut verificarea.")


def file_metadata(path, mime_type):
    path = Path(path)
    content = path.read_bytes()
    return {
        "name": path.name,
        "mime_type": mime_type,
        "size": len(content),
        "sha256": sha256(content).hexdigest(),
    }


def render_archive_files(directory, payload):
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    pdf_path = directory / "raport.pdf"
    excel_path = directory / "raport.xlsx"
    write_pdf(pdf_path, payload)
    write_xlsx(excel_path, payload)
    pdf_path.chmod(0o600)
    excel_path.chmod(0o600)
    return {
        "pdf": file_metadata(pdf_path, "application/pdf"),
        "excel": file_metadata(
            excel_path,
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        ),
    }
