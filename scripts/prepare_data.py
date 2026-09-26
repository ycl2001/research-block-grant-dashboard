#!/usr/bin/env python3
"""Prepare Research Block Grant data for the static dashboard.

The source workbooks are read without modification. This script uses only the
Python standard library so the project remains easy to reproduce.
"""

from __future__ import annotations

import argparse
import csv
import re
import sys
from collections import Counter, defaultdict
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Iterable
from xml.etree import ElementTree as ET
from zipfile import BadZipFile, ZipFile


RBG_FILENAME = "Research block grants time series 2021-2026.xlsx"
HDR_FILENAME = "Higher degree by research student completions time series.xlsx"
RBG_SHEET = "Table 1"
HDR_SHEET = "Table 1"
START_YEAR = 2017
END_YEAR = 2026

MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PACKAGE_REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
NS = {"m": MAIN_NS, "r": REL_NS, "p": PACKAGE_REL_NS}


class DataValidationError(RuntimeError):
    """Raised when a source workbook does not match the expected structure."""


def _column_name(cell_reference: str) -> str:
    match = re.match(r"[A-Z]+", cell_reference)
    if not match:
        raise DataValidationError(f"Invalid cell reference: {cell_reference}")
    return match.group(0)


def read_xlsx_sheet(path: Path, sheet_name: str) -> list[dict[str, str | None]]:
    """Read cached cell values from one worksheet in an .xlsx file."""
    with ZipFile(path) as archive:
        shared_strings: list[str] = []
        if "xl/sharedStrings.xml" in archive.namelist():
            root = ET.fromstring(archive.read("xl/sharedStrings.xml"))
            for item in root.findall("m:si", NS):
                shared_strings.append(
                    "".join(node.text or "" for node in item.iterfind(".//m:t", NS))
                )

        workbook = ET.fromstring(archive.read("xl/workbook.xml"))
        relationships = ET.fromstring(
            archive.read("xl/_rels/workbook.xml.rels")
        )
        relationship_targets = {
            item.attrib["Id"]: "xl/" + item.attrib["Target"].lstrip("/")
            for item in relationships
        }

        worksheet_path: str | None = None
        sheets = workbook.find("m:sheets", NS)
        if sheets is None:
            raise DataValidationError(f"No worksheets found in {path.name}")
        for sheet in sheets:
            if sheet.attrib.get("name") == sheet_name:
                relationship_id = sheet.attrib[f"{{{REL_NS}}}id"]
                worksheet_path = relationship_targets[relationship_id]
                break
        if worksheet_path is None:
            available = [sheet.attrib.get("name", "") for sheet in sheets]
            raise DataValidationError(
                f"Sheet {sheet_name!r} not found in {path.name}; found {available}"
            )

        worksheet = ET.fromstring(archive.read(worksheet_path))
        sheet_data = worksheet.find("m:sheetData", NS)
        if sheet_data is None:
            return []

        rows: list[dict[str, str | None]] = []
        for row in sheet_data.findall("m:row", NS):
            values: dict[str, str | None] = {"_row": row.attrib.get("r")}
            for cell in row.findall("m:c", NS):
                reference = cell.attrib.get("r", "")
                column = _column_name(reference)
                cell_type = cell.attrib.get("t")
                value_node = cell.find("m:v", NS)
                inline_node = cell.find("m:is", NS)

                if cell_type == "s" and value_node is not None:
                    value = shared_strings[int(value_node.text or "0")]
                elif cell_type == "inlineStr" and inline_node is not None:
                    value = "".join(
                        node.text or ""
                        for node in inline_node.iterfind(".//m:t", NS)
                    )
                elif value_node is not None:
                    value = value_node.text
                else:
                    value = None
                values[column] = value
            rows.append(values)
        return rows


def find_table(
    rows: list[dict[str, str | None]], required_headers: set[str]
) -> list[dict[str, str]]:
    """Locate a header row and map subsequent worksheet rows by header name."""
    for index, row in enumerate(rows[:25]):
        header_by_column = {
            column: value.strip()
            for column, value in row.items()
            if column != "_row" and isinstance(value, str) and value.strip()
        }
        if required_headers.issubset(set(header_by_column.values())):
            records: list[dict[str, str]] = []
            for source_row in rows[index + 1 :]:
                mapped = {
                    header: (source_row.get(column) or "")
                    for column, header in header_by_column.items()
                }
                if any(value != "" for value in mapped.values()):
                    mapped["_source_row"] = source_row.get("_row") or ""
                    records.append(mapped)
            return records
    raise DataValidationError(
        f"Could not locate required headers: {sorted(required_headers)}"
    )


def parse_year(value: str, source_row: str) -> int:
    try:
        year = int(Decimal(value))
    except (InvalidOperation, ValueError):
        raise DataValidationError(
            f"Invalid year {value!r} at source row {source_row}"
        ) from None
    return year


