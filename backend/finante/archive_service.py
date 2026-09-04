"""Arhivare sigură a înregistrărilor financiare lunare pe discul local."""

from __future__ import annotations

from contextlib import contextmanager
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation
from hashlib import sha256
import json
import os
from pathlib import Path
import secrets
import shutil

from django.conf import settings
from django.db import transaction
from django.db.models import Min, Q
from django.utils import timezone

from .archive_renderers import render_archive_files
from .models import (
    CheltuialaFixa,
    CheltuialaVariabila,
    Credit,
    FinancialArchive,
    Venit,
)
from .utils import get_luna_bugetara, get_user_budget_period, get_user_budget_start_day


ARCHIVABLE_MODELS = {
    "venituri": Venit,
    "credite": Credit,
    "cheltuieli_fixe": CheltuialaFixa,
    "cheltuieli_variabile": CheltuialaVariabila,
}


class ArchiveError(RuntimeError):
    pass


class ArchiveDataChanged(ArchiveError):
    pass


def _money(value):
    try:
        return Decimal(str(value or "0")).quantize(Decimal("0.01"))
    except (InvalidOperation, TypeError, ValueError):
        return Decimal("0.00")


def _money_text(value):
    return f"{_money(value):.2f}"


def _percentage(amount, total):
    amount = _money(amount)
    total = _money(total)
    if total <= 0:
        return "0.00"
    return _money_text((amount / total) * Decimal("100"))


def _default_converter(amount, currency):
    # Import local: views importă acest serviciu pentru endpointuri.
    from .views import convert_amount_to_eur

    return convert_amount_to_eur(amount, currency)


def _base_record(item, converter):
    return {
        "id": item.id,
        "user_id": item.user_id,
        "username": item.user.username,
        "data": item.data.isoformat(),
        "suma": _money_text(item.suma),
        "moneda": item.moneda,
        "suma_eur": _money_text(converter(item.suma, item.moneda)),
    }


def collect_financial_records(user_ids, start, end, converter=None):
    converter = converter or _default_converter
    user_ids = list(user_ids)

    venituri = []
    for item in (
        Venit.objects.filter(user_id__in=user_ids, data__range=(start, end))
        .select_related("user")
        .order_by("data", "id")
    ):
        venituri.append(
            {
                **_base_record(item, converter),
                "sursa": item.sursa or "manual",
                "salary_schedule_id": item.salary_schedule_id,
            }
        )

    credite = []
    for item in (
        Credit.objects.filter(user_id__in=user_ids, data__range=(start, end))
        .select_related("user")
        .order_by("data", "id")
    ):
        credite.append(
            {
                **_base_record(item, converter),
                "denumire": item.denumire or "Credit",
                "sursa": "credit",
            }
        )

    cheltuieli_fixe = []
    for item in (
        CheltuialaFixa.objects.filter(
            user_id__in=user_ids,
            data__range=(start, end),
        )
        .select_related("user")
        .order_by("data", "id")
    ):
        cheltuieli_fixe.append(
            {
                **_base_record(item, converter),
                "descriere": item.descriere or "Cheltuială fixă",
                "sursa": item.sursa or "manual",
                "automatizare_id": item.automatizare_id,
            }
        )

    cheltuieli_variabile = []
    for item in (
        CheltuialaVariabila.objects.filter(
            user_id__in=user_ids,
            data__range=(start, end),
        )
        .select_related("user")
        .order_by("data", "id")
    ):
        cheltuieli_variabile.append(
            {
                **_base_record(item, converter),
                "categorie": item.categorie,
                "descriere": item.descriere or "",
                "sursa": "variabilă",
            }
        )

    return {
        "venituri": venituri,
        "credite": credite,
        "cheltuieli_fixe": cheltuieli_fixe,
        "cheltuieli_variabile": cheltuieli_variabile,
    }


def record_counts(records):
    return {key: len(records.get(key, [])) for key in ARCHIVABLE_MODELS}


