import pytest

from scripts.rutina_jos_6dias import DIAS, NOMBRE, cargar, construir_payload
from tests.conftest import make_user

# La carga de la rutina de 6 dias. Se prueba contra la API de verdad, no
# contra un mock, porque lo que puede fallar es justo el contrato: un nombre
# de ejercicio que no esta en el catalogo, un campo que el schema rechaza o
# un segundo intento que duplica.


class _Http:
    """El TestClient con el token puesto, con la forma que espera `cargar`."""

    def __init__(self, client, headers):
        self._c, self._h = client, headers

    def get(self, ruta):
        return self._c.get(ruta, headers=self._h)

    def post(self, ruta, json=None):
        return self._c.post(ruta, headers=self._h, json=json)

    def put(self, ruta, json=None):
        return self._c.put(ruta, headers=self._h, json=json)


@pytest.fixture
def catalogo_completo(db_session):
    """El catalogo real, el mismo que corre al arrancar la app.

    La rutina se arma con nombres concretos, asi que el punado de ejercicios
    del fixture chico no sirve: hay que probar contra el catalogo de verdad.
    """
    from app.services.seed_data import seed_exercises as sembrar

    sembrar(db_session)


@pytest.fixture
def http(client, catalogo_completo):
    u = make_user(client, "jos@test.com")
    return _Http(client, u["headers"])


def test_carga_los_seis_dias_con_sus_ejercicios(http):
    res = cargar(http)
    assert res["creada"] is True

    rutina = http.get(f"/routines/{res['routine_id']}").json()
    assert rutina["name"] == NOMBRE
    assert rutina["days_per_week"] == 6
    assert len(rutina["days"]) == 6

    esperado = {n: len(e) for n, _, _, e in DIAS}
    real = {d["day_number"]: len(d["exercises"]) for d in rutina["days"]}
    assert real == esperado


def test_respeta_el_orden_tal_cual(http):
    res = cargar(http)
    rutina = http.get(f"/routines/{res['routine_id']}").json()

    for numero, _, _, ejercicios in DIAS:
        dia = next(d for d in rutina["days"] if d["day_number"] == numero)
        ordenes = [e["order"] for e in sorted(dia["exercises"], key=lambda x: x["order"])]
        assert ordenes == [o for o, *_ in ejercicios]


def test_correrlo_dos_veces_no_duplica(http):
    primera = cargar(http)
    segunda = cargar(http)

    assert segunda["creada"] is False
    assert segunda["routine_id"] == primera["routine_id"]

    nombres = [r["name"] for r in http.get("/routines").json()]
    assert nombres.count(NOMBRE) == 1


def test_queda_como_la_rutina_activa(http):
    res = cargar(http)

    rutina = http.get(f"/routines/{res['routine_id']}").json()
    assert rutina["is_active"] is True

    resumen = http.get("/dashboard/summary").json()
    assert resumen["active_routine_id"] == res["routine_id"]


def test_todos_los_ejercicios_existen_en_el_catalogo(http):
    """Si el seed no trae alguno, que se sepa aqui y no a media carga."""
    catalogo = {e["name"]: e["id"] for e in http.get("/exercises").json()}
    construir_payload(catalogo)  # levanta KeyError con la lista de faltantes


def test_avisa_cuales_faltan_en_vez_de_cargar_a_medias():
    with pytest.raises(KeyError) as err:
        construir_payload({"Pull-Up": 1})
    assert "Bench Press" in str(err.value)


def test_el_descanso_y_las_notas_llegan_a_la_base(http):
    res = cargar(http)
    rutina = http.get(f"/routines/{res['routine_id']}").json()

    dia3 = next(d for d in rutina["days"] if d["day_number"] == 3)
    bulgaras = next(e for e in dia3["exercises"] if e["order"] == 4)
    assert bulgaras["notes"] == "10 por pierna"
    assert bulgaras["rest_seconds"] == 90

    plancha = next(e for e in dia3["exercises"] if e["order"] == 9)
    assert plancha["notes"] == "30-45 segundos por lado"


def test_el_nombre_y_el_split_caben_en_sus_columnas():
    """Un nombre largo dio un 500 en produccion la ultima vez."""
    from scripts.rutina_jos_6dias import SPLIT

    assert len(NOMBRE) <= 100
    assert len(SPLIT) <= 50


def test_el_domingo_queda_marcado_como_descanso(http):
    """El dia 7 de la rutina es descanso y tiene que quedar declarado."""
    res = cargar(http)
    rutina = http.get(f"/routines/{res['routine_id']}").json()
    assert rutina["rest_weekdays"] == [6]
