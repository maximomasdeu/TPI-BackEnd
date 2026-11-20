from django.db import migrations, models
import django.db.models.deletion


def copy_existing_organizations(apps, schema_editor):
    Profile = apps.get_model('accounts', 'Profile')
    Organization = apps.get_model('accounts', 'Organization')
    for profile in Profile.objects.all().iterator():
        name = (profile.organization or '').strip()
        if name:
            Organization.objects.get_or_create(
                profile=profile,
                name=name,
                defaults={'is_primary': True},
            )


class Migration(migrations.Migration):
    dependencies = [
        ('accounts', '0001_initial'),
    ]

    operations = [
        migrations.CreateModel(
            name='Organization',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=200)),
                ('is_primary', models.BooleanField(default=False)),
                ('profile', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='organizations', to='accounts.profile')),
            ],
            options={
                'ordering': ('-is_primary', 'name'),
            },
        ),
        migrations.AddConstraint(
            model_name='organization',
            constraint=models.UniqueConstraint(fields=('profile', 'name'), name='unique_organization_per_profile'),
        ),
        migrations.RunPython(copy_existing_organizations, migrations.RunPython.noop),
    ]