def records_digest(records):
    canonical = json.dumps(
        records,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return sha256(canonical).hexdigest()


def merge_records(*collections):
    merged = {key: {} for key in ARCHIVABLE_MODELS}
    for records in collections:
        for key in ARCHIVABLE_MODELS:
            for item in records.get(key, []):
                identity = (int(item.get("user_id") or 0), int(item.get("id") or 0))
                merged[key][identity] = item
    return {
        key: sorted(values.values(), key=lambda item: (item.get("data", ""), item.get("id", 0)))
        for key, values in merged.items()
    }


def filter_records(records, user_ids, start, end):
    allowed_users = {int(value) for value in user_ids}
    start_text = start.isoformat()
    end_text = end.isoformat()
    return {
        key: [
            item
            for item in records.get(key, [])
            if int(item.get("user_id") or 0) in allowed_users
            and start_text <= str(item.get("data", "")) <= end_text
        ]
        for key in ARCHIVABLE_MODELS
    }


def build_report_from_records(records, start, end):
    income_total = sum(
        (_money(item.get("suma_eur")) for item in records["venituri"]),
        Decimal("0"),
    )
    credits_total = sum(
        (_money(item.get("suma_eur")) for item in records["credite"]),
        Decimal("0"),
    )
    fixed_auto_rows = [
        item for item in records["cheltuieli_fixe"] if item.get("sursa") == "automat"
    ]
    fixed_manual_rows = [
        item for item in records["cheltuieli_fixe"] if item.get("sursa") != "automat"
    ]
    fixed_auto_total = sum(
        (_money(item.get("suma_eur")) for item in fixed_auto_rows),
        Decimal("0"),
    )
    fixed_manual_total = sum(
        (_money(item.get("suma_eur")) for item in fixed_manual_rows),
        Decimal("0"),
    )
    category_totals = {}
    for item in records["cheltuieli_variabile"]:
        category = item.get("categorie") or "neprevazute"
        category_totals[category] = category_totals.get(category, Decimal("0")) + _money(
            item.get("suma_eur")
        )
    variable_total = sum(category_totals.values(), Decimal("0"))
    deductions_total = credits_total + fixed_auto_total
    net_income = income_total - deductions_total
    budget_expenses = fixed_manual_total + variable_total
    fixed_total = fixed_manual_total + fixed_auto_total
    total_outflows = deductions_total + budget_expenses
    savings = net_income - budget_expenses

    return {
        "luna": end.strftime("%Y-%m"),
        "start": start.isoformat(),
        "end": end.isoformat(),
        "calculat_la": end.isoformat(),
        "venit_brut": _money_text(income_total),
        "deduceri_credite": _money_text(credits_total),
        "deduceri_automate": _money_text(fixed_auto_total),
        "deduceri_total": _money_text(deductions_total),
        "venit_net": _money_text(net_income),
        "venit": _money_text(net_income),
        "fixe_manuale": _money_text(fixed_manual_total),
        "fixe_automate": _money_text(fixed_auto_total),
        "fixe_total": _money_text(fixed_total),
        "variabile": _money_text(variable_total),
        "cheltuieli_buget": _money_text(budget_expenses),
        "iesiri_totale": _money_text(total_outflows),
        "economii": _money_text(savings),
        "categorii": [
            {
                "categorie": category,
                "total": _money_text(total),
                "procent_venit_brut": _percentage(total, income_total),
                "procent_venit_disponibil": _percentage(total, net_income),
            }
            for category, total in sorted(category_totals.items())
        ],
        "venituri": records["venituri"],
        "credite": records["credite"],
        "fixe_manuale_detalii": fixed_manual_rows,
        "fixe_automate_detalii": fixed_auto_rows,
        "variabile_detalii": records["cheltuieli_variabile"],
    }


def _archive_root():
    root = Path(settings.FINANCIAL_ARCHIVE_ROOT).resolve()
    root.mkdir(parents=True, exist_ok=True, mode=0o700)
    root.chmod(0o700)
    return root


@contextmanager
def archive_lock():
    root = _archive_root()
    lock_path = root / ".archive.lock"
    lock_path.touch(mode=0o600, exist_ok=True)
    lock_file = lock_path.open("r+")
    try:
        try:
            import fcntl

            fcntl.flock(lock_file.fileno(), fcntl.LOCK_EX)
        except ImportError:
            pass
        yield
    finally:
        try:
            import fcntl

            fcntl.flock(lock_file.fileno(), fcntl.LOCK_UN)
        except ImportError:
            pass
        lock_file.close()


def _safe_archive_dir(archive):
    root = _archive_root()
    relative = Path(archive.relative_dir)
    if relative.is_absolute() or ".." in relative.parts:
        raise ArchiveError("Calea arhivei nu este sigură.")
    resolved = (root / relative).resolve()
    if root != resolved and root not in resolved.parents:
        raise ArchiveError("Calea arhivei iese din directorul permis.")
    return resolved


def _manifest_path(archive):
    return _safe_archive_dir(archive) / "manifest.json"


def load_manifest(archive):
    manifest_path = _manifest_path(archive)
    if not manifest_path.is_file():
        raise ArchiveError("Manifestul arhivei lipsește.")
    content = manifest_path.read_bytes()
    digest = sha256(content).hexdigest()
    if archive.manifest_sha256 and digest != archive.manifest_sha256:
        raise ArchiveError("Manifestul arhivei nu mai corespunde semnăturii salvate.")
    payload = json.loads(content.decode("utf-8"))
    if str(payload.get("archive_id")) != str(archive.id):
        raise ArchiveError("Manifestul nu aparține arhivei solicitate.")
    if int(payload.get("owner", {}).get("id") or 0) != archive.user_id:
        raise ArchiveError("Proprietarul manifestului nu corespunde.")
    return payload


def _write_archive_files(archive, payload):
    archive_dir = _safe_archive_dir(archive)
    archive_dir.mkdir(parents=True, exist_ok=True, mode=0o700)
    archive_dir.chmod(0o700)
    staging = archive_dir / f".staging-{secrets.token_hex(8)}"
    staging.mkdir(mode=0o700)

    try:
        files = render_archive_files(staging, payload)
        payload = {**payload, "files": files}
        manifest_bytes = json.dumps(
            payload,
            ensure_ascii=False,
            sort_keys=True,
            indent=2,
        ).encode("utf-8")
        manifest_path = staging / "manifest.json"
        manifest_path.write_bytes(manifest_bytes)
        manifest_path.chmod(0o600)

        # Verifică toate artefactele înainte ca ele să devină versiunea activă.
        verified_payload = json.loads(manifest_path.read_text(encoding="utf-8"))
        if verified_payload.get("source_digest") != payload["source_digest"]:
            raise ArchiveError("Verificarea manifestului a eșuat.")
        for metadata in files.values():
            file_path = staging / metadata["name"]
            if sha256(file_path.read_bytes()).hexdigest() != metadata["sha256"]:
                raise ArchiveError(f"Fișierul {metadata['name']} nu a trecut verificarea.")

        for filename in ("raport.pdf", "raport.xlsx", "manifest.json"):
            os.replace(staging / filename, archive_dir / filename)
        staging.rmdir()
        return files, sha256(manifest_bytes).hexdigest()
    finally:
        if staging.exists():
            shutil.rmtree(staging)


def _load_existing_records(archive):
    if not archive.relative_dir or not _manifest_path(archive).is_file():
        return {key: [] for key in ARCHIVABLE_MODELS}
    try:
        return load_manifest(archive).get("records", {})
    except ArchiveError:
        if archive.status == FinancialArchive.Status.READY:
            raise
        # Un retry după o oprire între rename și commit poate găsi deja
        # manifestul nou, în timp ce hash-ul din DB este încă cel vechi.
        payload = json.loads(_manifest_path(archive).read_text(encoding="utf-8"))
        if (
            str(payload.get("archive_id")) != str(archive.id)
            or int(payload.get("owner", {}).get("id") or 0) != archive.user_id
        ):
            raise ArchiveError("Manifestul intermediar nu aparține arhivei.")
        return payload.get("records", {})


def _delete_snapshot_records(user, start, end, records):
    for key, model in ARCHIVABLE_MODELS.items():
        ids = [int(item["id"]) for item in records.get(key, []) if item.get("id")]
        if not ids:
            continue
        queryset = model.objects.filter(
            user=user,
            data__range=(start, end),
            id__in=ids,
        )
        if queryset.count() != len(set(ids)):
            raise ArchiveDataChanged(
                "Datele s-au schimbat în timpul arhivării; ștergerea a fost oprită."
            )
        queryset.delete()


def archive_period(user, start, end, dry_run=False):
    current_records = collect_financial_records([user.id], start, end)
    current_counts = record_counts(current_records)
    if not any(current_counts.values()):
        return {
            "period_start": start.isoformat(),
            "period_end": end.isoformat(),
            "status": "empty",
            "record_counts": current_counts,
        }
    if dry_run:
        return {
            "period_start": start.isoformat(),
            "period_end": end.isoformat(),
            "status": "dry-run",
            "record_counts": current_counts,
        }

    archive, _created = FinancialArchive.objects.get_or_create(
        user=user,
        period_start=start,
        period_end=end,
        defaults={"cycle_key": end.strftime("%Y-%m")},
    )
    if not archive.relative_dir:
        archive.relative_dir = str(
            Path(f"user-{user.id}")
            / f"{start.isoformat()}_{end.isoformat()}"
            / str(archive.id)
        )

    try:
        existing_records = _load_existing_records(archive)
        all_records = merge_records(existing_records, current_records)
        source_digest = records_digest(all_records)
        report = build_report_from_records(all_records, start, end)
        payload = {
            "schema_version": 1,
            "archive_id": str(archive.id),
            "generated_at": timezone.now().isoformat(),
            "owner": {
                "id": user.id,
                "username": user.username,
            },
            "period": {
                "start": start.isoformat(),
                "end": end.isoformat(),
                "cycle_key": end.strftime("%Y-%m"),
                "start_day": get_user_budget_start_day(user),
            },
            "source_digest": source_digest,
            "record_counts": record_counts(all_records),
            "records": all_records,
            "report": report,
        }
        archive.status = FinancialArchive.Status.BUILDING
        archive.source_digest = source_digest
        archive.record_counts = payload["record_counts"]
        archive.totals = {
            key: report[key]
            for key in (
                "venit_brut",
                "deduceri_credite",
                "fixe_total",
                "variabile",
                "iesiri_totale",
                "economii",
            )
        }
        archive.last_error = ""
        archive.save()

        files, manifest_digest = _write_archive_files(archive, payload)

        with transaction.atomic():
            locked_archive = FinancialArchive.objects.select_for_update().get(pk=archive.pk)
            latest_records = collect_financial_records([user.id], start, end)
            if records_digest(latest_records) != records_digest(current_records):
                raise ArchiveDataChanged(
                    "Datele au fost modificate în timpul generării fișierelor."
                )
            _delete_snapshot_records(user, start, end, current_records)
            locked_archive.status = FinancialArchive.Status.READY
            locked_archive.relative_dir = archive.relative_dir
            locked_archive.source_digest = source_digest
            locked_archive.manifest_sha256 = manifest_digest
            locked_archive.record_counts = payload["record_counts"]
            locked_archive.totals = archive.totals
            locked_archive.files = files
            locked_archive.last_error = ""
            locked_archive.archived_at = timezone.now()
            locked_archive.save()
            archive = locked_archive

        return {
            "id": str(archive.id),
            "period_start": start.isoformat(),
            "period_end": end.isoformat(),
            "status": archive.status,
            "record_counts": archive.record_counts,
        }
    except Exception as exc:
        FinancialArchive.objects.filter(pk=archive.pk).update(
            status=FinancialArchive.Status.FAILED,
            last_error=str(exc)[:2000],
        )
        raise


def oldest_retained_cycle_start(user, as_of=None, keep_cycles=None):
    as_of = as_of or timezone.localdate()
    keep_cycles = max(
        2,
        int(keep_cycles or settings.FINANCIAL_ARCHIVE_KEEP_CYCLES),
    )
    cycle_start, _cycle_end = get_user_budget_period(user, as_of)
    oldest_start = cycle_start
    start_day = get_user_budget_start_day(user)
    for _index in range(keep_cycles - 1):
        oldest_start, _ignored_end = get_luna_bugetara(
            oldest_start - timedelta(days=1),
            start_day=start_day,
        )
    return oldest_start


def _first_financial_date(user):
    values = []
    for model in ARCHIVABLE_MODELS.values():
        value = model.objects.filter(user=user).aggregate(first=Min("data"))["first"]
        if value is not None:
            values.append(value)
    return min(values) if values else None


def archive_old_financial_data(user, as_of=None, keep_cycles=None, dry_run=False):
    as_of = as_of or timezone.localdate()
    cutoff = oldest_retained_cycle_start(user, as_of, keep_cycles)
    first_date = _first_financial_date(user)
    if first_date is None or first_date >= cutoff:
        return {
            "user_id": user.id,
            "username": user.username,
            "cutoff": cutoff.isoformat(),
            "archives": [],
        }

    start_day = get_user_budget_start_day(user)
    cycle_start, cycle_end = get_luna_bugetara(first_date, start_day=start_day)
    results = []
    with archive_lock():
        while cycle_end < cutoff:
            result = archive_period(user, cycle_start, cycle_end, dry_run=dry_run)
            if result["status"] != "empty":
                results.append(result)
            cycle_start = cycle_end + timedelta(days=1)
            cycle_start, cycle_end = get_luna_bugetara(
                cycle_start,
                start_day=start_day,
            )

    return {
        "user_id": user.id,
        "username": user.username,
        "cutoff": cutoff.isoformat(),
        "archives": results,
    }


def ready_archives_for_period(user_ids, start, end):
    return FinancialArchive.objects.filter(
        user_id__in=list(user_ids),
        status=FinancialArchive.Status.READY,
        period_start__lte=end,
        period_end__gte=start,
    ).select_related("user")


def archived_records_for_period(user_ids, start, end):
    collections = []
    for archive in ready_archives_for_period(user_ids, start, end):
        payload = load_manifest(archive)
        collections.append(payload.get("records", {}))
    if not collections:
        return {key: [] for key in ARCHIVABLE_MODELS}
    return filter_records(merge_records(*collections), user_ids, start, end)


def combined_records_for_period(user_ids, start, end):
    archived = archived_records_for_period(user_ids, start, end)
    live = collect_financial_records(user_ids, start, end)
    return merge_records(archived, live)


def archive_contains_date(user, value):
    if not value:
        return False
    return FinancialArchive.objects.filter(
        user=user,
        status=FinancialArchive.Status.READY,
        period_start__lte=value,
        period_end__gte=value,
    ).exists()


def archive_download_path(archive, file_kind):
    if archive.status != FinancialArchive.Status.READY:
        raise ArchiveError("Arhiva nu este pregătită pentru descărcare.")
    if file_kind not in {"pdf", "excel"}:
        raise ArchiveError("Format de arhivă necunoscut.")
    metadata = archive.files.get(file_kind) or {}
    expected_name = "raport.pdf" if file_kind == "pdf" else "raport.xlsx"
    if metadata.get("name") != expected_name:
        raise ArchiveError("Metadatele fișierului nu sunt valide.")
    path = _safe_archive_dir(archive) / expected_name
    if not path.is_file():
        raise ArchiveError("Fișierul arhivat lipsește.")
    if sha256(path.read_bytes()).hexdigest() != metadata.get("sha256"):
        raise ArchiveError("Fișierul arhivat este corupt sau a fost modificat.")
    return path, metadata
