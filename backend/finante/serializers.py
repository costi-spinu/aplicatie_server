from django.contrib.auth.models import User
from django.contrib.auth.validators import UnicodeUsernameValidator
from django.db import transaction
from django.utils.text import slugify
from rest_framework import serializers
from .models import (
    Credit,
    DEFAULT_INVESTMENT_CATEGORIES,
    InvestitieAutomata,
    InvestitieCategorie,
    Venit,
    CheltuialaFixa,
    CheltuialaFixaAutomata,
    CheltuialaVariabila,
    EconomieVacanta,
    EconomieLunara,
    MiscareFond,
    ObiectivCheltuieliGlobal,
    RealizariTarget,
    UserProfile,
    SalarySchedule,
)


DEFAULT_INVESTMENT_CATEGORY_VALUES = {
    value for value, _label in DEFAULT_INVESTMENT_CATEGORIES
}


def investment_category_exists(user, value):
    if not value:
        return False
    if value in DEFAULT_INVESTMENT_CATEGORY_VALUES:
        return True
    if not user or not getattr(user, "is_authenticated", False):
        return False
    return InvestitieCategorie.objects.filter(user=user, value=value).exists()


def validate_investment_amounts(data, instance=None, positive_only=False):
    amounts = {
        field: data[field] if field in data else getattr(instance, field, None)
        for field in ("suma_eur", "suma_ron")
    }

    if not any(value not in (None, 0) for value in amounts.values()):
        raise serializers.ValidationError(
            "Trebuie completata suma in EUR sau RON"
        )

    if positive_only:
        invalid_fields = {
            field: "Suma trebuie sa fie mai mare decat zero."
            for field, value in amounts.items()
            if value is not None and value <= 0
        }
        if invalid_fields:
            raise serializers.ValidationError(invalid_fields)


def build_unique_investment_category_value(user, label):
    base_value = slugify(label or "")[:50] or "investitie"
    value = base_value
    suffix = 2

    while (
        value in DEFAULT_INVESTMENT_CATEGORY_VALUES
        or InvestitieCategorie.objects.filter(user=user, value=value).exists()
    ):
        value = f"{base_value[:50]}-{suffix}"
        suffix += 1

    return value


