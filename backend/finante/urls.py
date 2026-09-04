from django.urls import path, include
from rest_framework.routers import DefaultRouter

from .views import (
    # auth / user
    RegisterView,
    me,
    # viewsets
    CreditViewSet,
    VenitViewSet,
    CheltuialaFixaViewSet,
    CheltuialaFixaAutomataViewSet,
    CheltuialaVariabilaViewSet,
    InvestitieAutomataViewSet,
    InvestitieCategorieViewSet,
    SalaryScheduleViewSet,
    EconomieVacantaViewSet,
    # function views
    venit_total_lunar,
    buget_lunar,
    grafice_luna,
    raport_bugetar,
    calculeaza_economii_luna,
    istoric_economii,
    economii_vacanta_sumar,
    categorii_investitii,
    fonduri,
    fonduri_bridge,
    miscare_fond,
    miscare_fond_detail,
    fonduri_grafic,
    fonduri_grafic_timeline,
    venit_status_lunar,
    lista_utilizatori,
    update_user,
    admin_stats,
    delete_user,
    lista_useri_simpli,
    send_bridge,
    bridge_requests,
    bridge_connections,
    accept_bridge,
    fonduri_grafic_timeline_extended,
    RealizariTargetViewSet,
    profile,
    change_password,
    request_email_change,
    confirm_email_change,
    obiective_cheltuieli_global,
    curs_bnr,
    install_info,
    perioada_bugetara_config,
    arhive_financiare,
    ruleaza_arhivarea,
    descarca_arhiva,
)

router = DefaultRouter()
router.register(r"venituri", VenitViewSet, basename="venituri")
router.register(r"credite", CreditViewSet, basename="credite")
router.register(r"salary-schedules", SalaryScheduleViewSet, basename="salary-schedules")
router.register(
    r"investitii-categorii",
    InvestitieCategorieViewSet,
    basename="investitii-categorii",
)
router.register(
    r"investitii-automate",
    InvestitieAutomataViewSet,
    basename="investitii-automate",
)
router.register(
    r"realizari-targets", RealizariTargetViewSet, basename="realizari-targets"
)
router.register(r"cheltuieli-fixe", CheltuialaFixaViewSet, basename="cheltuieli-fixe")
router.register(
    r"cheltuieli-fixe-automate",
    CheltuialaFixaAutomataViewSet,
    basename="cheltuieli-fixe-automate",
)
router.register(
    r"cheltuieli-variabile",
    CheltuialaVariabilaViewSet,
    basename="cheltuieli-variabile",
)
router.register(
    r"economii-vacanta",
    EconomieVacantaViewSet,
    basename="economii-vacanta",
)
urlpatterns = [
    # auth
    path("register/", RegisterView.as_view(), name="register"),
    path("me/", me, name="me"),
    path(
        "perioada-bugetara/",
        perioada_bugetara_config,
        name="perioada-bugetara",
    ),
    path("arhive/", arhive_financiare, name="arhive-financiare"),
    path("arhive/ruleaza/", ruleaza_arhivarea, name="ruleaza-arhivarea"),
    path(
        "arhive/<uuid:archive_id>/<str:file_kind>/",
        descarca_arhiva,
        name="descarca-arhiva",
    ),
    path("profile/", profile, name="profile"),
    path("profile/password/", change_password, name="change-password"),
    path("email-change/request/", request_email_change, name="email-change-request"),
    path("email-change/confirm/", confirm_email_change, name="email-change-confirm"),
    path(
        "email-change/confirm/<str:code>/",
        confirm_email_change,
        name="email-change-confirm-link",
    ),
    # statistici / calcule
    path("venit/total/", venit_total_lunar, name="venit-total"),
    path("venit/status/", venit_status_lunar, name="venit-status"),
    path("curs-bnr/", curs_bnr, name="curs-bnr"),
    path("install/info/", install_info, name="install-info"),
    path("buget/lunar/", buget_lunar, name="buget-lunar"),
    path("grafice/luna/", grafice_luna, name="grafice-luna"),
    path("raport/bugetar/", raport_bugetar, name="raport-bugetar"),
    path(
        "obiective-cheltuieli-global/",
        obiective_cheltuieli_global,
        name="obiective-cheltuieli-global",
    ),
    # economii
    path("economii/calculeaza/", calculeaza_economii_luna, name="economii-calculeaza"),
    path("economii/istoric/", istoric_economii, name="economii-istoric"),
    # router urls
    path("", include(router.urls)),
    path("economii/vacanta/", economii_vacanta_sumar, name="economii-vacanta-sumar"),
    path("fonduri/", fonduri, name="fonduri"),
    path("fonduri/bridge/", fonduri_bridge, name="fonduri-bridge"),
    path("fonduri/categorii/", categorii_investitii, name="fonduri-categorii"),
    path("fonduri/miscare/", miscare_fond, name="miscare-fond"),
    path("fonduri/miscare/<int:pk>/", miscare_fond_detail, name="miscare-fond-detail"),
    path("fonduri/grafic/", fonduri_grafic, name="fonduri-grafic"),
    path(
        "fonduri/grafic/timeline/",
        fonduri_grafic_timeline,
        name="fonduri-grafic-timeline",
    ),
    path("admin/users/", lista_utilizatori),
    path("admin/users/<int:pk>/", update_user),
    path("admin/stats/", admin_stats),
    path("admin/users/<int:pk>/delete/", delete_user),
    path("users/list/", lista_useri_simpli),
    path("bridge/send/", send_bridge),
    path("bridge/requests/", bridge_requests),
    path("bridge/connections/", bridge_connections),
    path("bridge/accept/<int:pk>/", accept_bridge),
    path("fonduri/grafic/timeline/extended/", fonduri_grafic_timeline_extended),
]
