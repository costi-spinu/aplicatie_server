from datetime import timedelta
from decimal import Decimal
from unittest.mock import patch
from urllib.error import URLError

from django.contrib.auth.models import User
from django.test import SimpleTestCase
from django.utils import timezone
from rest_framework.test import APIRequestFactory, force_authenticate

from .views import BNR_RATES_CACHE, curs_bnr, get_bnr_rates


BNR_XML = b"""<?xml version="1.0" encoding="utf-8"?>
<DataSet xmlns="http://www.bnr.ro/xsd">
  <Body>
    <OrigCurrency>RON</OrigCurrency>
    <Cube date="2026-09-14">
      <Rate currency="USD">4.50</Rate>
      <Rate currency="EUR">5.09</Rate>
    </Cube>
  </Body>
</DataSet>
"""


class BnrExchangeRateTests(SimpleTestCase):
    def setUp(self):
        cache_patch = patch.dict(
            BNR_RATES_CACHE, {"data": None, "fetched_at": None}, clear=True
        )
        cache_patch.start()
        self.addCleanup(cache_patch.stop)

        network_patch = patch("finante.views.urlopen")
        self.urlopen = network_patch.start()
        self.addCleanup(network_patch.stop)
        self.urlopen.return_value.__enter__.return_value.read.return_value = BNR_XML

    def authenticated_request(self):
        request = APIRequestFactory().get("/api/curs-bnr/")
        force_authenticate(request, user=User(username="exchange-rate-test"))
        return request

    def test_reads_namespaced_rates_from_current_official_feed(self):
        rates = get_bnr_rates()

        self.assertEqual(
            rates,
            {
                "date": "2026-09-14",
                "eur_ron": Decimal("5.09"),
                "ron_eur": Decimal("0.196464"),
            },
        )
        self.urlopen.assert_called_once()
        request = self.urlopen.call_args.args[0]
        self.assertEqual(request.full_url, "https://curs.bnr.ro/nbrfxrates.xml")
        self.assertEqual(self.urlopen.call_args.kwargs, {"timeout": 3})

    def test_reuses_fresh_cached_rates_without_network_request(self):
        cached_rates = {
            "date": "2026-09-11",
            "eur_ron": Decimal("5.08"),
            "ron_eur": Decimal("0.196850"),
        }
        BNR_RATES_CACHE.update(
            data=cached_rates, fetched_at=timezone.now() - timedelta(minutes=5)
        )

        self.assertEqual(get_bnr_rates(), cached_rates)
        self.urlopen.assert_not_called()

    def test_endpoint_returns_rates_for_authenticated_user(self):
        response = curs_bnr(self.authenticated_request())

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.data,
            {
                "source": "BNR",
                "date": "2026-09-14",
                "eur_ron": "5.09",
                "ron_eur": "0.196464",
            },
        )

    def test_unavailable_feed_returns_service_unavailable(self):
        self.urlopen.side_effect = URLError("Feed unavailable")

        response = curs_bnr(self.authenticated_request())

        self.assertEqual(response.status_code, 503)
        self.assertEqual(
            response.data["detail"], "Cursul BNR nu este disponibil momentan."
        )
        self.assertIsNone(BNR_RATES_CACHE["data"])
