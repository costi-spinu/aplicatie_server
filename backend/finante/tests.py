from datetime import date
from decimal import Decimal
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from .models import CheltuialaVariabila, EconomieVacanta, UserProfile


TEST_RATES = {
    "date": "2026-06-14",
    "eur_ron": Decimal("5.00"),
    "ron_eur": Decimal("0.200000"),
}


class FinancialFormulaTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="audit_math_user",
            email="audit_math@example.test",
            password="pass12345",
        )
        UserProfile.objects.get_or_create(user=self.user)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def post_json(self, path, payload):
        response = self.client.post(path, payload, format="json")
        self.assertLess(
            response.status_code,
            400,
            f"{path} failed with {response.status_code}: {response.data}",
        )
        return response

    def seed_budget_month(self):
        self.post_json(
            "/api/venituri/",
            {"suma": "2000.00", "moneda": "EUR", "data": "2026-06-02"},
        )
        self.post_json(
            "/api/salary-schedules/",
            {
                "data": "2026-06-05",
                "ocupatie": "Salariu test",
                "suma": "5000.00",
                "moneda": "RON",
                "activ": True,
            },
        )
        self.post_json(
            "/api/credite/",
            {
                "denumire": "Credit test",
                "suma": "300.00",
                "moneda": "EUR",
                "data": "2026-06-07",
            },
        )
        self.post_json(
            "/api/cheltuieli-fixe/",
            {
                "descriere": "Chirie test",
                "suma": "600.00",
                "moneda": "EUR",
                "data": "2026-06-08",
            },
        )
        self.post_json(
            "/api/cheltuieli-fixe-automate/",
            {
                "denumire": "Abonament automat",
                "data": "2026-05-27",
                "cursivitate": "lunar",
                "suma": "120.00",
                "moneda": "EUR",
                "activ": True,
            },
        )
        self.post_json(
            "/api/cheltuieli-variabile/",
            {
                "categorie": "alimente",
                "suma": "200.00",
                "moneda": "EUR",
                "data": "2026-06-09",
            },
        )
        self.post_json(
            "/api/cheltuieli-variabile/",
            {
                "categorie": "auto",
                "suma": "500.00",
                "moneda": "RON",
                "data": "2026-06-10",
            },
        )
        self.post_json(
            "/api/cheltuieli-variabile/",
            {
                "categorie": "vacanta_cheltuita",
                "suma": "50.00",
                "moneda": "EUR",
                "data": "2026-06-11",
            },
        )

    @patch("finante.views.get_bnr_rates", return_value=TEST_RATES)
    def test_budget_and_month_chart_use_same_full_savings_formula(self, _rates):
        self.seed_budget_month()

        budget = self.client.get("/api/buget/lunar/").data
        chart = self.client.get("/api/grafice/luna/").data

        self.assertEqual(budget["venit_brut"], Decimal("3000.00"))
        self.assertEqual(budget["deduceri_total"], Decimal("420.00"))
        self.assertEqual(budget["venit"], Decimal("2580.00"))
        self.assertEqual(budget["fixe"], Decimal("600.00"))
        self.assertEqual(budget["variabile"], Decimal("350.00"))
        self.assertEqual(budget["economii"], Decimal("1630.00"))
        self.assertEqual(chart["fixe"], Decimal("600.00"))
        self.assertEqual(chart["cheltuieli_total"], Decimal("950.00"))
        self.assertEqual(chart["economii"], budget["economii"])

        variabile = self.client.get("/api/cheltuieli-variabile/").data
        auto_row = next(item for item in variabile if item["categorie"] == "auto")
        self.assertEqual(auto_row["suma"], "100.00")
        self.assertEqual(auto_row["moneda"], "EUR")

    @patch("finante.views.get_bnr_rates", return_value=TEST_RATES)
    def test_vacation_summary_counts_saved_and_spent_categories(self, _rates):
        EconomieVacanta.objects.create(
            user=self.user,
            tip="economii",
            suma=Decimal("100.00"),
            moneda="EUR",
        )
        EconomieVacanta.objects.create(
            user=self.user,
            tip="cheltuieli",
            suma=Decimal("10.00"),
            moneda="EUR",
        )
        CheltuialaVariabila.objects.create(
            user=self.user,
            categorie="vacanta",
            suma=Decimal("300.00"),
            moneda="EUR",
            data=date(2026, 6, 3),
        )
        CheltuialaVariabila.objects.create(
            user=self.user,
            categorie="vacanta_cheltuita",
            suma=Decimal("80.00"),
            moneda="EUR",
            data=date(2026, 6, 4),
        )

        response = self.client.get("/api/economii/vacanta/")

        self.assertEqual(response.data["puse_deoparte"], Decimal("400.00"))
        self.assertEqual(response.data["cheltuite"], Decimal("90.00"))
        self.assertEqual(response.data["ramase"], Decimal("310.00"))

    @patch("finante.views.get_bnr_rates", return_value=TEST_RATES)
    def test_fund_totals_keep_withdrawals_negative_and_generated_investments(self, _rates):
        self.post_json(
            "/api/fonduri/miscare/",
            {
                "tip": "adauga",
                "rubrica": "fond_urgenta",
                "suma_eur": "1000.00",
                "observatii": "Depunere test",
                "data": "2026-06-03",
            },
        )
        self.post_json(
            "/api/fonduri/miscare/",
            {
                "tip": "retrage",
                "rubrica": "fond_urgenta",
                "suma_eur": "200.00",
                "observatii": "Retragere test",
                "data": "2026-06-04",
            },
        )
        self.post_json(
            "/api/fonduri/miscare/",
            {
                "tip": "adauga",
                "rubrica": "cont_economii",
                "suma_ron": "1000.00",
                "observatii": "Depunere lei",
                "data": "2026-06-05",
            },
        )
        self.post_json(
            "/api/investitii-automate/",
            {
                "denumire": "Investitie lunara",
                "data": "2026-06-10",
                "rubrica": "trading212",
                "suma_eur": "50.00",
                "activ": True,
            },
        )

        response = self.client.get("/api/fonduri/")

        self.assertEqual(response.data["total_eur"], Decimal("850"))
        self.assertEqual(response.data["total_ron"], Decimal("1000"))
        self.assertEqual(len(response.data["miscari"]), 4)
