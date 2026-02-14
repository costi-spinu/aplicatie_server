from django.contrib.auth.models import User
from rest_framework import serializers
from rest_framework.validators import UniqueValidator
from .models import Fond, MiscareFond

from .models import (
    Venit,
    CheltuialaFixa,
    CheltuialaVariabila,
    EconomieVacanta,
    EconomieLunara,
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
        return user


class VenitSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = Venit
        exclude = ("user",)
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


# class MiscareFondSerializer(serializers.ModelSerializer):
#     class Meta:
#         model = MiscareFond
#         exclude = ("user",)

#     def validate(self, data):
#         if not data.get("suma_eur") and not data.get("suma_ron"):
#             raise serializers.ValidationError("Trebuie completata suma EUR sau RON")
#         return data


# class MiscareFondSerializer(serializers.ModelSerializer):
#     class Meta:
#         model = MiscareFond
#         exclude = ("user",)

#     def validate(self, data):
#         if not data.get("suma_eur") and not data.get("suma_ron"):
#             raise serializers.ValidationError("Trebuie completată suma în EUR sau RON")
#         return data


class MiscareFondSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)

    class Meta:
        model = MiscareFond
        exclude = ("user",)

    def validate(self, data):
        if not data.get("suma_eur") and not data.get("suma_ron"):
            raise serializers.ValidationError("Trebuie completată suma în EUR sau RON")
        return data
