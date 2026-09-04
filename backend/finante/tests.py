from datetime import date
from decimal import Decimal
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from .models import (
    CheltuialaFixa,
    CheltuialaFixaAutomata,
    CheltuialaVariabila,
    Credit,
    EconomieVacanta,
    FinancialArchive,
    InvestitieAutomata,
    InvestitieCategorie,
    MiscareFond,
    RealizariTarget,
    UserProfile,
    UserBridge,
    Venit,
)
from .archive_service import archive_old_financial_data
from .utils import get_luna_bugetara
from .views import (
    current_budget_cycle_key,
    get_auto_fixed_deduction_total,
    iter_auto_fixed_dates,
    sync_auto_investments_for_user,
)


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
                "descriere": "Cumparaturi saptamanale",
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

    @patch(
        "finante.views.perioada_bugetara",
        return_value=(date(2026, 5, 26), date(2026, 6, 25)),
    )
    @patch("finante.views.timezone.localdate", return_value=date(2026, 6, 14))
    @patch("finante.views.get_bnr_rates", return_value=TEST_RATES)
    def test_budget_and_month_chart_use_same_full_savings_formula(
        self, _rates, _localdate, _budget_period
    ):
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
        alimente_row = next(item for item in variabile if item["categorie"] == "alimente")
        self.assertEqual(alimente_row["descriere"], "Cumparaturi saptamanale")

    @patch("finante.views.timezone.localdate", return_value=date(2026, 6, 14))
    @patch("finante.views.get_bnr_rates", return_value=TEST_RATES)
    def test_budget_report_and_savings_history_include_every_deduction(
        self, _rates, _localdate
    ):
        self.seed_budget_month()

        report = self.client.get("/api/raport/bugetar/?luna=2026-06")
        self.assertEqual(report.status_code, 200)
        self.assertEqual(report.data["start"], date(2026, 5, 26))
        self.assertEqual(report.data["end"], date(2026, 6, 25))
        self.assertEqual(report.data["venit_brut"], Decimal("3000.00"))
        self.assertEqual(report.data["deduceri_credite"], Decimal("300.00"))
        self.assertEqual(report.data["fixe_automate"], Decimal("120.00"))
        self.assertEqual(report.data["fixe_manuale"], Decimal("600.00"))
        self.assertEqual(report.data["fixe_total"], Decimal("720.00"))
        self.assertEqual(report.data["variabile"], Decimal("350.00"))
        self.assertEqual(report.data["iesiri_totale"], Decimal("1370.00"))
        self.assertEqual(report.data["economii"], Decimal("1630.00"))
        self.assertEqual(len(report.data["fixe_automate_detalii"]), 1)
        self.assertEqual(len(report.data["fixe_manuale_detalii"]), 1)

        categories = {
            item["categorie"]: item for item in report.data["categorii"]
        }
        self.assertEqual(
            categories["alimente"]["procent_venit_brut"],
            Decimal("6.67"),
        )
        self.assertEqual(
            categories["alimente"]["procent_venit_disponibil"],
            Decimal("7.75"),
        )

        history = self.client.get("/api/economii/istoric/")
        self.assertEqual(history.status_code, 200)
        self.assertEqual(len(history.data), 1)
        self.assertEqual(history.data[0]["luna"], "2026-06")
        self.assertEqual(history.data[0]["sold"], Decimal("1630.00"))

    @patch("finante.views.timezone.localdate", return_value=date(2026, 8, 20))
    @patch("finante.views.get_bnr_rates", return_value=TEST_RATES)
    def test_closed_report_uses_recorded_automatic_amounts_and_converts_income(
        self, _rates, _localdate
    ):
        Venit.objects.create(
            user=self.user,
            suma=Decimal("5000.00"),
            moneda="RON",
            data=date(2026, 7, 2),
        )
        schedule = CheltuialaFixaAutomata.objects.create(
            user=self.user,
            denumire="Abonament istoric",
            data=date(2026, 7, 5),
            cursivitate="lunar",
            suma=Decimal("75.00"),
            moneda="EUR",
            activ=True,
        )
        CheltuialaFixa.objects.create(
            user=self.user,
            descriere="Abonament istoric",
            suma=Decimal("50.00"),
            moneda="EUR",
            sursa="automat",
            automatizare=schedule,
            data=date(2026, 7, 5),
        )
        Credit.objects.create(
            user=self.user,
            denumire="Credit istoric",
            suma=Decimal("100.00"),
            moneda="EUR",
            data=date(2026, 7, 6),
        )

        report = self.client.get("/api/raport/bugetar/?luna=2026-07")

        self.assertEqual(report.status_code, 200)
        self.assertEqual(report.data["venit_brut"], Decimal("1000.00"))
        self.assertEqual(report.data["fixe_automate"], Decimal("50.00"))
        self.assertEqual(report.data["economii"], Decimal("850.00"))

    def test_expense_descriptions_are_optional(self):
        fixed_response = self.post_json(
            "/api/cheltuieli-fixe/",
            {
                "descriere": "",
                "suma": "25.00",
                "moneda": "EUR",
                "data": "2026-06-02",
            },
        )
        variable_response = self.post_json(
            "/api/cheltuieli-variabile/",
            {
                "categorie": "animalute",
                "descriere": "",
                "suma": "18.00",
                "moneda": "EUR",
                "data": "2026-06-03",
            },
        )

        self.assertEqual(fixed_response.data["descriere"], "")
        self.assertEqual(variable_response.data["descriere"], "")
        self.assertEqual(CheltuialaFixa.objects.get().descriere, "")
        self.assertEqual(CheltuialaVariabila.objects.get().descriere, "")

    def test_budget_cycle_key_changes_after_day_25(self):
        self.assertEqual(current_budget_cycle_key(date(2026, 8, 25)), "2026-08")
        self.assertEqual(current_budget_cycle_key(date(2026, 8, 26)), "2026-09")
        self.assertEqual(current_budget_cycle_key(date(2026, 12, 26)), "2027-01")

    @patch("finante.views.timezone.localdate", return_value=date(2026, 8, 26))
    def test_global_objective_snapshot_uses_budget_cycle_end_month(self, _localdate):
        self.post_json(
            "/api/obiective-cheltuieli-global/",
            {
                "fixed_target": "500.00",
                "category_targets": {"alimente": 300, "economii": 100},
            },
        )

        target = RealizariTarget.objects.get(user=self.user)
        self.assertEqual(target.luna, "2026-09")
        self.assertEqual(target.category_targets["economii"], 100.0)

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

    @patch("finante.views.timezone.localdate", return_value=date(2026, 8, 19))
    @patch("finante.views.get_bnr_rates", return_value=TEST_RATES)
    def test_fund_totals_keep_withdrawals_negative_and_generated_investments(
        self, _rates, _localdate
    ):
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

        self.assertEqual(response.data["total_eur"], Decimal("950"))
        self.assertEqual(response.data["total_ron"], Decimal("1000"))
        self.assertEqual(len(response.data["miscari"]), 6)

    def test_auto_investments_backfill_missed_ron_months_once(self):
        schedule = InvestitieAutomata.objects.create(
            user=self.user,
            denumire="Trading in lei",
            data=date(2026, 6, 25),
            rubrica="trading212",
            suma_ron=Decimal("700.00"),
            activ=True,
        )

        sync_auto_investments_for_user(self.user, ref_date=date(2026, 8, 19))
        sync_auto_investments_for_user(self.user, ref_date=date(2026, 8, 19))

        generated = list(
            MiscareFond.objects.filter(automatizare=schedule)
            .order_by("data")
            .values_list("data", "suma_eur", "suma_ron")
        )
        self.assertEqual(
            generated,
            [
                (date(2026, 6, 25), None, Decimal("700.00")),
                (date(2026, 7, 25), None, Decimal("700.00")),
            ],
        )

    def test_auto_investment_update_can_switch_from_eur_to_ron(self):
        schedule = InvestitieAutomata.objects.create(
            user=self.user,
            denumire="Schimbare moneda",
            data=date(2099, 6, 25),
            rubrica="trading212",
            suma_eur=Decimal("50.00"),
            activ=True,
        )

        response = self.client.put(
            f"/api/investitii-automate/{schedule.id}/",
            {
                "denumire": schedule.denumire,
                "data": "2099-06-25",
                "rubrica": schedule.rubrica,
                "suma_eur": None,
                "suma_ron": "700.00",
                "activ": True,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 200)
        schedule.refresh_from_db()
        self.assertIsNone(schedule.suma_eur)
        self.assertEqual(schedule.suma_ron, Decimal("700.00"))

    def test_fixed_automation_start_month_anchors_multi_month_recurrence(self):
        schedule = CheltuialaFixaAutomata.objects.create(
            user=self.user,
            denumire="Asigurare la doua luni",
            data=date(2026, 5, 15),
            cursivitate="la_2_luni",
            suma=Decimal("100.00"),
            moneda="EUR",
            activ=True,
        )

        self.assertEqual(
            iter_auto_fixed_dates(
                schedule,
                date(2026, 6, 1),
                date(2026, 6, 30),
            ),
            [],
        )
        self.assertEqual(
            iter_auto_fixed_dates(
                schedule,
                date(2026, 7, 1),
                date(2026, 7, 31),
            ),
            [date(2026, 7, 15)],
        )
        self.assertEqual(
            get_auto_fixed_deduction_total(
                [self.user.id],
                date(2026, 6, 26),
                date(2026, 7, 25),
                ref_date=date(2026, 6, 27),
            ),
            Decimal("0.00"),
        )
        self.assertEqual(
            get_auto_fixed_deduction_total(
                [self.user.id],
                date(2026, 6, 26),
                date(2026, 7, 25),
                ref_date=date(2026, 7, 15),
            ),
            Decimal("100.00"),
        )

    def test_monthly_fixed_automation_is_reserved_at_salary_deduction(self):
        CheltuialaFixaAutomata.objects.create(
            user=self.user,
            denumire="Abonament lunar",
            data=date(2026, 7, 15),
            cursivitate="lunar",
            suma=Decimal("75.00"),
            moneda="EUR",
            activ=True,
        )

        self.assertEqual(
            get_auto_fixed_deduction_total(
                [self.user.id],
                date(2026, 6, 26),
                date(2026, 7, 25),
                ref_date=date(2026, 6, 27),
            ),
            Decimal("75.00"),
        )

    def test_funds_are_private_and_bridge_summary_is_read_only(self):
        bridge_user = User.objects.create_user(
            username="bridge_investor",
            email="bridge_investor@example.test",
            password="pass12345",
        )
        UserBridge.objects.create(
            from_user=self.user,
            to_user=bridge_user,
            accepted=True,
        )
        second_bridge_user = User.objects.create_user(
            username="bridge_without_funds",
            email="bridge_without_funds@example.test",
            password="pass12345",
        )
        UserBridge.objects.create(
            from_user=second_bridge_user,
            to_user=self.user,
            accepted=True,
        )
        pending_bridge_user = User.objects.create_user(
            username="pending_bridge",
            email="pending_bridge@example.test",
            password="pass12345",
        )
        UserBridge.objects.create(
            from_user=self.user,
            to_user=pending_bridge_user,
            accepted=False,
        )
        InvestitieCategorie.objects.create(
            user=bridge_user,
            value="aur",
            label="Aur",
        )
        own_movement = MiscareFond.objects.create(
            user=self.user,
            tip="adauga",
            rubrica="trading212",
            suma_eur=Decimal("100.00"),
            data=date(2026, 6, 10),
        )
        bridge_movement = MiscareFond.objects.create(
            user=bridge_user,
            tip="adauga",
            rubrica="aur",
            suma_eur=Decimal("250.00"),
            suma_ron=Decimal("500.00"),
            data=date(2026, 6, 11),
        )
        InvestitieAutomata.objects.create(
            user=bridge_user,
            denumire="Automat bridge",
            data=date(2099, 7, 10),
            rubrica="aur",
            suma_eur=Decimal("25.00"),
            activ=True,
        )

        own_response = self.client.get("/api/fonduri/")
        self.assertEqual(own_response.data["total_eur"], Decimal("100"))
        self.assertEqual(
            [item["id"] for item in own_response.data["miscari"]],
            [own_movement.id],
        )
        self.assertNotIn(
            "aur",
            [item["value"] for item in own_response.data["categorii"]],
        )
        foreign_category_response = self.client.post(
            "/api/fonduri/miscare/",
            {
                "tip": "adauga",
                "rubrica": "aur",
                "suma_eur": "10.00",
            },
            format="json",
        )
        self.assertEqual(foreign_category_response.status_code, 400)

        bridge_response = self.client.get("/api/fonduri/bridge/")
        self.assertEqual(len(bridge_response.data["users"]), 3)
        bridge_users_by_name = {
            item["username"]: item for item in bridge_response.data["users"]
        }
        self.assertEqual(
            set(bridge_users_by_name),
            {self.user.username, bridge_user.username, second_bridge_user.username},
        )
        own_bridge_data = bridge_users_by_name[self.user.username]
        self.assertTrue(own_bridge_data["is_current_user"])
        self.assertEqual(own_bridge_data["total_eur"], Decimal("100"))
        self.assertEqual(own_bridge_data["total_ron"], Decimal("0"))
        bridge_data = bridge_users_by_name[bridge_user.username]
        self.assertFalse(bridge_data["is_current_user"])
        self.assertEqual(bridge_data["username"], bridge_user.username)
        self.assertEqual(bridge_data["total_eur"], Decimal("250"))
        self.assertEqual(bridge_data["total_ron"], Decimal("500"))
        self.assertEqual(bridge_data["rubrici"][0]["label"], "Aur")
        empty_bridge_data = bridge_users_by_name[second_bridge_user.username]
        self.assertEqual(empty_bridge_data["total_eur"], Decimal("0"))
        self.assertEqual(empty_bridge_data["total_ron"], Decimal("0"))
        self.assertEqual(empty_bridge_data["rubrici"], [])
        self.assertEqual(bridge_response.data["connected_user_count"], 2)
        self.assertEqual(bridge_response.data["combined_total_eur"], Decimal("350"))
        self.assertEqual(bridge_response.data["combined_total_ron"], Decimal("500"))

        update_response = self.client.put(
            f"/api/fonduri/miscare/{bridge_movement.id}/",
            {
                "tip": "adauga",
                "rubrica": "aur",
                "suma_eur": "999.00",
            },
            format="json",
        )
        delete_response = self.client.delete(
            f"/api/fonduri/miscare/{bridge_movement.id}/"
        )
        self.assertEqual(update_response.status_code, 404)
        self.assertEqual(delete_response.status_code, 404)
        bridge_movement.refresh_from_db()
        self.assertEqual(bridge_movement.suma_eur, Decimal("250.00"))

        automatic_response = self.client.get("/api/investitii-automate/")
        self.assertEqual(automatic_response.data, [])

    def test_profile_photo_is_persisted_as_media_file(self):
        image_data = (
            "data:image/png;base64,"
            "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk"
            "+A8AAQUBAScY42YAAAAASUVORK5CYII="
        )

        with TemporaryDirectory() as media_root, self.settings(MEDIA_ROOT=media_root):
            response = self.client.put(
                "/api/profile/",
                {"profile": {"poza": image_data}},
                format="json",
            )

            self.assertEqual(response.status_code, 200)
            self.user.profile.refresh_from_db()
            self.assertEqual(
                self.user.profile.poza,
                f"/media/profile_images/user_{self.user.id}.png",
            )
            self.assertTrue(
                (Path(media_root) / "profile_images" / f"user_{self.user.id}.png").is_file()
            )
            self.assertIn(
                f"/media/profile_images/user_{self.user.id}.png?v=",
                response.data["profile"]["poza"],
            )


class AccountRegistrationTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def test_public_registration_creates_normalized_user_and_profile(self):
        response = self.client.post(
            "/api/register/",
            {
                "username": "  UtilizatorNou  ",
                "email": "  NOU@Example.Test ",
                "password": "secret123",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.data)
        user = User.objects.get(username="UtilizatorNou")
        self.assertEqual(user.email, "nou@example.test")
        self.assertTrue(user.check_password("secret123"))
        self.assertTrue(UserProfile.objects.filter(user=user).exists())

    def test_registration_rejects_case_insensitive_duplicates_with_clear_fields(self):
        User.objects.create_user(
            username="Existent",
            email="existent@example.test",
            password="secret123",
        )

        response = self.client.post(
            "/api/register/",
            {
                "username": "existent",
                "email": "EXISTENT@example.test",
                "password": "secret123",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("username", response.data)
        self.assertIn("email", response.data)

    def test_admin_can_create_a_regular_user(self):
        admin = User.objects.create_superuser(
            username="admin_create",
            email="admin@example.test",
            password="secret123",
        )
        self.client.force_authenticate(user=admin)

        response = self.client.post(
            "/api/admin/users/",
            {
                "username": "creat_din_admin",
                "email": "admin-created@example.test",
                "password": "secret123",
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.data)
        created = User.objects.get(username="creat_din_admin")
        self.assertFalse(created.is_staff)
        self.assertTrue(created.check_password("secret123"))


class BudgetPeriodConfigurationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="period_user",
            email="period@example.test",
            password="secret123",
        )
        UserProfile.objects.create(user=self.user)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    @patch("finante.views.timezone.localdate", return_value=date(2026, 9, 2))
    def test_period_can_be_changed_per_account_and_controls_budget(self, _today):
        default_response = self.client.get("/api/perioada-bugetara/")
        self.assertEqual(default_response.status_code, 200)
        self.assertEqual(default_response.data["start"], date(2026, 8, 26))
        self.assertEqual(default_response.data["end"], date(2026, 9, 25))

        update_response = self.client.patch(
            "/api/perioada-bugetara/",
            {"start_day": 10},
            format="json",
        )
        self.assertEqual(update_response.status_code, 200, update_response.data)
        self.assertEqual(update_response.data["start"], date(2026, 8, 10))
        self.assertEqual(update_response.data["end"], date(2026, 9, 9))

        Venit.objects.create(
            user=self.user,
            suma=Decimal("100.00"),
            moneda="EUR",
            data=date(2026, 8, 9),
        )
        Venit.objects.create(
            user=self.user,
            suma=Decimal("250.00"),
            moneda="EUR",
            data=date(2026, 8, 10),
        )
        budget = self.client.get("/api/buget/lunar/")
        self.assertEqual(budget.data["venit_brut"], Decimal("250.00"))
        self.assertEqual(budget.data["start_day"], 10)

        other = User.objects.create_user(
            username="other_period",
            email="other-period@example.test",
            password="secret123",
        )
        UserProfile.objects.create(user=other)
        self.assertEqual(other.profile.budget_cycle_start_day, 26)

    def test_day_31_is_clamped_without_cycle_gaps(self):
        self.assertEqual(
            get_luna_bugetara(date(2028, 2, 28), start_day=31),
            (date(2028, 1, 31), date(2028, 2, 28)),
        )
        self.assertEqual(
            get_luna_bugetara(date(2028, 2, 29), start_day=31),
            (date(2028, 2, 29), date(2028, 3, 30)),
        )


class FinancialArchiveTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            username="archive_user",
            email="archive@example.test",
            password="secret123",
        )
        UserProfile.objects.create(user=self.user)
        self.client = APIClient()
        self.client.force_authenticate(user=self.user)

    def seed_old_and_retained_records(self):
        Venit.objects.create(
            user=self.user,
            suma=Decimal("1000.00"),
            moneda="EUR",
            data=date(2026, 7, 10),
        )
        Credit.objects.create(
            user=self.user,
            denumire="Credit vechi",
            suma=Decimal("100.00"),
            moneda="EUR",
            data=date(2026, 7, 11),
        )
        CheltuialaFixa.objects.create(
            user=self.user,
            descriere="Chirie veche",
            suma=Decimal("200.00"),
            moneda="EUR",
            data=date(2026, 7, 12),
        )
        CheltuialaVariabila.objects.create(
            user=self.user,
            categorie="alimente",
            descriere="Coș vechi",
            suma=Decimal("50.00"),
            moneda="EUR",
            data=date(2026, 7, 13),
        )
        Venit.objects.create(
            user=self.user,
            suma=Decimal("300.00"),
            moneda="EUR",
            data=date(2026, 8, 10),
        )

    def test_archive_keeps_two_cycles_and_serves_verified_pdf_excel_and_report(self):
        self.seed_old_and_retained_records()

        with TemporaryDirectory() as archive_root, self.settings(
            FINANCIAL_ARCHIVE_ROOT=archive_root,
            FINANCIAL_ARCHIVE_KEEP_CYCLES=2,
        ):
            result = archive_old_financial_data(
                self.user,
                as_of=date(2026, 9, 2),
            )

            self.assertEqual(result["cutoff"], "2026-07-26")
            self.assertEqual(len(result["archives"]), 1)
            self.assertFalse(Venit.objects.filter(data=date(2026, 7, 10)).exists())
            self.assertTrue(Venit.objects.filter(data=date(2026, 8, 10)).exists())
            self.assertFalse(Credit.objects.filter(data=date(2026, 7, 11)).exists())
            self.assertFalse(
                CheltuialaFixa.objects.filter(data=date(2026, 7, 12)).exists()
            )
            self.assertFalse(
                CheltuialaVariabila.objects.filter(data=date(2026, 7, 13)).exists()
            )

            archive = FinancialArchive.objects.get(status="ready")
            archive_dir = Path(archive_root) / archive.relative_dir
            self.assertTrue((archive_dir / "manifest.json").is_file())
            self.assertTrue((archive_dir / "raport.pdf").read_bytes().startswith(b"%PDF-"))
            self.assertTrue((archive_dir / "raport.xlsx").read_bytes().startswith(b"PK"))

            listing = self.client.get("/api/arhive/")
            self.assertEqual(listing.status_code, 200)
            self.assertEqual(listing.data[0]["id"], str(archive.id))

            pdf = self.client.get(f"/api/arhive/{archive.id}/pdf/")
            excel = self.client.get(f"/api/arhive/{archive.id}/excel/")
            self.assertEqual(pdf.status_code, 200)
            self.assertEqual(pdf["Content-Type"], "application/pdf")
            self.assertEqual(excel.status_code, 200)
            self.assertIn("spreadsheetml", excel["Content-Type"])

            historical = self.client.get("/api/raport/bugetar/?luna=2026-07")
            self.assertEqual(historical.status_code, 200, historical.data)
            self.assertEqual(historical.data["venit_brut"], "1000.00")
            self.assertEqual(historical.data["economii"], "650.00")
            self.assertEqual(len(historical.data["venituri"]), 1)

            rejected = self.client.post(
                "/api/venituri/",
                {"suma": "5.00", "moneda": "EUR", "data": "2026-07-15"},
                format="json",
            )
            self.assertEqual(rejected.status_code, 400)
            self.assertIn("data", rejected.data)

            other = User.objects.create_user(
                username="archive_intruder",
                email="intruder@example.test",
                password="secret123",
            )
            self.client.force_authenticate(user=other)
            forbidden = self.client.get(f"/api/arhive/{archive.id}/pdf/")
            self.assertEqual(forbidden.status_code, 404)

    def test_dry_run_does_not_write_or_delete(self):
        self.seed_old_and_retained_records()

        with TemporaryDirectory() as archive_root, self.settings(
            FINANCIAL_ARCHIVE_ROOT=archive_root,
            FINANCIAL_ARCHIVE_KEEP_CYCLES=2,
        ):
            result = archive_old_financial_data(
                self.user,
                as_of=date(2026, 9, 2),
                dry_run=True,
            )

            self.assertEqual(result["archives"][0]["status"], "dry-run")
            self.assertEqual(Venit.objects.count(), 2)
            self.assertFalse(FinancialArchive.objects.exists())

    @patch(
        "finante.archive_service.render_archive_files",
        side_effect=OSError("disc indisponibil"),
    )
    def test_file_generation_failure_never_deletes_database_rows(self, _renderer):
        self.seed_old_and_retained_records()

        with TemporaryDirectory() as archive_root, self.settings(
            FINANCIAL_ARCHIVE_ROOT=archive_root,
            FINANCIAL_ARCHIVE_KEEP_CYCLES=2,
        ):
            with self.assertRaises(OSError):
                archive_old_financial_data(
                    self.user,
                    as_of=date(2026, 9, 2),
                )

            self.assertTrue(Venit.objects.filter(data=date(2026, 7, 10)).exists())
            self.assertTrue(Credit.objects.filter(data=date(2026, 7, 11)).exists())
            archive = FinancialArchive.objects.get()
            self.assertEqual(archive.status, FinancialArchive.Status.FAILED)
