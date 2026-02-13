from datetime import date, timedelta

def get_luna_bugetara(ref_date=None):
    """
    Returnează perioada lunii bugetare:
    - începe pe 26
    - se termină pe 25
    """

    if ref_date is None:
        ref_date = date.today()

    if ref_date.day >= 26:
        start = ref_date.replace(day=26)

        # luna următoare
        if start.month == 12:
            end = date(start.year + 1, 1, 25)
        else:
            end = date(start.year, start.month + 1, 25)
    else:
        end = ref_date.replace(day=25)

        # luna anterioară
        if end.month == 1:
            start = date(end.year - 1, 12, 26)
        else:
            start = date(end.year, end.month - 1, 26)

    return start, end