def parse_decimal(value: str, field: str, source_row: str) -> Decimal:
    try:
        number = Decimal(value)
    except InvalidOperation:
        raise DataValidationError(
            f"Non-numeric {field} value {value!r} at source row {source_row}"
        ) from None
    if not number.is_finite():
        raise DataValidationError(
            f"Non-finite {field} value {value!r} at source row {source_row}"
        )
    return number


def decimal_text(value: Decimal, places: int | None = None) -> str:
    if places is not None:
        return f"{value:.{places}f}"
    integral = value.to_integral_value()
    return str(integral) if value == integral else format(value, "f")


def ensure_unique(records: Iterable[dict], key_fields: tuple[str, ...]) -> None:
    counts = Counter(tuple(record[field] for field in key_fields) for record in records)
    duplicates = [key for key, count in counts.items() if count > 1]
    if duplicates:
        raise DataValidationError(
            f"Duplicate records for {key_fields}: {duplicates[:10]}"
        )


def prepare_rbg(path: Path) -> tuple[list[dict[str, str]], dict[int, Decimal]]:
    required_headers = {
        "HEP Code",
        "HEP Name",
        "Year",
        "State",
        "Cohort",
        "RSP",
        "RTP",
        "Total",
    }
    source_rows = find_table(read_xlsx_sheet(path, RBG_SHEET), required_headers)
    records: list[dict] = []

    for row in source_rows:
        year = parse_year(row["Year"], row["_source_row"])
        if not START_YEAR <= year <= END_YEAR:
            continue
        missing = [
            field
            for field in ("HEP Code", "HEP Name", "Year", "RSP", "RTP")
            if row[field] == ""
        ]
        if missing:
            raise DataValidationError(
                f"Missing {missing} at source row {row['_source_row']}"
            )

        rsp = parse_decimal(row["RSP"], "RSP", row["_source_row"])
        rtp = parse_decimal(row["RTP"], "RTP", row["_source_row"])
        total = rsp + rtp
        supplied_total = parse_decimal(
            row["Total"], "Total", row["_source_row"]
        )
        if abs(total - supplied_total) > Decimal("0.01"):
            raise DataValidationError(
                f"RSP + RTP does not reconcile to Total at source row "
                f"{row['_source_row']}"
            )

        records.append(
            {
                "HEP_Code": row["HEP Code"].strip(),
                "Provider_Name": row["HEP Name"].strip(),
                "Year": year,
                "State": row["State"].strip(),
                "Cohort": row["Cohort"].strip(),
                "RSP": rsp,
                "RTP": rtp,
                "Total_RBG": total,
            }
        )

    ensure_unique(records, ("HEP_Code", "Year"))
    year_counts = Counter(record["Year"] for record in records)
    expected_years = set(range(START_YEAR, END_YEAR + 1))
    if set(year_counts) != expected_years:
        raise DataValidationError(
            f"Expected RBG years {START_YEAR}-{END_YEAR}; found {sorted(year_counts)}"
        )

    records_by_year: dict[int, list[dict]] = defaultdict(list)
    for record in records:
        records_by_year[record["Year"]].append(record)

    top_five_shares: dict[int, Decimal] = {}
    for year, year_records in records_by_year.items():
        sector_total = sum(
            (record["Total_RBG"] for record in year_records), Decimal("0")
        )
        ranked = sorted(
            year_records,
            key=lambda record: (-record["Total_RBG"], record["HEP_Code"]),
        )
        for rank, record in enumerate(ranked, start=1):
            record["Sector_Total_RBG"] = sector_total
            record["Provider_Share"] = (
                Decimal("100") * record["Total_RBG"] / sector_total
            )
            record["Annual_Rank"] = rank
        top_five_shares[year] = sum(
            (record["Provider_Share"] for record in ranked[:5]), Decimal("0")
        )
        for record in year_records:
            record["Top_Five_Share"] = top_five_shares[year]

    endpoint_records = {
        year: {
            record["HEP_Code"]: record
            for record in records_by_year[year]
        }
        for year in (START_YEAR, END_YEAR)
    }
    continuing_codes = set(endpoint_records[START_YEAR]) & set(
        endpoint_records[END_YEAR]
    )
    movement = {
        code: endpoint_records[END_YEAR][code]["Provider_Share"]
        - endpoint_records[START_YEAR][code]["Provider_Share"]
        for code in continuing_codes
    }

    output_rows: list[dict[str, str]] = []
    for record in sorted(
        records, key=lambda item: (item["Year"], item["Annual_Rank"])
    ):
        code = record["HEP_Code"]
        output_rows.append(
            {
                "HEP_Code": code,
                "Provider_Name": record["Provider_Name"],
                "Year": str(record["Year"]),
                "State": record["State"],
                "Cohort": record["Cohort"],
                "RSP": decimal_text(record["RSP"]),
                "RTP": decimal_text(record["RTP"]),
                "Total_RBG": decimal_text(record["Total_RBG"]),
                "Sector_Total_RBG": decimal_text(record["Sector_Total_RBG"]),
                "Provider_Share": decimal_text(record["Provider_Share"], 10),
                "Annual_Rank": str(record["Annual_Rank"]),
                "Top_Five_Share": decimal_text(record["Top_Five_Share"], 10),
                "Endpoint_Comparable": "Yes" if code in continuing_codes else "No",
                "Share_Movement_PP": (
                    decimal_text(movement[code], 10)
                    if code in continuing_codes
                    else ""
                ),
            }
        )
    return output_rows, top_five_shares


