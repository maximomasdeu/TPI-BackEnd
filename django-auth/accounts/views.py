import json
import os
from datetime import datetime, timedelta, timezone

import jwt
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods


def profile_data(user):
    profile = user.profile
    return {
        'id': user.id,
        'name': profile.name,
        'email': user.email,
        'phone': profile.phone,
        'organization': profile.organization,
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
    response['Access-Control-Allow-Methods'] = 'GET,POST,OPTIONS'
    return response


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
    user.profile.name = name
    user.profile.phone = str(data.get('phone', '')).strip()
    user.profile.organization = str(data.get('organization', '')).strip()
    user.profile.save()

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