class RegisterSerializer(serializers.ModelSerializer):
    username = serializers.CharField(
        max_length=150,
        validators=[UnicodeUsernameValidator()],
    )
    email = serializers.EmailField(max_length=254)
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = ("username", "email", "password")

    def validate_username(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("Numele de utilizator este obligatoriu.")
        queryset = User.objects.filter(username__iexact=value)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("Acest nume de utilizator este deja folosit.")
        return value

    def validate_email(self, value):
        value = (value or "").strip().lower()
        queryset = User.objects.filter(email__iexact=value)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError("Această adresă de email este deja folosită.")
        return value

    @transaction.atomic
    def create(self, validated_data):
        user = User.objects.create_user(
            username=validated_data["username"],
            email=validated_data["email"],
            password=validated_data["password"],
        )
        UserProfile.objects.get_or_create(user=user)
        return user


class VenitSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = Venit
        exclude = ("user",)
        read_only_fields = ("created_at", "updated_at", "salary_schedule")


class CreditSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = Credit
        fields = (
            "id",
            "denumire",
            "suma",
            "moneda",
            "data",
            "username",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")


class CheltuialaFixaSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = CheltuialaFixa
        fields = [
            "id",
            "descriere",
            "suma",
            "moneda",
            "data",
            "username",
            "sursa",
            "automatizare",
        ]
        read_only_fields = ("sursa", "automatizare")


class CheltuialaFixaAutomataSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = CheltuialaFixaAutomata
        fields = [
            "id",
            "denumire",
            "data",
            "cursivitate",
            "suma",
            "moneda",
            "activ",
            "username",
        ]


class CheltuialaVariabilaSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = CheltuialaVariabila
        fields = [
            "id",
            "categorie",
            "descriere",
            "suma",
            "moneda",
            "data",
            "username",
        ]


class EconomieVacantaSerializer(serializers.ModelSerializer):
    class Meta:
        model = EconomieVacanta
        exclude = ("user",)
        read_only_fields = ("data",)


class EconomieLunaraSerializer(serializers.ModelSerializer):
    class Meta:
        model = EconomieLunara
        fields = ("luna", "sold")
        read_only_fields = ("luna", "sold")


class MiscareFondSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    rubrica = serializers.CharField(max_length=60)

    class Meta:
        model = MiscareFond
        exclude = ("user",)
        read_only_fields = ("automatizare",)

    def validate(self, data):
        validate_investment_amounts(data, self.instance)

        request = self.context.get("request")
        user = request.user if request else None
        value = data.get("rubrica") or getattr(self.instance, "rubrica", None)
        if not investment_category_exists(user, value):
            raise serializers.ValidationError(
                {"rubrica": "Categoria de investitie nu exista."}
            )

        return data


class InvestitieCategorieSerializer(serializers.ModelSerializer):
    class Meta:
        model = InvestitieCategorie
        fields = ("id", "value", "label", "created_at")
        read_only_fields = ("id", "value", "created_at")

    def validate_label(self, value):
        value = (value or "").strip()
        if not value:
            raise serializers.ValidationError("Denumirea categoriei este obligatorie.")
        return value

    def create(self, validated_data):
        request = self.context.get("request")
        user = request.user
        label = validated_data["label"].strip()
        return InvestitieCategorie.objects.create(
            user=user,
            label=label,
            value=build_unique_investment_category_value(user, label),
        )


class InvestitieAutomataSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    rubrica = serializers.CharField(max_length=60)

    class Meta:
        model = InvestitieAutomata
        fields = (
            "id",
            "denumire",
            "data",
            "rubrica",
            "suma_eur",
            "suma_ron",
            "activ",
            "username",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("created_at", "updated_at")

    def validate(self, data):
        validate_investment_amounts(data, self.instance, positive_only=True)

        request = self.context.get("request")
        user = request.user if request else None
        value = data.get("rubrica") or getattr(self.instance, "rubrica", None)
        if not investment_category_exists(user, value):
            raise serializers.ValidationError(
                {"rubrica": "Categoria de investitie nu exista."}
            )

        return data


class RealizariTargetSerializer(serializers.ModelSerializer):
    class Meta:
        model = RealizariTarget
        fields = ("id", "luna", "fixed_target", "category_targets", "updated_at")
        read_only_fields = ("id", "updated_at")


class ObiectivCheltuieliGlobalSerializer(serializers.ModelSerializer):
    class Meta:
        model = ObiectivCheltuieliGlobal
        fields = ("id", "fixed_target", "category_targets", "updated_at")
        read_only_fields = ("id", "updated_at")


class SalaryScheduleSerializer(serializers.ModelSerializer):
    zi = serializers.IntegerField(required=False, min_value=1, max_value=31)

    class Meta:
        model = SalarySchedule
        fields = ("id", "zi", "data", "ocupatie", "suma", "moneda", "activ")

    def validate(self, attrs):
        salary_date = attrs.get("data") or getattr(self.instance, "data", None)
        if salary_date:
            attrs["zi"] = salary_date.day
        elif not attrs.get("zi"):
            attrs["zi"] = 1
        return attrs


class UserProfileSerializer(serializers.ModelSerializer):
    salary_schedules = SalaryScheduleSerializer(
        many=True, source="user.salary_schedules"
    )

    class Meta:
        model = UserProfile
        fields = (
            "poza",
            "data_nasterii",
            "ocupatia",
            "telefon",
            "venit_estimat",
            "venit_estimat_lunar",
            "budget_cycle_start_day",
            "salary_schedules",
        )

    def update(self, instance, validated_data):
        schedules_data = validated_data.pop("user", {}).pop("salary_schedules", None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        if schedules_data is not None:
            Venit.objects.filter(
                user=instance.user,
                salary_schedule__in=instance.user.salary_schedules.all(),
            ).delete()
            instance.user.salary_schedules.all().delete()
            for item in schedules_data:
                SalarySchedule.objects.create(user=instance.user, **item)

        return instance
