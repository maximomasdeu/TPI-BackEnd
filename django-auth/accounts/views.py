import json
import os
from datetime import datetime, timedelta, timezone

import jwt
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.db import transaction
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .models import Favorite, Organization


def profile_data(user):
    profile = user.profile
    organizations = list(
        profile.organizations.filter(name__isnull=False).values_list('name', flat=True)
    )
    if not organizations and profile.organization:
        organizations = [profile.organization]
    primary = next(
        (organization.name for organization in profile.organizations.filter(is_primary=True)),
        organizations[0] if organizations else '',
    )
    return {
        'id': user.id,
        'name': profile.name,
        'email': user.email,
        'phone': profile.phone,
        'organization': primary,
        'organizations': organizations,
        'role': profile.role,
    }


def create_token(user):
    profile = user.profile
    payload = {
        'sub': str(user.id),
        'email': user.email,
        'role': profile.role,
        'exp': datetime.now(timezone.utc) + timedelta(hours=8),
    }
    return jwt.encode(payload, os.getenv('JWT_SECRET', ''), algorithm='HS256')


def cors_headers(response):
    origin = os.getenv('FRONTEND_ORIGIN', 'http://localhost:5173')
    response['Access-Control-Allow-Origin'] = origin
    response['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    response['Access-Control-Allow-Methods'] = 'GET,POST,DELETE,OPTIONS'
    return response


def authenticated_user(request):
    authorization = request.headers.get('Authorization', '')
    if not authorization.startswith('Bearer '):
        return None, cors_headers(JsonResponse({'message': 'Se requiere iniciar sesión'}, status=401))
    try:
        payload = jwt.decode(authorization[7:], os.getenv('JWT_SECRET', ''), algorithms=['HS256'])
        user = User.objects.select_related('profile').get(id=payload['sub'])
        return user, None
    except Exception:
        return None, cors_headers(JsonResponse({'message': 'Sesión inválida'}, status=401))


@csrf_exempt
@require_http_methods(['POST', 'OPTIONS'])
def register(request):
    if request.method == 'OPTIONS':
        return cors_headers(JsonResponse({}, status=204))

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return cors_headers(JsonResponse({'message': 'JSON inválido'}, status=400))

    email = str(data.get('email', '')).strip().lower()
    password = str(data.get('password', ''))
    name = str(data.get('name', '')).strip()

    if not email or not password or not name:
        return cors_headers(JsonResponse({'message': 'Nombre, email y contraseña son obligatorios'}, status=400))
    if len(password) < 6:
        return cors_headers(JsonResponse({'message': 'La contraseña debe tener al menos 6 caracteres'}, status=400))
    if User.objects.filter(email=email).exists():
        return cors_headers(JsonResponse({'message': 'Ya existe una cuenta con ese email'}, status=409))

    user = User.objects.create_user(
        username=email,
        email=email,
        password=password,
        first_name=name,
    )
    raw_organizations = data.get('organizations')
    if isinstance(raw_organizations, list):
        organizations = []
        for raw_name in raw_organizations:
            organization_name = str(raw_name).strip()
            if organization_name and organization_name not in organizations:
                organizations.append(organization_name)
    else:
        organization_name = str(data.get('organization', '')).strip()
        organizations = [organization_name] if organization_name else []

    if not organizations:
        return cors_headers(JsonResponse({'message': 'Debés indicar al menos una organización'}, status=400))

    with transaction.atomic():
        user.profile.name = name
        user.profile.phone = str(data.get('phone', '')).strip()
        user.profile.organization = organizations[0]
        user.profile.save()
        for index, organization_name in enumerate(organizations):
            Organization.objects.create(
                profile=user.profile,
                name=organization_name,
                is_primary=index == 0,
            )

    token = create_token(user)
    return cors_headers(JsonResponse({'token': token, 'user': profile_data(user)}, status=201))


@csrf_exempt
@require_http_methods(['POST', 'OPTIONS'])
def login(request):
    if request.method == 'OPTIONS':
        return cors_headers(JsonResponse({}, status=204))

    try:
        data = json.loads(request.body)
    except json.JSONDecodeError:
        return cors_headers(JsonResponse({'message': 'JSON inválido'}, status=400))

    email = str(data.get('email', '')).strip().lower()
    password = str(data.get('password', ''))
    user = authenticate(request, username=email, password=password)

    if not user:
        return cors_headers(JsonResponse({'message': 'Email o contraseña incorrectos'}, status=401))

    return cors_headers(JsonResponse({'token': create_token(user), 'user': profile_data(user)}))


@require_http_methods(['GET', 'OPTIONS'])
def profile(request):
    if request.method == 'OPTIONS':
        return cors_headers(JsonResponse({}, status=204))

    authorization = request.headers.get('Authorization', '')
    if not authorization.startswith('Bearer '):
        return cors_headers(JsonResponse({'message': 'Se requiere iniciar sesión'}, status=401))

    try:
        payload = jwt.decode(authorization[7:], os.getenv('JWT_SECRET', ''), algorithms=['HS256'])
        user = User.objects.select_related('profile').get(id=payload['sub'])
    except Exception:
        return cors_headers(JsonResponse({'message': 'Sesión inválida'}, status=401))

    return cors_headers(JsonResponse(profile_data(user)))


@csrf_exempt
@require_http_methods(['GET', 'POST', 'DELETE', 'OPTIONS'])
def favorites(request):
    if request.method == 'OPTIONS':
        return cors_headers(JsonResponse({}, status=204))

    user, error = authenticated_user(request)
    if error:
        return error

    if request.method == 'GET':
        slugs = list(user.favorites.values_list('event_slug', flat=True))
        return cors_headers(JsonResponse({'favorites': slugs}))

    try:
        data = json.loads(request.body) if request.body else {}
    except json.JSONDecodeError:
        return cors_headers(JsonResponse({'message': 'JSON inválido'}, status=400))

    slug = str(data.get('slug', '')).strip()
    if not slug:
        return cors_headers(JsonResponse({'message': 'El evento es obligatorio'}, status=400))

    if request.method == 'DELETE':
        deleted, _ = user.favorites.filter(event_slug=slug).delete()
        if not deleted:
            return cors_headers(JsonResponse({'message': 'Favorito no encontrado'}, status=404))
        return cors_headers(JsonResponse({'slug': slug, 'saved': False}))

    favorite, created = Favorite.objects.get_or_create(user=user, event_slug=slug)
    return cors_headers(JsonResponse({'slug': favorite.event_slug, 'saved': True}, status=201 if created else 200))
