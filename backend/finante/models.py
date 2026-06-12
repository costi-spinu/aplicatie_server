from django.db import models
from django.contrib.auth.models import User
from django.utils.timezone import now
from django.utils import timezone
from django.core.validators import MinValueValidator, MaxValueValidator


class Moneda(models.TextChoices):
    EUR = "EUR", "Euro"
    RON = "RON", "Lei"


class CategorieVariabila(models.TextChoices):
    ALIMENTE = "alimente", "Alimente"
    SANATATE = "sanatate", "Sănătate"
    AUTO = "auto", "Auto"
    CULTURA = "cultura", "Cultură"
    SHOPPING = "shopping", "Shopping"
    NEPREVAZUTE = "neprevazute", "Neprevăzute"
    ECONOMII = "economii", "Economii"
    VACANTA = "vacanta", "Vacanță"
    ANIMALUTE = "animalute", "Animăluțe"
    DIVERTISMENT = "divertisment", "Divertisment"  # 🆕
    INVESTITII = "investitii", "Investiții"  # 🆕
    VACANTA_CHELTUITA = "vacanta_cheltuita", "Vacanță Cheltuită"


class CursivitateCheltuialaFixa(models.TextChoices):
    LUNAR = "lunar", "O data pe luna"
    DE_DOUA_ORI_LUNA = "de_doua_ori_luna", "De 2 ori pe luna"
    DE_TREI_ORI_LUNA = "de_trei_ori_luna", "De 3 ori pe luna"
    LA_2_LUNI = "la_2_luni", "O data la 2 luni"
    LA_3_LUNI = "la_3_luni", "O data la 3 luni"
    LA_6_LUNI = "la_6_luni", "O data la 6 luni"
    ANUAL = "anual", "O data pe an"


class TipVacanta(models.TextChoices):
    ECONOMII = "economii", "Economii"
    CHELTUIELI = "cheltuieli", "Cheltuieli"


class Venit(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="venituri",
    )
    suma = models.DecimalField(max_digits=10, decimal_places=2)
    moneda = models.CharField(max_length=3, choices=Moneda.choices)

    data = models.DateField(default=timezone.localdate)  # data venitului
    created_at = models.DateTimeField(auto_now_add=True)  # 👈 momentul adăugării
    updated_at = models.DateTimeField(auto_now=True)  # ultima modificare
    sursa = models.CharField(max_length=30, blank=True, default="manual")
    salary_schedule = models.ForeignKey(
        "SalarySchedule",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="venituri_generate",
    )

    class Meta:
        ordering = ["-created_at"]  # 👈 cheia problemei

    def __str__(self):
        return f"{self.user.username} | {self.suma} {self.moneda}"


class CheltuialaFixa(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="cheltuieli_fixe",
    )
    descriere = models.CharField(max_length=100)
    suma = models.DecimalField(max_digits=10, decimal_places=2)
    moneda = models.CharField(max_length=3, choices=Moneda.choices)
    sursa = models.CharField(max_length=30, blank=True, default="manual")
    automatizare = models.ForeignKey(
        "CheltuialaFixaAutomata",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="cheltuieli_generate",
    )

    data = models.DateField(default=timezone.localdate)  # 👈 data ALEASĂ
    created_at = models.DateTimeField(auto_now_add=True)  # 👈 când a fost adăugată
    updated_at = models.DateTimeField(auto_now=True)  # 👈 ultima modificare

    class Meta:
        ordering = ["-data"]  # 👈 ordonăm după data aleasă, nu după momentul adăugării

    def __str__(self):
        return f"{self.descriere} | {self.suma} {self.moneda}"


class CheltuialaFixaAutomata(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="cheltuieli_fixe_automate",
    )
    denumire = models.CharField(max_length=100)
    data = models.DateField(default=timezone.localdate)
    cursivitate = models.CharField(
        max_length=30,
        choices=CursivitateCheltuialaFixa.choices,
        default=CursivitateCheltuialaFixa.LUNAR,
    )
    suma = models.DecimalField(max_digits=10, decimal_places=2)
    moneda = models.CharField(max_length=3, choices=Moneda.choices)
    activ = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["data", "id"]

    def __str__(self):
        return f"{self.denumire} | {self.suma} {self.moneda}"


class CheltuialaVariabila(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="cheltuieli_variabile",
    )
    categorie = models.CharField(
        max_length=20,
        choices=CategorieVariabila.choices,
    )
    suma = models.DecimalField(max_digits=10, decimal_places=2)
    moneda = models.CharField(max_length=3, choices=Moneda.choices)

    data = models.DateField(default=timezone.localdate)  # 👈 data ALEASĂ
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-data"]  # 👈 ordonăm după data aleasă, nu după momentul adăugării

    def __str__(self):
        return f"{self.categorie} | {self.suma} {self.moneda}"


