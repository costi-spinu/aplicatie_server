from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("finante", "0011_variable_expense_description_optional_fixed_description"),
    ]

    operations = [
        migrations.AddField(
            model_name="userprofile",
            name="budget_cycle_start_day",
            field=models.PositiveSmallIntegerField(
                default=26,
                validators=[MinValueValidator(1), MaxValueValidator(31)],
            ),
        ),
    ]