def prepare_hdr(path: Path) -> list[dict[str, str]]:
    required_headers = {
        "HEP Code",
        "Higher Education Provider",
        "Year",
        "Doctorate by Research",
        "Masters by Research",
    }
    source_rows = find_table(read_xlsx_sheet(path, HDR_SHEET), required_headers)
    records: list[dict[str, str]] = []

    for row in source_rows:
        year = parse_year(row["Year"], row["_source_row"])
        if year not in (2023, 2024):
            continue
        missing = [
            field
            for field in ("HEP Code", "Higher Education Provider", "Year")
            if row[field] == ""
        ]
        if missing:
            raise DataValidationError(
                f"Missing HDR {missing} at source row {row['_source_row']}"
            )

        doctorate = row["Doctorate by Research"].strip()
        masters = row["Masters by Research"].strip()
        values: list[Decimal] = []
        suppressed = False
        for field, value in (("Doctorate", doctorate), ("Masters", masters)):
            if value == "<5":
                suppressed = True
            else:
                values.append(parse_decimal(value, field, row["_source_row"]))

        records.append(
            {
                "HEP_Code": row["HEP Code"].strip(),
                "Provider_Name": row["Higher Education Provider"].strip(),
                "Year": str(year),
                "Doctorate_Completions": doctorate,
                "Masters_Completions": masters,
                "Total_HDR_Completions": (
                    "" if suppressed else decimal_text(sum(values, Decimal("0")))
                ),
                "Suppression_Present": "Yes" if suppressed else "No",
            }
        )

    ensure_unique(records, ("HEP_Code", "Year"))
    return sorted(records, key=lambda item: (item["Year"], item["HEP_Code"]))


def write_csv(path: Path, rows: list[dict[str, str]]) -> None:
    if not rows:
        raise DataValidationError(f"No data available for {path.name}")
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle, fieldnames=list(rows[0]), lineterminator="\n"
        )
        writer.writeheader()
        writer.writerows(rows)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--raw-dir",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "data" / "raw",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path(__file__).resolve().parents[1] / "data" / "processed",
    )
    args = parser.parse_args()

    rbg_path = args.raw_dir / RBG_FILENAME
    hdr_path = args.raw_dir / HDR_FILENAME
    for source in (rbg_path, hdr_path):
        if not source.exists():
            raise DataValidationError(f"Missing source workbook: {source}")

    rbg_rows, top_five = prepare_rbg(rbg_path)
    hdr_rows = prepare_hdr(hdr_path)
    write_csv(args.output_dir / "rbg_dashboard.csv", rbg_rows)
    write_csv(args.output_dir / "hdr_context.csv", hdr_rows)

    uts_rows = {
        int(row["Year"]): row for row in rbg_rows if row["HEP_Code"] == "3016"
    }
    top_five_change = top_five[END_YEAR] - top_five[START_YEAR]
    uts_change = Decimal(uts_rows[END_YEAR]["Provider_Share"]) - Decimal(
        uts_rows[START_YEAR]["Provider_Share"]
    )
    print(f"Prepared {len(rbg_rows)} RBG rows and {len(hdr_rows)} HDR rows.")
    print(
        f"Top-five share: {top_five[START_YEAR]:.6f}% ({START_YEAR}) to "
        f"{top_five[END_YEAR]:.6f}% ({END_YEAR}); {top_five_change:+.6f} pp."
    )
    print(
        f"UTS share: {Decimal(uts_rows[START_YEAR]['Provider_Share']):.6f}% "
        f"({START_YEAR}) to {Decimal(uts_rows[END_YEAR]['Provider_Share']):.6f}% "
        f"({END_YEAR}); {uts_change:+.6f} pp."
    )
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (DataValidationError, OSError, KeyError, BadZipFile) as error:
        print(f"Data preparation failed: {error}", file=sys.stderr)
        raise SystemExit(1)
