from django.contrib.auth import get_user_model
from django.db.models import Q
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from rest_framework_simplejwt.views import TokenObtainPairView


class FlexibleTokenObtainPairSerializer(TokenObtainPairSerializer):
    """
    Accepta autentificarea cu username sau email, fara sa conteze literele mari/mici.

    Frontend-ul trimite campul `username`; inainte ca SimpleJWT sa verifice parola,
    gasim utilizatorul real din baza de date si inlocuim valoarea cu username-ul exact
    salvat in Django. Astfel `costi`, `Costi` sau emailul contului ajung la acelasi
    utilizator, dar parola ramane verificata de mecanismul standard Django.
    """

    default_error_messages = {
        "no_active_account": "Nu exista un cont activ cu aceste date de autentificare."
    }

    def validate(self, attrs):
        login_value = (
            attrs.get(self.username_field) or attrs.get("username") or ""
        ).strip()
        attrs[self.username_field] = login_value

        if login_value:
            user = (
                get_user_model()
                .objects.filter(
                    Q(username__iexact=login_value) | Q(email__iexact=login_value)
                )
                .order_by("id")
                .first()
            )
            if user:
                attrs[self.username_field] = user.get_username()

        data = super().validate(attrs)
        data["user"] = {
            "id": self.user.id,
            "username": self.user.get_username(),
            "email": self.user.email,
        }
        return data


class FlexibleTokenObtainPairView(TokenObtainPairView):
    serializer_class = FlexibleTokenObtainPairSerializer
