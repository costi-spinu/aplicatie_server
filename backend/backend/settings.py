from pathlib import Path
from datetime import timedelta
import os

BASE_DIR = Path(__file__).resolve().parent.parent

# ========================
# SECURITY
# ========================

# SECRET_KEY = "cheie_super_lunga_random"
# SECRET_KEY = "5pajc6vft_&6cgpt^nnaby)ufr#0=pk9tg6wid!jb09c-m6u$t"
SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY")


DEBUG = False

ALLOWED_HOSTS = [
    "192.168.2.102",
    "100.75.19.22",
    "localhost",
    "127.0.0.1",
]

# ========================
# APPS
# ========================

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "corsheaders",
    "finante",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "backend.urls"
WSGI_APPLICATION = "backend.wsgi.application"

WSGI_APPLICATION = "backend.wsgi.application"

# ========================
# TEMPLATES (OBLIGATORIU PENTRU ADMIN)
# ========================

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]


# ========================
# DATABASE
# ========================

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.postgresql",
        "NAME": "buget_db",
        "USER": "postgres",
        "PASSWORD": "postgres",
        "HOST": "localhost",
        "PORT": "5432",
    }
}

# ========================
# PASSWORD VALIDATION
# ========================

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

# ========================
# INTERNATIONALIZATION
# ========================

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"

USE_I18N = True
USE_TZ = True

# ========================
# STATIC FILES
# ========================

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"

FRONTEND_DIST = BASE_DIR / "frontend/dist"

if FRONTEND_DIST.exists():
    STATICFILES_DIRS = [FRONTEND_DIST]
else:
    STATICFILES_DIRS = []

# ========================
# CORS
# ========================

CORS_ALLOWED_ORIGINS = [
    "http://192.168.2.102:8080", "http://100.75.19.22",
]

# ========================
# REST + JWT
# ========================

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=60),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=1),
    "AUTH_HEADER_TYPES": ("Bearer",),
}

# ========================
# EMAIL
# ========================

EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
EMAIL_HOST = "smtp.gmail.com"
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = "emailul_tau@gmail.com"
EMAIL_HOST_PASSWORD = "app_password"

# ========================
# REVERSE PROXY
# ========================

SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "http")
USE_X_FORWARDED_HOST = True
