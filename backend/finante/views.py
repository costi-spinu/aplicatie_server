import base64
import binascii
from datetime import date, timedelta
from decimal import Decimal, InvalidOperation
import ipaddress
from pathlib import Path
import re
import secrets
import socket
from urllib.parse import urlparse
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET
from django.db import transaction
from django.db.models.functions import TruncDate
from django.db.models import Sum, Q
from django.contrib.auth.models import User
from django.conf import settings
from django.core.mail import send_mail
from django.http import FileResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
import calendar
from calendar import monthrange

from rest_framework import viewsets, permissions, status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated, IsAdminUser
from rest_framework.exceptions import ValidationError


from .models import (
    Credit,
    DEFAULT_INVESTMENT_CATEGORIES,
    EmailChangeRequest,
    FinancialArchive,
    InvestitieAutomata,
    InvestitieCategorie,
    ObiectivCheltuieliGlobal,
    RealizariTarget,
    SalarySchedule,
    UserProfile,
    Venit,
    CheltuialaFixa,
    CheltuialaFixaAutomata,
    CheltuialaVariabila,
    EconomieVacanta,
    EconomieLunara,
    MiscareFond,
    Fond,
    UserBridge,
)

from .serializers import (
    CreditSerializer,
    RegisterSerializer,
    VenitSerializer,
    CheltuialaFixaSerializer,
    CheltuialaFixaAutomataSerializer,
    CheltuialaVariabilaSerializer,
    EconomieVacantaSerializer,
    EconomieLunaraSerializer,
    InvestitieAutomataSerializer,
    InvestitieCategorieSerializer,
    MiscareFondSerializer,
    ObiectivCheltuieliGlobalSerializer,
    RealizariTargetSerializer,
    SalaryScheduleSerializer,
    UserProfileSerializer,
)

from .utils import (
    DEFAULT_BUDGET_CYCLE_START_DAY,
    clamp_day,
    get_luna_bugetara as perioada_bugetara,
    get_user_budget_period,
    get_user_budget_start_day,
    shift_month,
)
from .utils_users import get_connected_user_ids
from .archive_service import (
    ARCHIVABLE_MODELS,
    ArchiveError,
    archive_contains_date,
    archive_download_path,
    archive_old_financial_data,
    archived_records_for_period,
    build_report_from_records,
    combined_records_for_period,
    load_manifest,
    ready_archives_for_period,
)


class BaseViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        user_ids = get_connected_user_ids(self.request.user)
        return self.queryset.filter(user_id__in=user_ids)

    def perform_create(self, serializer):
        self.ensure_period_is_editable(serializer, user=self.request.user)
        serializer.save(user=self.request.user)

    def perform_update(self, serializer):
        self.ensure_period_is_editable(serializer, user=serializer.instance.user)
        serializer.save()

    def ensure_period_is_editable(self, serializer, user):
        if serializer.Meta.model not in ARCHIVABLE_MODELS.values():
            return
        record_date = serializer.validated_data.get(
            "data",
            getattr(serializer.instance, "data", None),
        )
        if archive_contains_date(user, record_date):
            raise ValidationError(
                {
                    "data": [
                        "Perioada este deja arhivată și poate fi consultată doar în format PDF/Excel."
                    ]
                }
            )


BNR_RATES_URL = "https://www.bnr.ro/nbrfxrates.xml"
BNR_RATES_CACHE = {"data": None, "fetched_at": None}
BNR_RATES_CACHE_SECONDS = 6 * 60 * 60
PROFILE_IMAGE_MIME_EXTENSIONS = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
}
PROFILE_IMAGE_DATA_URL_RE = re.compile(r"^data:(image/[a-zA-Z0-9.+-]+);base64,(.+)$")


def normalize_profile_photo_path(value):
    if not value:
        return ""
    raw_value = str(value).strip()
    if raw_value.startswith("data:"):
        return raw_value

    parsed_value = urlparse(raw_value)
    raw_path = parsed_value.path if parsed_value.scheme else raw_value
    raw_path = raw_path.split("?", 1)[0].split("#", 1)[0]
    marker = f"{settings.MEDIA_URL}profile_images/"
    marker_index = raw_path.find(marker)
    if marker_index >= 0:
        return raw_path[marker_index:]
    return raw_path


def current_budget_cycle_key(ref_date=None, user=None):
    reference_date = ref_date or timezone.localdate()
    if user is None:
        _, cycle_end = perioada_bugetara(reference_date)
    else:
        _, cycle_end = get_user_budget_period(user, reference_date)
    return cycle_end.strftime("%Y-%m")


def parse_decimal_value(value, default="0"):
    try:
        return Decimal(str(value or default))
    except (InvalidOperation, TypeError, ValueError):
        return Decimal(default)


def quantize_money(value):
    return parse_decimal_value(value).quantize(Decimal("0.01"))


def convert_amount_to_eur(amount, currency, bnr_rates=None):
    amount = parse_decimal_value(amount)
    if currency == "RON":
        rates = bnr_rates
        if rates is None:
            try:
                rates = get_bnr_rates()
            except Exception:
                rates = {"ron_eur": Decimal("0.2")}
        return quantize_money(amount * rates["ron_eur"])
    return quantize_money(amount)


def sum_queryset_amounts_as_eur(queryset):
    total = Decimal("0")
    bnr_rates = None

    for item in queryset:
        if item.moneda == "RON" and bnr_rates is None:
            try:
                bnr_rates = get_bnr_rates()
            except Exception:
                bnr_rates = {"ron_eur": Decimal("0.2")}
        total += convert_amount_to_eur(item.suma, item.moneda, bnr_rates)

    return quantize_money(total)


def normalize_target_categories(values):
    if not isinstance(values, dict):
        return {}
    return {key: float(parse_decimal_value(value)) for key, value in values.items()}


def get_bnr_rates():
    cache_data = BNR_RATES_CACHE["data"]
    cache_time = BNR_RATES_CACHE["fetched_at"]
    if cache_data and cache_time:
        age = (timezone.now() - cache_time).total_seconds()
        if age < BNR_RATES_CACHE_SECONDS:
            return cache_data

    req = Request(
        BNR_RATES_URL,
        headers={"User-Agent": "buget-app/1.0"},
    )
    with urlopen(req, timeout=3) as response:
        xml_data = response.read()

    root = ET.fromstring(xml_data)
    cube = next((node for node in root.iter() if node.tag.endswith("Cube")), None)
    rate_node = next(
        (
            node
            for node in root.iter()
            if node.tag.endswith("Rate") and node.attrib.get("currency") == "EUR"
        ),
        None,
    )
    if rate_node is None or not rate_node.text:
        raise ValueError("Curs EUR lipsa din raspunsul BNR")

    eur_ron = Decimal(rate_node.text.strip().replace(",", "."))
    multiplier = Decimal(rate_node.attrib.get("multiplier", "1"))
    eur_ron = eur_ron / multiplier
    ron_eur = (Decimal("1") / eur_ron).quantize(Decimal("0.000001"))

    rates = {
        "date": cube.attrib.get("date") if cube is not None else None,
        "eur_ron": eur_ron,
        "ron_eur": ron_eur,
    }
    BNR_RATES_CACHE["data"] = rates
    BNR_RATES_CACHE["fetched_at"] = timezone.now()

    return rates


def get_private_ipv4_addresses():
    addresses = set()
    try:
        hostnames = {socket.gethostname(), socket.getfqdn()}
        for hostname in hostnames:
            for info in socket.getaddrinfo(hostname, None, socket.AF_INET):
                raw_ip = info[4][0]
                ip = ipaddress.ip_address(raw_ip)
                if ip.is_private and not ip.is_loopback:
                    addresses.add(raw_ip)
    except Exception:
        return []

    return sorted(addresses)


FIXED_AUTO_MONTH_INTERVALS = {
    "lunar": 1,
    "de_doua_ori_luna": 1,
    "de_trei_ori_luna": 1,
    "la_2_luni": 2,
    "la_3_luni": 3,
    "la_6_luni": 6,
    "anual": 12,
}

FIXED_AUTO_DAY_OFFSETS = {
    "lunar": [0],
    "de_doua_ori_luna": [0, 15],
    "de_trei_ori_luna": [0, 10, 20],
    "la_2_luni": [0],
    "la_3_luni": [0],
    "la_6_luni": [0],
    "anual": [0],
}


