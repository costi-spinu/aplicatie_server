from calendar import monthrange
from datetime import date, timedelta


DEFAULT_BUDGET_CYCLE_START_DAY = 26


def clamp_day(year, month, day):
    """Return a valid day in a month, clamping 29-31 when necessary."""
    return min(max(int(day), 1), monthrange(year, month)[1])


def shift_month(year, month, offset):
    month_index = year * 12 + month - 1 + offset
    return month_index // 12, month_index % 12 + 1

def get_luna_bugetara(ref_date=None, start_day=DEFAULT_BUDGET_CYCLE_START_DAY):
    """
    Returnează perioada lunară recurentă care conține data de referință.

    ``start_day`` este inclusiv, iar următoarea apariție a aceleiași zile
    este exclusivă. Rezultatul folosește limite inclusive pentru a rămâne
    compatibil cu filtrele Django ``data__range``. Pentru zilele 29-31,
    capătul este ajustat la ultima zi validă din luna respectivă.
    """

    if ref_date is None:
        ref_date = date.today()

    start_day = min(max(int(start_day), 1), 31)
    current_anchor = date(
        ref_date.year,
        ref_date.month,
        clamp_day(ref_date.year, ref_date.month, start_day),
    )

    if ref_date >= current_anchor:
        start = current_anchor
        next_year, next_month = shift_month(start.year, start.month, 1)
        next_start = date(
            next_year,
            next_month,
            clamp_day(next_year, next_month, start_day),
        )
    else:
        next_start = current_anchor
        previous_year, previous_month = shift_month(
            current_anchor.year,
            current_anchor.month,
            -1,
        )
        start = date(
            previous_year,
            previous_month,
            clamp_day(previous_year, previous_month, start_day),
        )

    end = next_start - timedelta(days=1)

    return start, end


def get_user_budget_start_day(user):
    """Return the authenticated account's configured cycle boundary."""
    if user is None or not getattr(user, "is_authenticated", False):
        return DEFAULT_BUDGET_CYCLE_START_DAY

    # Importul local evită un ciclu models -> utils la pornirea Django.
    from .models import UserProfile

    profile, _created = UserProfile.objects.get_or_create(user=user)
    return profile.budget_cycle_start_day


def get_user_budget_period(user, ref_date=None):
    if ref_date is None:
        from django.utils import timezone

        ref_date = timezone.localdate()
    return get_luna_bugetara(
        ref_date=ref_date,
        start_day=get_user_budget_start_day(user),
    )
