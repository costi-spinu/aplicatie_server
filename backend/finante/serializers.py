from django.contrib.auth.models import User
from rest_framework import serializers
from rest_framework.validators import UniqueValidator
from .models import Fond, MiscareFond

from .models import (
    Venit,
    CheltuialaFixa,
    CheltuialaFixaAutomata,
    CheltuialaVariabila,
    EconomieVacanta,
    EconomieLunara,
    ObiectivCheltuieliGlobal,
    RealizariTarget,
    UserProfile,
    SalarySchedule,
)


class RegisterSerializer(serializers.ModelSerializer):
    username = serializers.CharField(
        validators=[UniqueValidator(queryset=User.objects.all())]
    )
    email = serializers.EmailField(
        validators=[UniqueValidator(queryset=User.objects.all())]
    )
    password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = User
        fields = ("username", "email", "password")

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


class FondSerializer(serializers.ModelSerializer):
    class Meta:
        model = Fond
        exclude = ("user",)
        read_only_fields = ("data",)


class MiscareFondSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = MiscareFond
        exclude = ("user",)

    def validate(self, data):
        if not data.get("suma_eur") and not data.get("suma_ron"):
            raise serializers.ValidationError("Trebuie completată suma în EUR sau RON")
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
