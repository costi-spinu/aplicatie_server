from django.contrib import admin
from .models import Fond


@admin.register(Fond)
class FondAdmin(admin.ModelAdmin):
    list_display = ("user", "suma_eur", "suma_ron", "data")
    search_fields = ("user__username", "observatii")
