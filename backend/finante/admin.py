from django.contrib import admin
from .models import CheltuialaFixaAutomata, Fond


@admin.register(Fond)
class FondAdmin(admin.ModelAdmin):
    list_display = ("user", "suma_eur", "suma_ron", "data")
    search_fields = ("user__username", "observatii")


@admin.register(CheltuialaFixaAutomata)
class CheltuialaFixaAutomataAdmin(admin.ModelAdmin):
    list_display = ("user", "denumire", "data", "cursivitate", "suma", "moneda", "activ")
    list_filter = ("cursivitate", "activ", "moneda")
    search_fields = ("user__username", "denumire")
