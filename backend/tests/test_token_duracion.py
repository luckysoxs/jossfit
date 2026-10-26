from datetime import datetime, timedelta, timezone

from jose import jwt

from app.config import settings
from tests.conftest import make_user

# La sesion duraba 24 horas y no se renovaba, asi que la app sacaba al
# usuario todos los dias. Sin un refresh token, la unica palanca es que el
# token viva mas.

DURACION_MINIMA = timedelta(days=7)


def _expiracion(token: str) -> datetime:
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    return datetime.fromtimestamp(payload["exp"], tz=timezone.utc)


def test_la_sesion_dura_mas_de_una_semana(client):
    u = make_user(client, "duracion@test.com")
    falta = _expiracion(u["token"]) - datetime.now(timezone.utc)
    assert falta > DURACION_MINIMA


def test_el_token_de_login_dura_lo_mismo_que_el_de_registro(client):
    make_user(client, "login@test.com")
    res = client.post("/auth/login", json={"email": "login@test.com", "password": "Password123"})
    assert res.status_code == 200
    falta = _expiracion(res.json()["access_token"]) - datetime.now(timezone.utc)
    assert falta > DURACION_MINIMA