class EconomieVacanta(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="economii_vacanta",
    )
    tip = models.CharField(
        max_length=15,
        choices=TipVacanta.choices,
    )
    suma = models.DecimalField(max_digits=10, decimal_places=2)
    moneda = models.CharField(max_length=3, choices=Moneda.choices)
    data = models.DateField(auto_now_add=True)

    class Meta:
        ordering = ["-data"]

    def __str__(self):
        return f"{self.tip} | {self.suma} {self.moneda}"


class EconomieLunara(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="economii_lunare",
    )
    luna = models.CharField(max_length=7)  # ex: 2026-02
    sold = models.DecimalField(max_digits=10, decimal_places=2, default=0)

    class Meta:
        unique_together = ("user", "luna")
        ordering = ["luna"]

    def __str__(self):
        return f"{self.user.username} | {self.luna} → {self.sold} EUR"


class Fond(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="fonduri",
    )
    suma_eur = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
    )
    suma_ron = models.DecimalField(
        max_digits=10,
        decimal_places=2,
        null=True,
        blank=True,
    )
    observatii = models.TextField(blank=True)
    data = models.DateField(auto_now_add=True)

    class Meta:
        ordering = ["-data"]

    def __str__(self):
        return f"{self.user.username} | EUR: {self.suma_eur} | RON: {self.suma_ron}"


# class MiscareFond(models.Model):
#     TIP = (
#         ("adauga", "Adauga"),
#         ("retrage", "Retrage"),
#     )

#     user = models.ForeignKey(User, on_delete=models.CASCADE)
#     tip = models.CharField(max_length=10, choices=TIP)
#     suma_eur = models.DecimalField(
#         max_digits=10, decimal_places=2, null=True, blank=True
#     )
#     suma_ron = models.DecimalField(
#         max_digits=10, decimal_places=2, null=True, blank=True
#     )
#     observatii = models.TextField(blank=True)
#     data = models.DateField(auto_now_add=True)


class MiscareFond(models.Model):
    TIP = (
        ("adauga", "Adauga"),
        ("retrage", "Retrage"),
    )

    RUBRICI = (
        ("fond_urgenta", "Fond de urgență"),
        ("trading212", "Investiții - Trading212"),
        ("xtb", "Investiții - XTB"),
        ("revolut", "Investiții - Revolut"),
        ("tradeville", "Investiții - Tradeville"),
        ("cont_economii", "Cont de economii"),
        ("alte_investitii", "Alte investiții"),
    )

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="miscari_fonduri",
    )
    tip = models.CharField(max_length=10, choices=TIP)
    rubrica = models.CharField(
        max_length=30,
        choices=RUBRICI,
        default="alte_investitii",
    )
    suma_eur = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True
    )
    suma_ron = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True
    )
    observatii = models.TextField(blank=True)
    data = models.DateField(auto_now_add=True)

    class Meta:
        ordering = ["-data"]

    def __str__(self):
        return f"{self.user.username} | {self.tip} | EUR:{self.suma_eur} RON:{self.suma_ron}"


from django.contrib.auth.models import User


class UserBridge(models.Model):
    from_user = models.ForeignKey(
        User, related_name="sent_bridges", on_delete=models.CASCADE
    )
    to_user = models.ForeignKey(
        User, related_name="received_bridges", on_delete=models.CASCADE
    )
    accepted = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)


class RealizariTarget(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="realizari_targets",
    )
    luna = models.CharField(max_length=7)
    fixed_target = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    category_targets = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ("user", "luna")
        ordering = ["-luna"]

    def __str__(self):
        return f"{self.user.username} | {self.luna}"


class ObiectivCheltuieliGlobal(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="obiectiv_cheltuieli_global",
    )
    fixed_target = models.DecimalField(max_digits=10, decimal_places=2, default=0)
    category_targets = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username} | obiective globale"


class UserProfile(models.Model):
    user = models.OneToOneField(
        User,
        on_delete=models.CASCADE,
        related_name="profile",
    )
    poza = models.TextField(blank=True, default="")
    data_nasterii = models.DateField(null=True, blank=True)
    ocupatia = models.CharField(max_length=120, blank=True, default="")
    telefon = models.CharField(max_length=30, blank=True, default="")
    venit_estimat = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True
    )
    venit_estimat_lunar = models.DecimalField(
        max_digits=10, decimal_places=2, null=True, blank=True
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Profil {self.user.username}"


class SalarySchedule(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="salary_schedules",
    )
    zi = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(31)]
    )
    data = models.DateField(default=timezone.localdate)
    ocupatie = models.CharField(max_length=120, blank=True, default="")
    suma = models.DecimalField(max_digits=10, decimal_places=2)
    moneda = models.CharField(max_length=3, choices=Moneda.choices, default=Moneda.RON)
    activ = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["zi", "id"]

    def __str__(self):
        return f"{self.user.username} | ziua {self.zi} | {self.suma} {self.moneda}"


class EmailChangeRequest(models.Model):
    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="email_change_requests",
    )
    new_email = models.EmailField()
    code = models.CharField(max_length=64, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    used_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"{self.user.username} -> {self.new_email}"
