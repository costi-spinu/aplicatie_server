from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_simplejwt.views import (
    TokenObtainPairView,
    TokenRefreshView,
)


from .views import (
    # auth / user
    RegisterView,
    me,
    # viewsets
    VenitViewSet,
    CheltuialaFixaViewSet,
    CheltuialaVariabilaViewSet,
    EconomieVacantaViewSet,
    # function views
    venit_total_lunar,
    buget_lunar,
    grafice_luna,
    calculeaza_economii_luna,
    istoric_economii,
    economii_vacanta_sumar,
    fonduri,
    miscare_fond,
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
    accept_bridge,
    fonduri_grafic_timeline_extended,
    FondViewSet,
)

router = DefaultRouter()
router.register(r"venituri", VenitViewSet, basename="venituri")
router.register(r"cheltuieli-fixe", CheltuialaFixaViewSet, basename="cheltuieli-fixe")
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
# router.register(r"fonduri", FondViewSet, basename="fonduri")
urlpatterns = [
    # auth
    path("register/", RegisterView.as_view(), name="register"),
    path("me/", me, name="me"),
    # statistici / calcule
    path("venit/total/", venit_total_lunar, name="venit-total"),
    path("venit/status/", venit_status_lunar, name="venit-status"),
    path("buget/lunar/", buget_lunar, name="buget-lunar"),
    path("grafice/luna/", grafice_luna, name="grafice-luna"),
    # economii
    path("economii/calculeaza/", calculeaza_economii_luna, name="economii-calculeaza"),
    path("economii/istoric/", istoric_economii, name="economii-istoric"),
    # router urls
    path("", include(router.urls)),
    path("economii/vacanta/", economii_vacanta_sumar, name="economii-vacanta-sumar"),
    path("fonduri/", fonduri, name="fonduri"),
    path("fonduri/miscare/", miscare_fond, name="miscare-fond"),
    path("fonduri/grafic/", fonduri_grafic, name="fonduri-grafic"),
    path(
        "fonduri/grafic/timeline/",
        fonduri_grafic_timeline,
        name="fonduri-grafic-timeline",
    ),
    path("admin/users/", lista_utilizatori),
    path("admin/users/<int:pk>/", update_user),
    path("admin/stats/", admin_stats),
    path("admin/users/<int:pk>/", update_user),
    path("admin/users/<int:pk>/delete/", delete_user),
    path("users/list/", lista_useri_simpli),
    path("bridge/send/", send_bridge),
    path("bridge/requests/", bridge_requests),
    path("bridge/accept/<int:pk>/", accept_bridge),
    path("fonduri/grafic/timeline/extended/", fonduri_grafic_timeline_extended),
    
]