def add_months(base_date, month_count):
    month_index = base_date.month - 1 + month_count
    year = base_date.year + month_index // 12
    month = month_index % 12 + 1
    day = min(base_date.day, monthrange(year, month)[1])
    return date(year, month, day)


def iter_auto_fixed_dates(schedule, start, end):
    if schedule.data > end:
        return []

    interval = FIXED_AUTO_MONTH_INTERVALS.get(schedule.cursivitate, 1)
    month_delta = (start.year - schedule.data.year) * 12 + start.month - schedule.data.month
    first_step = max(0, (month_delta // interval) - 1)
    dates = set()
    step = first_step

    while True:
        month_anchor = add_months(schedule.data, step * interval)
        if month_anchor > end:
            break

        if month_anchor >= schedule.data:
            last_day = monthrange(month_anchor.year, month_anchor.month)[1]
            for offset in FIXED_AUTO_DAY_OFFSETS.get(schedule.cursivitate, [0]):
                day = min(schedule.data.day + offset, last_day)
                occurrence = date(month_anchor.year, month_anchor.month, day)
                if start <= occurrence <= end and occurrence >= schedule.data:
                    dates.add(occurrence)

        step += 1

    return sorted(dates)


def sync_auto_fixed_expenses_for_user(user, ref_date=None):
    start, end = get_user_budget_period(user, ref_date)
    generation_end = min(end, ref_date or timezone.localdate())
    schedules = CheltuialaFixaAutomata.objects.filter(
        user=user,
        data__lte=generation_end,
    )

    for schedule in schedules:
        expected_dates = (
            iter_auto_fixed_dates(schedule, start, generation_end)
            if schedule.activ
            else []
        )
        current_generated = CheltuialaFixa.objects.filter(
            user=schedule.user,
            automatizare=schedule,
            data__range=(start, end),
        )

        if expected_dates:
            current_generated.exclude(data__in=expected_dates).delete()
        else:
            current_generated.delete()

        for expense_date in expected_dates:
            defaults = {
                "descriere": schedule.denumire,
                "suma": schedule.suma,
                "moneda": schedule.moneda,
                "sursa": "automat",
            }
            expense, created = CheltuialaFixa.objects.get_or_create(
                user=schedule.user,
                automatizare=schedule,
                data=expense_date,
                defaults=defaults,
            )
            if created:
                continue
            changed_fields = [
                field for field, value in defaults.items() if getattr(expense, field) != value
            ]
            if changed_fields:
                for field in changed_fields:
                    setattr(expense, field, defaults[field])
                expense.save(update_fields=changed_fields)


def sync_auto_fixed_expenses_for_users(anchor_user, ref_date=None):
    user_ids = get_connected_user_ids(anchor_user)
    for user in User.objects.filter(id__in=user_ids):
        sync_auto_fixed_expenses_for_user(user, ref_date=ref_date)


def investment_category_response_items(user_ids):
    items = [
        {
            "id": None,
            "value": value,
            "label": label,
            "default": True,
        }
        for value, label in DEFAULT_INVESTMENT_CATEGORIES
    ]
    seen_values = {item["value"] for item in items}

    for category in InvestitieCategorie.objects.filter(user_id__in=user_ids):
        if category.value in seen_values:
            continue
        seen_values.add(category.value)
        items.append(
            {
                "id": category.id,
                "value": category.value,
                "label": category.label,
                "default": False,
            }
        )

    return items


def iter_auto_investment_dates(schedule, start, end):
    if schedule.data > end:
        return []

    month_delta = (start.year - schedule.data.year) * 12 + start.month - schedule.data.month
    first_step = max(0, month_delta - 1)
    dates = set()
    step = first_step

    while True:
        month_anchor = add_months(schedule.data, step)
        if month_anchor > end:
            break

        last_day = monthrange(month_anchor.year, month_anchor.month)[1]
        occurrence = date(
            month_anchor.year,
            month_anchor.month,
            min(schedule.data.day, last_day),
        )
        if start <= occurrence <= end and occurrence >= schedule.data:
            dates.add(occurrence)

        step += 1

    return sorted(dates)


def sync_auto_investments_for_user(user, ref_date=None):
    generation_end = ref_date or timezone.localdate()
    cycle_start, cycle_end = get_user_budget_period(user, generation_end)
    schedules = InvestitieAutomata.objects.filter(user=user)

    for schedule in schedules:
        current_generated = MiscareFond.objects.filter(
            user=schedule.user,
            automatizare=schedule,
            data__range=(cycle_start, cycle_end),
        )

        if not schedule.activ or schedule.data > generation_end:
            current_generated.delete()
            continue

        expected_dates = iter_auto_investment_dates(
            schedule,
            schedule.data,
            generation_end,
        )
        current_expected_dates = [
            value for value in expected_dates if cycle_start <= value <= cycle_end
        ]
        if current_expected_dates:
            current_generated.exclude(data__in=current_expected_dates).delete()
        else:
            current_generated.delete()

        generated_movements = list(
            MiscareFond.objects.filter(
                user=schedule.user,
                automatizare=schedule,
            )
        )
        generated_by_date = {movement.data: movement for movement in generated_movements}
        generated_historical_months = {
            (movement.data.year, movement.data.month)
            for movement in generated_movements
            if movement.data < cycle_start
        }

        for investment_date in expected_dates:
            if (
                investment_date < cycle_start
                and (investment_date.year, investment_date.month)
                in generated_historical_months
            ):
                continue

            defaults = {
                "tip": "adauga",
                "rubrica": schedule.rubrica,
                "suma_eur": abs(schedule.suma_eur) if schedule.suma_eur else None,
                "suma_ron": abs(schedule.suma_ron) if schedule.suma_ron else None,
                "observatii": schedule.denumire or "Investitie automata",
            }
            movement = generated_by_date.get(investment_date)
            created = movement is None
            if created:
                movement = MiscareFond.objects.create(
                    user=schedule.user,
                    automatizare=schedule,
                    data=investment_date,
                    **defaults,
                )
                generated_by_date[investment_date] = movement
                if investment_date < cycle_start:
                    generated_historical_months.add(
                        (investment_date.year, investment_date.month)
                    )
            if created:
                continue

            if investment_date < cycle_start:
                continue

            changed_fields = [
                field for field, value in defaults.items() if getattr(movement, field) != value
            ]
            if changed_fields:
                for field in changed_fields:
                    setattr(movement, field, defaults[field])
                movement.save(update_fields=changed_fields)


def sync_auto_investments_for_users(anchor_user, ref_date=None):
    user_ids = get_connected_user_ids(anchor_user)
    for user in User.objects.filter(id__in=user_ids):
        sync_auto_investments_for_user(user, ref_date=ref_date)


class VenitViewSet(BaseViewSet):
    queryset = Venit.objects.all()
    serializer_class = VenitSerializer

    def get_queryset(self):
        user_ids = get_connected_user_ids(self.request.user)
        for user in User.objects.filter(id__in=user_ids):
            sync_salary_income(user)
        queryset = super().get_queryset()
        archived = self.request.query_params.get("archived")
        if archived == "1":
            return queryset[10:]
        if archived == "0":
            return queryset[:10]
        return queryset


class CreditViewSet(BaseViewSet):
    queryset = Credit.objects.all()
    serializer_class = CreditSerializer


class CheltuialaFixaViewSet(BaseViewSet):
    queryset = CheltuialaFixa.objects.all()
    serializer_class = CheltuialaFixaSerializer

    def get_queryset(self):
        sync_auto_fixed_expenses_for_users(self.request.user)
        return super().get_queryset().exclude(sursa="automat")


class CheltuialaFixaAutomataViewSet(BaseViewSet):
    queryset = CheltuialaFixaAutomata.objects.all()
    serializer_class = CheltuialaFixaAutomataSerializer

    def perform_create(self, serializer):
        instance = serializer.save(user=self.request.user)
        sync_auto_fixed_expenses_for_user(instance.user)

    def perform_update(self, serializer):
        instance = serializer.save()
        sync_auto_fixed_expenses_for_user(instance.user)

    def perform_destroy(self, instance):
        start, end = get_user_budget_period(instance.user)
        CheltuialaFixa.objects.filter(
            user=instance.user,
            automatizare=instance,
            data__range=(start, end),
        ).delete()
        instance.delete()


class CheltuialaVariabilaViewSet(BaseViewSet):
    queryset = CheltuialaVariabila.objects.all()
    serializer_class = CheltuialaVariabilaSerializer

    def normalize_amount_kwargs(self, serializer):
        if serializer.validated_data.get("moneda") != "RON":
            return {}
        return {
            "suma": convert_amount_to_eur(serializer.validated_data.get("suma"), "RON"),
            "moneda": "EUR",
        }

    def perform_create(self, serializer):
        self.ensure_period_is_editable(serializer, user=self.request.user)
        serializer.save(user=self.request.user, **self.normalize_amount_kwargs(serializer))

    def perform_update(self, serializer):
        self.ensure_period_is_editable(serializer, user=serializer.instance.user)
        serializer.save(**self.normalize_amount_kwargs(serializer))


class EconomieVacantaViewSet(BaseViewSet):
    queryset = EconomieVacanta.objects.all()
    serializer_class = EconomieVacantaSerializer


class InvestitieCategorieViewSet(BaseViewSet):
    queryset = InvestitieCategorie.objects.all()
    serializer_class = InvestitieCategorieSerializer

    def get_queryset(self):
        return self.queryset.filter(user=self.request.user)


class InvestitieAutomataViewSet(BaseViewSet):
    queryset = InvestitieAutomata.objects.all()
    serializer_class = InvestitieAutomataSerializer

    def get_queryset(self):
        return self.queryset.filter(user=self.request.user).order_by("data", "id")

    def perform_create(self, serializer):
        instance = serializer.save(user=self.request.user)
        sync_auto_investments_for_user(instance.user)

    def perform_update(self, serializer):
        instance = serializer.save()
        sync_auto_investments_for_user(instance.user)

    def perform_destroy(self, instance):
        start, end = get_user_budget_period(instance.user)
        MiscareFond.objects.filter(
            user=instance.user,
            automatizare=instance,
            data__range=(start, end),
        ).delete()
        instance.delete()


def sync_salary_income(user):
    today = timezone.localdate()
    bnr_rates = None
    for schedule in user.salary_schedules.filter(activ=True):
        salary_anchor = schedule.data or today
        target_day = min(salary_anchor.day, calendar.monthrange(today.year, today.month)[1])
        income_date = date(today.year, today.month, target_day)
        if income_date < salary_anchor:
            continue
        suma = schedule.suma
        moneda = schedule.moneda

        if schedule.moneda == "RON":
            if bnr_rates is None:
                try:
                    bnr_rates = get_bnr_rates()
                except Exception:
                    bnr_rates = {"ron_eur": Decimal("0.2")}
            suma = (schedule.suma * bnr_rates["ron_eur"]).quantize(Decimal("0.01"))
            moneda = "EUR"

        Venit.objects.update_or_create(
            user=user,
            salary_schedule=schedule,
            data=income_date,
            defaults={
                "suma": suma,
                "moneda": moneda,
                "sursa": "salariu",
            },
        )


class SalaryScheduleViewSet(BaseViewSet):
    queryset = SalarySchedule.objects.all()
    serializer_class = SalaryScheduleSerializer

    def get_queryset(self):
        return super().get_queryset().order_by("data", "id")

    def perform_create(self, serializer):
        instance = serializer.save(user=self.request.user)
        sync_salary_income(instance.user)

    def perform_update(self, serializer):
        instance = serializer.save()
        Venit.objects.filter(user=instance.user, salary_schedule=instance).delete()
        sync_salary_income(instance.user)

    def perform_destroy(self, instance):
        Venit.objects.filter(user=instance.user, salary_schedule=instance).delete()
        instance.delete()


def remove_profile_photo_file(value):
    value = normalize_profile_photo_path(value)
    if not value or not str(value).startswith(settings.MEDIA_URL):
        return

    relative_path = str(value)[len(settings.MEDIA_URL) :].lstrip("/")
    if not relative_path.startswith("profile_images/"):
        return

    photo_path = (Path(settings.MEDIA_ROOT) / relative_path).resolve()
    media_root = Path(settings.MEDIA_ROOT).resolve()
    if media_root in photo_path.parents and photo_path.exists():
        photo_path.unlink()


def save_profile_photo_value(user, value, previous_value=""):
    if value in (None, ""):
        remove_profile_photo_file(previous_value)
        return ""

    if not isinstance(value, str):
        return previous_value or ""

    match = PROFILE_IMAGE_DATA_URL_RE.match(value)
    if not match:
        return normalize_profile_photo_path(value)

    mime_type, encoded_content = match.groups()
    extension = PROFILE_IMAGE_MIME_EXTENSIONS.get(mime_type.lower())
    if not extension:
        raise ValueError("Formatul imaginii nu este acceptat.")

    try:
        image_content = base64.b64decode(encoded_content, validate=True)
    except (binascii.Error, ValueError) as exc:
        raise ValueError("Imaginea incarcata nu este valida.") from exc

    if len(image_content) > 5 * 1024 * 1024:
        raise ValueError("Imaginea trebuie sa fie mai mica de 5 MB.")

    image_dir = Path(settings.MEDIA_ROOT) / "profile_images"
    image_dir.mkdir(parents=True, exist_ok=True)
    filename = f"user_{user.id}.{extension}"
    image_path = image_dir / filename
    temporary_path = image_dir / f".{filename}.{secrets.token_hex(8)}.tmp"

    try:
        temporary_path.write_bytes(image_content)
        temporary_path.replace(image_path)
    finally:
        if temporary_path.exists():
            temporary_path.unlink()

    next_value = f"{settings.MEDIA_URL}profile_images/{filename}"
    if normalize_profile_photo_path(previous_value) != next_value:
        remove_profile_photo_file(previous_value)

    return next_value


def build_profile_photo_url(request, value, version=None):
    if not value:
        return ""
    if str(value).startswith(("http://", "https://", "data:")):
        url = value
    elif request and str(value).startswith("/"):
        url = request.build_absolute_uri(value)
    else:
        url = value

    if version and not str(url).startswith("data:"):
        separator = "&" if "?" in str(url) else "?"
        return f"{url}{separator}v={version}"
    return url


def serialize_profile_response(user, request=None):
    profile, _ = UserProfile.objects.get_or_create(user=user)
    sync_salary_income(user)
    data = UserProfileSerializer(profile).data
    data["poza"] = build_profile_photo_url(
        request,
        data.get("poza"),
        version=int(profile.updated_at.timestamp()) if profile.updated_at else None,
    )
    return {
        "id": user.id,
        "username": user.username,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "email": user.email,
        "profile": data,
    }


@api_view(["GET", "PUT"])
@permission_classes([IsAuthenticated])
def profile(request):
    profile_obj, _ = UserProfile.objects.get_or_create(user=request.user)

    if request.method == "GET":
        return Response(serialize_profile_response(request.user, request))

    with transaction.atomic():
        profile_data = dict(request.data.get("profile", {}))
        if "poza" in profile_data:
            try:
                profile_data["poza"] = save_profile_photo_value(
                    request.user,
                    profile_data.get("poza"),
                    profile_obj.poza,
                )
            except ValueError as exc:
                return Response({"poza": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

        user_update_fields = []
        username = request.data.get("username")
        if username:
            exists = (
                User.objects.exclude(id=request.user.id).filter(username=username).exists()
            )
            if exists:
                return Response({"username": "Acest username există deja."}, status=400)
            if username != request.user.username:
                request.user.username = username
                user_update_fields.append("username")

        email = request.data.get("email")
        if email and email != request.user.email:
            exists = (
                User.objects.exclude(id=request.user.id)
                .filter(email__iexact=email)
                .exists()
            )
            if exists:
                return Response({"email": "Email-ul este deja folosit."}, status=400)
            request.user.email = email.strip().lower()
            user_update_fields.append("email")

        first_name = request.data.get("first_name")
        last_name = request.data.get("last_name")
        if first_name is not None:
            request.user.first_name = first_name
            user_update_fields.append("first_name")
        if last_name is not None:
            request.user.last_name = last_name
            user_update_fields.append("last_name")

        serializer = UserProfileSerializer(
            profile_obj, data=profile_data, partial=True
        )
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        if user_update_fields:
            request.user.save(update_fields=sorted(set(user_update_fields)))
        serializer.save()

    sync_salary_income(request.user)
    return Response(serialize_profile_response(request.user, request))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def change_password(request):
    old_password = request.data.get("old_password", "")
    new_password = request.data.get("new_password", "")
    confirm_password = request.data.get("confirm_password", "")

    if not request.user.check_password(old_password):
        return Response({"old_password": "Parola veche este incorectă."}, status=400)
    if new_password != confirm_password:
        return Response({"confirm_password": "Parolele noi nu coincid."}, status=400)
    if len(new_password) < 6:
        return Response(
            {"new_password": "Parola nouă trebuie să aibă minimum 6 caractere."},
            status=400,
        )

    request.user.set_password(new_password)
    request.user.save(update_fields=["password"])
    return Response({"success": True})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def request_email_change(request):
    new_email = request.data.get("new_email", "").strip().lower()
    password = request.data.get("password", "")

    if not request.user.check_password(password):
        return Response({"password": "Parola este incorectă."}, status=400)
    if not new_email:
        return Response({"new_email": "Email-ul nou este obligatoriu."}, status=400)
    if (
        User.objects.exclude(id=request.user.id)
        .filter(email__iexact=new_email)
        .exists()
    ):
        return Response({"new_email": "Email-ul este deja folosit."}, status=400)

    code = secrets.token_urlsafe(24)
    EmailChangeRequest.objects.create(user=request.user, new_email=new_email, code=code)
    link = request.build_absolute_uri(f"/api/email-change/confirm/{code}/")

    send_mail(
        "Confirmare modificare email",
        f"Codul tău de confirmare este: {code}\nLink confirmare: {link}",
        getattr(settings, "DEFAULT_FROM_EMAIL", settings.EMAIL_HOST_USER),
        [new_email],
        fail_silently=True,
    )

    return Response(
        {
            "success": True,
            "message": "Am trimis linkul și codul de confirmare pe emailul nou.",
        }
    )


@api_view(["POST", "GET"])
@permission_classes([AllowAny])
def confirm_email_change(request, code=None):
    provided_code = code or request.data.get("code")
    try:
        change = EmailChangeRequest.objects.get(
            code=provided_code, used_at__isnull=True
        )
    except EmailChangeRequest.DoesNotExist:
        return Response({"code": "Cod invalid sau deja folosit."}, status=400)

    change.user.email = change.new_email
    change.user.save(update_fields=["email"])
    change.used_at = timezone.now()
    change.save(update_fields=["used_at"])
    return Response({"success": True, "email": change.user.email})


class RealizariTargetViewSet(BaseViewSet):
    queryset = RealizariTarget.objects.all()
    serializer_class = RealizariTargetSerializer

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)

    def create(self, request, *args, **kwargs):
        luna = request.data.get("luna")
        instance = RealizariTarget.objects.filter(user=request.user, luna=luna).first()
        if instance:
            serializer = self.get_serializer(instance, data=request.data, partial=True)
            serializer.is_valid(raise_exception=True)
            self.perform_update(serializer)
            return Response(serializer.data)
        return super().create(request, *args, **kwargs)


@api_view(["GET", "POST"])
@permission_classes([IsAuthenticated])
def obiective_cheltuieli_global(request):
    obiectiv, _ = ObiectivCheltuieliGlobal.objects.get_or_create(user=request.user)

    if request.method == "GET":
        return Response(ObiectivCheltuieliGlobalSerializer(obiectiv).data)

    serializer = ObiectivCheltuieliGlobalSerializer(
        obiectiv,
        data=request.data,
        partial=True,
    )
    serializer.is_valid(raise_exception=True)
    serializer.save()

    luna_curenta = current_budget_cycle_key(user=request.user)
    fixed_target = parse_decimal_value(serializer.instance.fixed_target)
    category_targets = normalize_target_categories(serializer.instance.category_targets)

    RealizariTarget.objects.update_or_create(
        user=request.user,
        luna=luna_curenta,
        defaults={
            "fixed_target": fixed_target,
            "category_targets": category_targets,
        },
    )
    RealizariTarget.objects.filter(user=request.user, luna__gt=luna_curenta).update(
        fixed_target=fixed_target,
        category_targets=category_targets,
    )

    return Response(ObiectivCheltuieliGlobalSerializer(serializer.instance).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def curs_bnr(request):
    try:
        rates = get_bnr_rates()

        return Response(
            {
                "source": "BNR",
                "date": rates["date"],
                "eur_ron": str(rates["eur_ron"]),
                "ron_eur": str(rates["ron_eur"]),
            }
        )
    except Exception as exc:
        return Response(
            {"detail": "Cursul BNR nu este disponibil momentan.", "error": str(exc)},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )


@api_view(["GET"])
@permission_classes([AllowAny])
def install_info(request):
    frontend_port = request.query_params.get("frontend_port") or "5173"
    scheme = request.query_params.get("scheme") or "http"
    local_ips = get_private_ipv4_addresses()

    return Response(
        {
            "local_ips": local_ips,
            "suggested_urls": [
                f"{scheme}://{ip}:{frontend_port}/" for ip in local_ips
            ],
        }
    )


class RegisterView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = RegisterSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(
                {"message": "Cont creat cu succes"},
                status=status.HTTP_201_CREATED,
            )
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


def deduction_date_for_period(start):
    return start + timedelta(days=1)


def serialize_amount_row(item):
    return {
        "id": item.id,
        "data": item.data,
        "suma": item.suma,
        "moneda": item.moneda,
        "suma_eur": convert_amount_to_eur(item.suma, item.moneda),
        "username": item.user.username,
    }


def get_scheduled_auto_fixed_rows(user_ids, start, end, ref_date=None):
    ref_date = ref_date or timezone.localdate()
    deduction_date = deduction_date_for_period(start)
    if ref_date < deduction_date:
        return []

    rows = []
    bnr_rates = None
    schedules = CheltuialaFixaAutomata.objects.filter(
        user_id__in=user_ids,
        activ=True,
        data__lte=end,
    ).select_related("user")

    for schedule in schedules:
        occurrence_dates = iter_auto_fixed_dates(schedule, start, end)
        if schedule.cursivitate == "lunar":
            included_dates = occurrence_dates
        else:
            included_dates = [
                occurrence_date
                for occurrence_date in occurrence_dates
                if occurrence_date <= ref_date
            ]
        if not included_dates:
            continue

        if schedule.moneda == "RON" and bnr_rates is None:
            try:
                bnr_rates = get_bnr_rates()
            except Exception:
                bnr_rates = {"ron_eur": Decimal("0.2")}

        amount_eur = convert_amount_to_eur(
            schedule.suma,
            schedule.moneda,
            bnr_rates,
        )
        rows.extend(
            {
                "id": f"automatizare-{schedule.id}-{occurrence_date.isoformat()}",
                "automatizare_id": schedule.id,
                "data": occurrence_date,
                "denumire": schedule.denumire,
                "cursivitate": schedule.cursivitate,
                "suma": schedule.suma,
                "moneda": schedule.moneda,
                "suma_eur": amount_eur,
                "username": schedule.user.username,
                "sursa": "automat",
            }
            for occurrence_date in included_dates
        )

    orphan_rows = CheltuialaFixa.objects.filter(
        user_id__in=user_ids,
        sursa="automat",
        automatizare__isnull=True,
        data__range=(start, min(end, ref_date)),
    ).select_related("user")
    rows.extend(
        {
            **serialize_amount_row(item),
            "automatizare_id": None,
            "denumire": item.descriere or "Cheltuiala fixa automata",
            "cursivitate": "inregistrata",
            "sursa": "automat",
        }
        for item in orphan_rows
    )

    return sorted(rows, key=lambda item: (item["data"], str(item["id"])))


def get_recorded_auto_fixed_rows(user_ids, start, end):
    expenses = CheltuialaFixa.objects.filter(
        user_id__in=user_ids,
        sursa="automat",
        data__range=(start, end),
    ).select_related("user", "automatizare")

    return [
        {
            **serialize_amount_row(item),
            "automatizare_id": item.automatizare_id,
            "denumire": item.descriere or "Cheltuiala fixa automata",
            "cursivitate": (
                item.automatizare.cursivitate
                if item.automatizare_id
                else "inregistrata"
            ),
            "sursa": "automat",
        }
        for item in expenses.order_by("data", "id")
    ]


def get_auto_fixed_deduction_total(user_ids, start, end, ref_date=None):
    rows = get_scheduled_auto_fixed_rows(
        user_ids,
        start,
        end,
        ref_date=ref_date,
    )
    return quantize_money(sum((row["suma_eur"] for row in rows), Decimal("0")))


def get_income_summary(
    user_ids,
    start,
    end,
    ref_date=None,
    auto_deduction_total=None,
):
    venit_brut = sum_queryset_amounts_as_eur(
        Venit.objects.filter(
            user_id__in=user_ids,
            data__range=(start, end),
        )
    )
    deduceri_credite = sum_queryset_amounts_as_eur(
        Credit.objects.filter(
            user_id__in=user_ids,
            data__range=(start, end),
        )
    )
    deduceri_automate = (
        quantize_money(auto_deduction_total)
        if auto_deduction_total is not None
        else get_auto_fixed_deduction_total(
            user_ids,
            start,
            end,
            ref_date=ref_date,
        )
    )
    deduceri_total = quantize_money(deduceri_credite + deduceri_automate)
    venit_net = quantize_money(venit_brut - deduceri_total)

    return {
        "venit_brut": quantize_money(venit_brut),
        "deduceri_credite": deduceri_credite,
        "deduceri_automate": deduceri_automate,
        "deduceri_total": deduceri_total,
        "venit_net": venit_net,
    }


def budget_period_from_key(
    cycle_key,
    start_day=DEFAULT_BUDGET_CYCLE_START_DAY,
):
    if not re.fullmatch(r"\d{4}-\d{2}", str(cycle_key or "")):
        raise ValueError("Luna trebuie sa aiba formatul YYYY-MM.")

    year, month = (int(value) for value in cycle_key.split("-"))
    if month < 1 or month > 12:
        raise ValueError("Luna trebuie sa fie intre 01 si 12.")

    start_day = min(max(int(start_day), 1), 31)
    if start_day == 1:
        cycle_start = date(year, month, 1)
        next_year, next_month = shift_month(year, month, 1)
        next_start = date(next_year, next_month, 1)
    else:
        next_start = date(year, month, clamp_day(year, month, start_day))
        previous_year, previous_month = shift_month(year, month, -1)
        cycle_start = date(
            previous_year,
            previous_month,
            clamp_day(previous_year, previous_month, start_day),
        )
    cycle_end = next_start - timedelta(days=1)
    return cycle_start, cycle_end


def percentage_of(amount, total):
    if total <= 0:
        return Decimal("0.00")
    return quantize_money((amount / total) * Decimal("100"))


def build_budget_period_report(user_ids, start, end, ref_date=None, include_rows=False):
    today = timezone.localdate()
    ref_date = min(ref_date or today, end)
    use_recorded_automations = end < today
    auto_rows = (
        get_recorded_auto_fixed_rows(user_ids, start, end)
        if use_recorded_automations
        else get_scheduled_auto_fixed_rows(user_ids, start, end, ref_date=ref_date)
    )
    auto_total = quantize_money(
        sum((row["suma_eur"] for row in auto_rows), Decimal("0"))
    )
    income_summary = get_income_summary(
        user_ids,
        start,
        end,
        ref_date=ref_date,
        auto_deduction_total=auto_total,
    )

    income_items = list(
        Venit.objects.filter(
            user_id__in=user_ids,
            data__range=(start, end),
        )
        .select_related("user")
        .order_by("data", "id")
    )
    credit_items = list(
        Credit.objects.filter(
            user_id__in=user_ids,
            data__range=(start, end),
        )
        .select_related("user")
        .order_by("data", "id")
    )
    fixed_items = list(
        CheltuialaFixa.objects.filter(
            user_id__in=user_ids,
            data__range=(start, end),
        )
        .exclude(sursa="automat")
        .select_related("user")
        .order_by("data", "id")
    )
    variable_items = list(
        CheltuialaVariabila.objects.filter(
            user_id__in=user_ids,
            data__range=(start, end),
        )
        .select_related("user")
        .order_by("data", "id")
    )

    fixed_manual_total = quantize_money(
        sum(
            (
                convert_amount_to_eur(item.suma, item.moneda)
                for item in fixed_items
            ),
            Decimal("0"),
        )
    )
    category_totals = {}
    for item in variable_items:
        category_totals.setdefault(item.categorie, Decimal("0"))
        category_totals[item.categorie] += convert_amount_to_eur(
            item.suma,
            item.moneda,
        )
    category_totals = {
        key: quantize_money(value) for key, value in category_totals.items()
    }
    variable_total = quantize_money(sum(category_totals.values(), Decimal("0")))
    budget_expenses = quantize_money(fixed_manual_total + variable_total)
    fixed_total = quantize_money(fixed_manual_total + auto_total)
    total_outflows = quantize_money(income_summary["deduceri_total"] + budget_expenses)
    savings = quantize_money(income_summary["venit_net"] - budget_expenses)

    report = {
        "luna": end.strftime("%Y-%m"),
        "start": start,
        "end": end,
        "calculat_la": ref_date,
        "venit_brut": income_summary["venit_brut"],
        "deduceri_credite": income_summary["deduceri_credite"],
        "deduceri_automate": income_summary["deduceri_automate"],
        "deduceri_total": income_summary["deduceri_total"],
        "venit_net": income_summary["venit_net"],
        "fixe_manuale": fixed_manual_total,
        "fixe_automate": auto_total,
        "fixe_total": fixed_total,
        "variabile": variable_total,
        "cheltuieli_buget": budget_expenses,
        "iesiri_totale": total_outflows,
        "economii": savings,
        "categorii": [
            {
                "categorie": key,
                "total": total,
                "procent_venit_brut": percentage_of(
                    total,
                    income_summary["venit_brut"],
                ),
                "procent_venit_disponibil": percentage_of(
                    total,
                    income_summary["venit_net"],
                ),
            }
            for key, total in sorted(category_totals.items())
        ],
    }

    if include_rows:
        report["venituri"] = [
            {
                **serialize_amount_row(item),
                "sursa": item.sursa or "manual",
            }
            for item in income_items
        ]
        report["credite"] = [
            {
                **serialize_amount_row(item),
                "denumire": item.denumire or "Credit",
            }
            for item in credit_items
        ]
        report["fixe_manuale_detalii"] = [
            {
                **serialize_amount_row(item),
                "descriere": item.descriere or "Cheltuiala fixa",
                "sursa": item.sursa or "manual",
            }
            for item in fixed_items
        ]
        report["fixe_automate_detalii"] = auto_rows
        report["variabile_detalii"] = [
            {
                **serialize_amount_row(item),
                "categorie": item.categorie,
                "descriere": item.descriere or "",
            }
            for item in variable_items
        ]

    return report


def build_available_budget_period_report(
    user_ids,
    start,
    end,
    ref_date=None,
    include_rows=False,
):
    """Combină DB-ul activ cu arhivele locale pentru rapoarte istorice."""
    if ready_archives_for_period(user_ids, start, end).exists():
        records = combined_records_for_period(user_ids, start, end)
        report = build_report_from_records(records, start, end)
        if not include_rows:
            for key in (
                "venituri",
                "credite",
                "fixe_manuale_detalii",
                "fixe_automate_detalii",
                "variabile_detalii",
            ):
                report.pop(key, None)
        return report

    return build_budget_period_report(
        user_ids,
        start,
        end,
        ref_date=ref_date,
        include_rows=include_rows,
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def venit_total_lunar(request):
    today = timezone.localdate()
    start, end = get_user_budget_period(request.user, today)

    user_ids = get_connected_user_ids(request.user)
    income_summary = get_income_summary(user_ids, start, end, ref_date=today)

    return Response(
        {
            "start": start,
            "end": end,
            "venit_total": income_summary["venit_net"],
            "venit_brut": income_summary["venit_brut"],
            "deduceri_credite": income_summary["deduceri_credite"],
            "deduceri_automate": income_summary["deduceri_automate"],
            "deduceri_total": income_summary["deduceri_total"],
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    user = request.user
    return Response(
        {
            "id": user.id,
            "username": user.username,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email": user.email,
            "profile": serialize_profile_response(user, request).get("profile"),
            "is_admin": user.is_staff or user.is_superuser,
        }
    )


def budget_period_response(user, ref_date=None):
    reference_date = ref_date or timezone.localdate()
    start_day = get_user_budget_start_day(user)
    start, end = perioada_bugetara(reference_date, start_day=start_day)
    return {
        "start_day": start_day,
        "start": start,
        "end": end,
        "next_start": end + timedelta(days=1),
        "cycle_key": end.strftime("%Y-%m"),
    }


@api_view(["GET", "PUT", "PATCH"])
@permission_classes([IsAuthenticated])
def perioada_bugetara_config(request):
    profile, _created = UserProfile.objects.get_or_create(user=request.user)

    if request.method != "GET":
        raw_start_day = request.data.get("start_day")
        try:
            start_day = int(raw_start_day)
        except (TypeError, ValueError):
            return Response(
                {"start_day": ["Introdu o zi între 1 și 31."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not 1 <= start_day <= 31:
            return Response(
                {"start_day": ["Ziua trebuie să fie între 1 și 31."]},
                status=status.HTTP_400_BAD_REQUEST,
            )
        profile.budget_cycle_start_day = start_day
        profile.save(update_fields=["budget_cycle_start_day", "updated_at"])

    return Response(budget_period_response(request.user))


def serialize_financial_archive(archive):
    return {
        "id": str(archive.id),
        "cycle_key": archive.cycle_key,
        "period_start": archive.period_start,
        "period_end": archive.period_end,
        "record_counts": archive.record_counts,
        "totals": archive.totals,
        "archived_at": archive.archived_at,
        "formats": ["pdf", "excel"],
    }


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def arhive_financiare(request):
    archives = FinancialArchive.objects.filter(
        user=request.user,
        status=FinancialArchive.Status.READY,
    )
    return Response([serialize_financial_archive(archive) for archive in archives])


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def ruleaza_arhivarea(request):
    try:
        result = archive_old_financial_data(request.user)
    except Exception as exc:
        return Response(
            {
                "detail": (
                    "Arhivarea a fost oprită în siguranță; nicio înregistrare "
                    f"neverificată nu a fost ștearsă. {exc}"
                )
            },
            status=status.HTTP_409_CONFLICT,
        )
    return Response(result)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def descarca_arhiva(request, archive_id, file_kind):
    archive = get_object_or_404(
        FinancialArchive,
        pk=archive_id,
        user=request.user,
        status=FinancialArchive.Status.READY,
    )
    try:
        path, metadata = archive_download_path(archive, file_kind)
    except ArchiveError as exc:
        return Response(
            {"detail": str(exc)},
            status=status.HTTP_409_CONFLICT,
        )

    extension = "pdf" if file_kind == "pdf" else "xlsx"
    filename = (
        f"arhiva-financiara-{archive.period_start}-{archive.period_end}.{extension}"
    )
    return FileResponse(
        path.open("rb"),
        as_attachment=True,
        filename=filename,
        content_type=metadata["mime_type"],
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def buget_lunar(request):
    start, end = get_user_budget_period(request.user)
    user_ids = get_connected_user_ids(request.user)
    report = build_available_budget_period_report(
        user_ids,
        start,
        end,
        ref_date=timezone.localdate(),
    )

    return Response(
        {
            "luna": f"{start} – {end}",
            "start": start,
            "end": end,
            "next_start": end + timedelta(days=1),
            "start_day": get_user_budget_start_day(request.user),
            "cycle_key": end.strftime("%Y-%m"),
            "venit": report["venit_net"],
            "venit_brut": report["venit_brut"],
            "deduceri_credite": report["deduceri_credite"],
            "deduceri_automate": report["deduceri_automate"],
            "deduceri_total": report["deduceri_total"],
            "cheltuieli": report["cheltuieli_buget"],
            "fixe": report["fixe_manuale"],
            "fixe_automate": report["fixe_automate"],
            "fixe_total": report["fixe_total"],
            "variabile": report["variabile"],
            "iesiri_totale": report["iesiri_totale"],
            "economii": report["economii"],
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def grafice_luna(request):
    start, end = get_user_budget_period(request.user)
    user_ids = get_connected_user_ids(request.user)
    report = build_budget_period_report(
        user_ids,
        start,
        end,
        ref_date=timezone.localdate(),
    )
    cheltuieli = [
        {
            "categorie": item["categorie"],
            "total": item["total"],
            "procent_venit_brut": item["procent_venit_brut"],
            "procent_venit_disponibil": item["procent_venit_disponibil"],
        }
        for item in report["categorii"]
    ]

    return Response(
        {
            "luna": f"{start} – {end}",
            "venit": report["venit_net"],
            "venit_brut": report["venit_brut"],
            "deduceri_credite": report["deduceri_credite"],
            "deduceri_automate": report["deduceri_automate"],
            "deduceri_total": report["deduceri_total"],
            "fixe": report["fixe_manuale"],
            "fixe_automate": report["fixe_automate"],
            "fixe_total": report["fixe_total"],
            "cheltuieli_total": report["cheltuieli_buget"],
            "iesiri_totale": report["iesiri_totale"],
            "cheltuieli": cheltuieli,
            "economii": report["economii"],
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def raport_bugetar(request):
    start_day = get_user_budget_start_day(request.user)
    cycle_key = request.query_params.get("luna") or current_budget_cycle_key(
        user=request.user
    )
    try:
        start, end = budget_period_from_key(cycle_key, start_day=start_day)
    except (TypeError, ValueError) as exc:
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)

    user_ids = get_connected_user_ids(request.user)
    for user in User.objects.filter(id__in=user_ids):
        sync_salary_income(user)

    report = build_available_budget_period_report(
        user_ids,
        start,
        end,
        ref_date=timezone.localdate(),
        include_rows=True,
    )
    target = RealizariTarget.objects.filter(
        user=request.user,
        luna=cycle_key,
    ).first()
    if target is None:
        target = ObiectivCheltuieliGlobal.objects.filter(user=request.user).first()

    report["obiectiv"] = {
        "fixed_target": target.fixed_target if target else Decimal("0.00"),
        "category_targets": target.category_targets if target else {},
    }
    return Response(report)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def calculeaza_economii_luna(request):
    start, end = get_user_budget_period(request.user)
    luna = end.strftime("%Y-%m")
    user_ids = get_connected_user_ids(request.user)
    report = build_budget_period_report(
        user_ids,
        start,
        end,
        ref_date=timezone.localdate(),
    )

    EconomieLunara.objects.update_or_create(
        user=request.user,
        luna=luna,
        defaults={"sold": report["economii"]},
    )

    return Response(
        {
            "luna": luna,
            "venit": report["venit_net"],
            "venit_brut": report["venit_brut"],
            "deduceri_credite": report["deduceri_credite"],
            "deduceri_automate": report["deduceri_automate"],
            "deduceri_total": report["deduceri_total"],
            "cheltuieli": report["cheltuieli_buget"],
            "economie": report["economii"],
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def istoric_economii(request):
    today = timezone.localdate()
    start_day = get_user_budget_start_day(request.user)
    current_start, _current_end = perioada_bugetara(today, start_day=start_day)
    user_ids = get_connected_user_ids(request.user)
    for user in User.objects.filter(id__in=user_ids):
        sync_salary_income(user)

    first_dates = [
        value
        for value in (
            model.objects.filter(user_id__in=user_ids)
            .order_by("data")
            .values_list("data", flat=True)
            .first()
            for model in (
                Venit,
                Credit,
                CheltuialaFixa,
                CheltuialaFixaAutomata,
                CheltuialaVariabila,
            )
        )
        if value is not None
    ]
    archived_first_date = (
        FinancialArchive.objects.filter(
            user_id__in=user_ids,
            status=FinancialArchive.Status.READY,
        )
        .order_by("period_start")
        .values_list("period_start", flat=True)
        .first()
    )
    if archived_first_date is not None:
        first_dates.append(archived_first_date)
    first_start, _first_end = perioada_bugetara(
        min(first_dates or [today]),
        start_day=start_day,
    )

    history = []
    cycle_start = first_start
    while cycle_start <= current_start:
        _ignored_start, cycle_end = perioada_bugetara(
            cycle_start,
            start_day=start_day,
        )
        report = build_available_budget_period_report(
            user_ids,
            cycle_start,
            cycle_end,
            ref_date=min(today, cycle_end),
        )
        history.append({**report, "sold": report["economii"]})
        cycle_start = cycle_end + timedelta(days=1)

    return Response(history)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def economii_vacanta_sumar(request):
    user_ids = get_connected_user_ids(request.user)
    puse = sum_queryset_amounts_as_eur(
        EconomieVacanta.objects.filter(user_id__in=user_ids, tip="economii")
    ) + sum_queryset_amounts_as_eur(
        CheltuialaVariabila.objects.filter(
            user_id__in=user_ids,
            categorie="vacanta",
        )
    )

    cheltuite = sum_queryset_amounts_as_eur(
        EconomieVacanta.objects.filter(user_id__in=user_ids, tip="cheltuieli")
    ) + sum_queryset_amounts_as_eur(
        CheltuialaVariabila.objects.filter(
            user_id__in=user_ids,
            categorie="vacanta_cheltuita",
        )
    )

    archived_vacation_saved = Decimal("0")
    archived_vacation_spent = Decimal("0")
    for archive in FinancialArchive.objects.filter(
        user_id__in=user_ids,
        status=FinancialArchive.Status.READY,
    ):
        try:
            archived_rows = load_manifest(archive).get("records", {}).get(
                "cheltuieli_variabile",
                [],
            )
        except ArchiveError:
            continue
        for item in archived_rows:
            if item.get("categorie") == "vacanta":
                archived_vacation_saved += parse_decimal_value(item.get("suma_eur"))
            elif item.get("categorie") == "vacanta_cheltuita":
                archived_vacation_spent += parse_decimal_value(item.get("suma_eur"))

    puse += archived_vacation_saved
    cheltuite += archived_vacation_spent

    return Response(
        {
            "puse_deoparte": puse,
            "cheltuite": cheltuite,
            "ramase": puse - cheltuite,
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def categorii_investitii(request):
    return Response(investment_category_response_items([request.user.id]))


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def miscare_fond(request):
    serializer = MiscareFondSerializer(
        data=request.data,
        context={"request": request},
    )
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    miscare = serializer.save(user=request.user)

    # dacă e retragere, transformăm suma în negativ
    if miscare.tip == "retrage":
        if miscare.suma_eur:
            miscare.suma_eur = -abs(miscare.suma_eur)
        if miscare.suma_ron:
            miscare.suma_ron = -abs(miscare.suma_ron)
        miscare.save()
    elif miscare.tip == "adauga":
        if miscare.suma_eur:
            miscare.suma_eur = abs(miscare.suma_eur)
        if miscare.suma_ron:
            miscare.suma_ron = abs(miscare.suma_ron)
        miscare.save()

    return Response(
        MiscareFondSerializer(miscare, context={"request": request}).data,
        status=status.HTTP_201_CREATED,
    )


@api_view(["PUT", "DELETE"])
@permission_classes([IsAuthenticated])
def miscare_fond_detail(request, pk):
    try:
        miscare = MiscareFond.objects.get(pk=pk, user=request.user)
    except MiscareFond.DoesNotExist:
        return Response(
            {"detail": "Mișcarea nu există."}, status=status.HTTP_404_NOT_FOUND
        )

    if request.method == "DELETE":
        miscare.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    serializer = MiscareFondSerializer(
        miscare,
        data=request.data,
        partial=True,
        context={"request": request},
    )
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    miscare = serializer.save()

    if miscare.tip == "retrage":
        if miscare.suma_eur:
            miscare.suma_eur = -abs(miscare.suma_eur)
        if miscare.suma_ron:
            miscare.suma_ron = -abs(miscare.suma_ron)
        miscare.save()
    elif miscare.tip == "adauga":
        if miscare.suma_eur:
            miscare.suma_eur = abs(miscare.suma_eur)
        if miscare.suma_ron:
            miscare.suma_ron = abs(miscare.suma_ron)
        miscare.save()

    return Response(MiscareFondSerializer(miscare, context={"request": request}).data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def fonduri(request):
    sync_auto_investments_for_user(request.user)

    qs = MiscareFond.objects.filter(user=request.user)

    total_eur = qs.aggregate(total=Sum("suma_eur"))["total"] or 0
    total_ron = qs.aggregate(total=Sum("suma_ron"))["total"] or 0

    serializer = MiscareFondSerializer(qs, many=True, context={"request": request})

    return Response(
        {
            "total_eur": total_eur,
            "total_ron": total_ron,
            "miscari": serializer.data,
            "categorii": investment_category_response_items([request.user.id]),
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def fonduri_bridge(request):
    connected_user_ids = get_connected_user_ids(request.user)
    connected_users = {
        user.id: user for user in User.objects.filter(id__in=connected_user_ids)
    }
    bridge_users = [
        connected_users[user_id]
        for user_id in connected_user_ids
        if user_id in connected_users
    ]
    default_labels = dict(DEFAULT_INVESTMENT_CATEGORIES)
    response_users = []
    combined_total_eur = Decimal("0")
    combined_total_ron = Decimal("0")

    for bridge_user in bridge_users:
        sync_auto_investments_for_user(bridge_user)
        category_labels = {
            **default_labels,
            **dict(
                InvestitieCategorie.objects.filter(user=bridge_user).values_list(
                    "value", "label"
                )
            ),
        }
        totals = (
            MiscareFond.objects.filter(user=bridge_user)
            .values("rubrica")
            .annotate(total_eur=Sum("suma_eur"), total_ron=Sum("suma_ron"))
            .order_by("rubrica")
        )

        rubrici = []
        total_eur = Decimal("0")
        total_ron = Decimal("0")
        for row in totals:
            rubrica_total_eur = row["total_eur"] or Decimal("0")
            rubrica_total_ron = row["total_ron"] or Decimal("0")
            total_eur += rubrica_total_eur
            total_ron += rubrica_total_ron
            rubrici.append(
                {
                    "value": row["rubrica"],
                    "label": category_labels.get(row["rubrica"], row["rubrica"]),
                    "total_eur": rubrica_total_eur,
                    "total_ron": rubrica_total_ron,
                }
            )

        combined_total_eur += total_eur
        combined_total_ron += total_ron

        response_users.append(
            {
                "user_id": bridge_user.id,
                "username": bridge_user.username,
                "is_current_user": bridge_user.id == request.user.id,
                "total_eur": total_eur,
                "total_ron": total_ron,
                "rubrici": rubrici,
            }
        )

    return Response(
        {
            "users": response_users,
            "connected_user_count": max(0, len(response_users) - 1),
            "combined_total_eur": combined_total_eur,
            "combined_total_ron": combined_total_ron,
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def fonduri_grafic(request):
    sync_auto_investments_for_user(request.user)

    qs = MiscareFond.objects.filter(user=request.user)

    total_eur = qs.aggregate(total=Sum("suma_eur"))["total"] or 0
    total_ron = qs.aggregate(total=Sum("suma_ron"))["total"] or 0

    return Response(
        {
            "labels": ["EUR", "RON"],
            "data": [total_eur, total_ron],
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def fonduri_grafic_timeline(request):
    sync_auto_investments_for_user(request.user)

    qs = (
        MiscareFond.objects.filter(user=request.user)
        .annotate(zi=TruncDate("data"))
        .values("zi")
        .annotate(
            eur=Sum("suma_eur"),
            ron=Sum("suma_ron"),
        )
        .order_by("zi")
    )

    labels = []
    eur = []
    ron = []

    sold_eur = 0
    sold_ron = 0

    for r in qs:
        sold_eur += r["eur"] or 0
        sold_ron += r["ron"] or 0
        labels.append(r["zi"])
        eur.append(sold_eur)
        ron.append(sold_ron)

    return Response(
        {
            "labels": labels,
            "datasets": [
                {"label": "EUR", "data": eur},
                {"label": "RON", "data": ron},
            ],
        }
    )


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def venit_status_lunar(request):
    user_ids = get_connected_user_ids(request.user)
    venituri = Venit.objects.filter(user_id__in=user_ids)

    luni = {}
    start_day = get_user_budget_start_day(request.user)

    for v in venituri:
        start, _ = perioada_bugetara(v.data, start_day=start_day)
        key = f"{start.year}-{start.month:02d}"
        luni.setdefault(key, 0)
        luni[key] += float(convert_amount_to_eur(v.suma, v.moneda))

    for archive in FinancialArchive.objects.filter(
        user_id__in=user_ids,
        status=FinancialArchive.Status.READY,
    ):
        try:
            archived_income = load_manifest(archive).get("records", {}).get(
                "venituri",
                [],
            )
        except ArchiveError:
            continue
        for item in archived_income:
            income_date = date.fromisoformat(item["data"])
            start, _ = perioada_bugetara(income_date, start_day=start_day)
            key = f"{start.year}-{start.month:02d}"
            luni.setdefault(key, 0)
            luni[key] += float(parse_decimal_value(item.get("suma_eur")))

    labels = sorted(luni.keys())
    data = [luni[l] for l in labels]

    return Response(
        {
            "labels": labels,
            "data": data,
        }
    )


def serialize_admin_user(user):
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "is_staff": user.is_staff,
        "is_superuser": user.is_superuser,
        "date_joined": user.date_joined,
    }


@api_view(["GET", "POST"])
@permission_classes([IsAdminUser])
def lista_utilizatori(request):
    if request.method == "POST":
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(serialize_admin_user(user), status=status.HTTP_201_CREATED)

    users = User.objects.all().order_by("-date_joined")
    return Response([serialize_admin_user(user) for user in users])


@api_view(["PUT"])
@permission_classes([IsAdminUser])
def update_user(request, pk):
    user = User.objects.get(pk=pk)

    user.username = request.data.get("username", user.username)
    user.email = request.data.get("email", user.email)
    user.is_staff = request.data.get("is_staff", user.is_staff)
    user.is_superuser = request.data.get("is_superuser", user.is_superuser)

    user.save()

    return Response({"success": True})


@api_view(["GET"])
@permission_classes([IsAdminUser])
def admin_stats(request):
    total_venit = sum_queryset_amounts_as_eur(Venit.objects.all())
    total_cheltuieli = sum_queryset_amounts_as_eur(
        CheltuialaFixa.objects.all()
    ) + sum_queryset_amounts_as_eur(CheltuialaVariabila.objects.all())

    for archive in FinancialArchive.objects.filter(
        status=FinancialArchive.Status.READY
    ):
        total_venit += parse_decimal_value(archive.totals.get("venit_brut"))
        total_cheltuieli += parse_decimal_value(
            archive.totals.get("fixe_total")
        ) + parse_decimal_value(archive.totals.get("variabile"))

    economii = total_venit - total_cheltuieli

    return Response(
        {
            "total_venit": total_venit,
            "total_cheltuieli": total_cheltuieli,
            "economii": economii,
        }
    )


@api_view(["DELETE"])
@permission_classes([IsAdminUser])
def delete_user(request, pk):
    try:
        user = User.objects.get(pk=pk)

        # protecție – să nu se șteargă singur
        if user == request.user:
            return Response(
                {"error": "Nu te poți șterge singur"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        deleted_email = user.email
        with transaction.atomic():
            EmailChangeRequest.objects.filter(
                Q(user=user) | Q(new_email__iexact=deleted_email)
            ).delete()
            UserBridge.objects.filter(Q(from_user=user) | Q(to_user=user)).delete()
            Credit.objects.filter(user=user).delete()
            Venit.objects.filter(user=user).delete()
            CheltuialaFixa.objects.filter(user=user).delete()
            CheltuialaFixaAutomata.objects.filter(user=user).delete()
            CheltuialaVariabila.objects.filter(user=user).delete()
            EconomieVacanta.objects.filter(user=user).delete()
            EconomieLunara.objects.filter(user=user).delete()
            InvestitieAutomata.objects.filter(user=user).delete()
            InvestitieCategorie.objects.filter(user=user).delete()
            MiscareFond.objects.filter(user=user).delete()
            Fond.objects.filter(user=user).delete()
            RealizariTarget.objects.filter(user=user).delete()
            ObiectivCheltuieliGlobal.objects.filter(user=user).delete()
            SalarySchedule.objects.filter(user=user).delete()
            profile_obj = UserProfile.objects.filter(user=user).first()
            if profile_obj:
                remove_profile_photo_file(profile_obj.poza)
            UserProfile.objects.filter(user=user).delete()

            user.email = f"deleted-{user.pk}@deleted.local"
            user.username = f"deleted-user-{user.pk}"
            user.save(update_fields=["email", "username"])
            user.delete()

        return Response({"success": True, "deleted_email": deleted_email})
    except User.DoesNotExist:
        return Response(status=status.HTTP_404_NOT_FOUND)

@api_view(["GET"])
@permission_classes([IsAuthenticated])
def lista_useri_simpli(request):
    users = User.objects.exclude(id=request.user.id)

    data = [
        {
            "id": u.id,
            "username": u.username,
        }
        for u in users
    ]

    return Response(data)


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def send_bridge(request):
    to_user_id = request.data.get("user_id")

    if not to_user_id:
        return Response({"error": "User required"}, status=400)

    if str(to_user_id) == str(request.user.id):
        return Response({"error": "Nu poti trimite bridge catre contul tau."}, status=400)

    existing = UserBridge.objects.filter(
        Q(from_user=request.user, to_user_id=to_user_id)
        | Q(from_user_id=to_user_id, to_user=request.user)
    ).first()

    if existing:
        return Response(
            {
                "success": True,
                "id": existing.id,
                "accepted": existing.accepted,
                "message": "Exista deja o cerere sau conexiune bridge.",
            }
        )

    UserBridge.objects.create(from_user=request.user, to_user_id=to_user_id)

    return Response({"success": True})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def accept_bridge(request, pk):
    bridge = UserBridge.objects.get(pk=pk, to_user=request.user)
    bridge.accepted = True
    bridge.save()

    return Response({"success": True})


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def bridge_requests(request):
    bridges = UserBridge.objects.filter(to_user=request.user, accepted=False)

    data = []
    seen_user_ids = set()
    for bridge in bridges:
        if bridge.from_user_id in seen_user_ids:
            continue
        seen_user_ids.add(bridge.from_user_id)
        data.append({"id": bridge.id, "from_user": bridge.from_user.username})

    return Response(data)


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def bridge_connections(request):
    bridges = UserBridge.objects.filter(accepted=True).filter(
        Q(from_user=request.user) | Q(to_user=request.user)
    )

    data = []
    seen_user_ids = set()
    for bridge in bridges:
        connected_user = (
            bridge.to_user if bridge.from_user_id == request.user.id else bridge.from_user
        )
        if connected_user.id in seen_user_ids:
            continue
        seen_user_ids.add(connected_user.id)
        data.append(
            {
                "id": bridge.id,
                "user_id": connected_user.id,
                "username": connected_user.username,
                "email": connected_user.email,
            }
        )

    return Response(data)

# grafice invetitii fonduri pentru conturi  conectate (ex. eu + partener) – total și separat per user


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def fonduri_grafic_timeline_extended(request):
    user_ids = get_connected_user_ids(request.user)
    sync_auto_investments_for_users(request.user)

    # TOTAL (toți conectați)
    qs_total = (
        MiscareFond.objects.filter(user_id__in=user_ids)
        .annotate(zi=TruncDate("data"))
        .values("zi")
        .annotate(
            eur=Sum("suma_eur"),
            ron=Sum("suma_ron"),
        )
        .order_by("zi")
    )

    def build_timeline(qs):
        labels = []
        eur = []
        ron = []

        sold_eur = 0
        sold_ron = 0

        for r in qs:
            sold_eur += r["eur"] or 0
            sold_ron += r["ron"] or 0
            labels.append(r["zi"])
            eur.append(sold_eur)
            ron.append(sold_ron)

        return {
            "labels": labels,
            "datasets": [
                {"label": "EUR", "data": eur},
                {"label": "RON", "data": ron},
            ],
        }

    total_data = build_timeline(qs_total)

    # PER USER
    per_user = {}

    users = User.objects.filter(id__in=user_ids)

    for u in users:
        qs_user = (
            MiscareFond.objects.filter(user=u)
            .annotate(zi=TruncDate("data"))
            .values("zi")
            .annotate(
                eur=Sum("suma_eur"),
                ron=Sum("suma_ron"),
            )
            .order_by("zi")
        )

        per_user[u.username] = build_timeline(qs_user)

    return Response({"total": total_data, "per_user": per_user})
