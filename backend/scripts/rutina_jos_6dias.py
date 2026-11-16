"""Carga la rutina de 6 dias de Jos en su perfil, hablando con la API.

Idempotente: si ya existe una rutina con el mismo nombre en la cuenta, no
hace nada. Correrlo dos veces no duplica.

Uso:
    python -m scripts.rutina_jos_6dias --token <JWT> [--url https://app.jossfit.pro]

Los ejercicios se buscan en el catalogo por su nombre en ingles, que es la
columna unica. Si alguno falta, el script se detiene y lo dice en vez de
cargar media rutina.
"""

import argparse
import sys

NOMBRE = "Rutina 6 días – Espalda/Hombro · Pecho/Brazo · Pierna"
SPLIT = "6 días: Espalda-Hombro / Pecho-Brazo / Pierna"
OBJETIVO = "hypertrophy"
DIAS_POR_SEMANA = 6
DESCANSA = [6]  # domingo

# (orden, nombre en ingles, series, reps_min, reps_max, descanso_s, notas)
#
# Las reps que en papel eran texto se guardan como numeros, que es lo que el
# modelo admite, y el matiz va en las notas: "10 c/pierna" queda 10-10 con
# nota "10 por pierna"; "30-45 s c/lado" queda 30-45 con nota que aclara que
# son segundos. El cardio va 15-15 con nota "15 min".
DIAS = [
    (1, "Espalda + Hombro", "back,shoulders", [
        (1, "Pull-Up", 4, 6, 10, 120, "O jalón al pecho si no salen"),
        (2, "Dumbbell Shoulder Press", 3, 8, 10, 120, "Sentado"),
        (3, "Barbell Row", 3, 8, 10, 120, "O remo en T"),
        (4, "Lateral Raise", 4, 12, 15, 60, None),
        (5, "Dumbbell Row", 3, 10, 12, 90, "A una mano"),
        (6, "Cable Pullover", 2, 12, 15, 60, None),
        (7, "Face Pull", 3, 15, 15, 60, None),
        (8, "Wrist Curl", 3, 15, 20, 45, None),
        (9, "Reverse Curl", 3, 12, 15, 45, "Con barra Z"),
        (10, "Steady State Cardio", 1, 15, 15, 0, "15 min"),
    ]),
    (2, "Pecho + Brazo", "chest,biceps,triceps,abs", [
        (1, "Incline Dumbbell Press", 4, 6, 10, 120, None),
        (2, "Bench Press", 3, 8, 10, 120, "O press de pecho en máquina"),
        (3, "Cable Crossover", 3, 12, 15, 60, "Aperturas en polea"),
        (4, "EZ Bar Curl", 3, 8, 12, 90, None),
        (5, "Incline Dumbbell Curl", 3, 10, 12, 60, None),
        (6, "Hammer Curl", 2, 12, 12, 60, None),
        (7, "Overhead Cable Extension", 3, 10, 12, 60, None),
        (8, "Rope Pushdown", 3, 12, 15, 60, None),
        (9, "Cable Crunch", 3, 12, 15, 45, None),
        (10, "Hanging Leg Raise", 3, 10, 15, 45, None),
        (11, "Ab Wheel Rollout", 3, 10, 10, 45, "10 reps, o plancha 45 s"),
        (12, "Steady State Cardio", 1, 15, 15, 0, "15 min"),
    ]),
    (3, "Pierna (Cuádriceps + Glúteo)", "quadriceps,glutes,calves", [
        (1, "Barbell Squat", 4, 6, 8, 150, "O sentadilla hack · descanso 2-3 min"),
        (2, "Leg Press", 3, 10, 12, 120, None),
        (3, "Hip Thrust", 3, 8, 12, 120, None),
        (4, "Bulgarian Split Squat", 3, 10, 10, 90, "10 por pierna"),
        (5, "Leg Extension", 3, 12, 15, 60, None),
        (6, "Leg Curl", 2, 12, 12, 60, "Opcional"),
        (7, "Standing Calf Raise", 4, 8, 12, 60, None),
        (8, "Cable Crunch", 2, 15, 15, 45, None),
        (9, "Side Plank", 2, 30, 45, 45, "30-45 segundos por lado"),
        (10, "LISS Cardio", 1, 15, 15, 0, "15 min suave: bici o caminadora inclinada"),
    ]),
    (4, "Espalda + Hombro", "back,shoulders", [
        (1, "Close Grip Lat Pulldown", 4, 8, 12, 120, "Agarre neutro o cerrado"),
        (2, "Machine Shoulder Press", 3, 10, 12, 90, None),
        (3, "Chest Supported Row", 3, 8, 12, 90, "O remo en máquina"),
        (4, "Cable Lateral Raise", 4, 12, 15, 60, None),
        (5, "Seated Cable Row", 3, 10, 12, 90, None),
        (6, "Romanian Deadlift", 2, 10, 12, 90, "Ligero, o hiperextensiones"),
        (7, "Reverse Fly", 3, 15, 15, 60, "Pájaros"),
        (8, "Wrist Curl", 3, 15, 20, 45, None),
        (9, "Farmer's Walk", 3, 30, 40, 60, "30-40 metros"),
        (10, "Steady State Cardio", 1, 15, 15, 0, "15 min"),
    ]),
    (5, "Pecho + Brazo", "chest,biceps,triceps,abs", [
        (1, "Dumbbell Bench Press", 4, 8, 10, 120, "Plano"),
        (2, "Machine Chest Press", 3, 8, 12, 90, "Inclinado, en máquina o Smith"),
        (3, "Dips (Chest)", 3, 8, 12, 90, "Fondos en paralelas, o pec deck"),
        (4, "Preacher Curl", 3, 10, 12, 60, None),
        (5, "Bayesian Curl", 3, 12, 15, 60, "Curl en polea"),
        (6, "French Press", 3, 8, 12, 90, "Con barra Z"),
        (7, "Single Arm Pushdown", 2, 12, 15, 60, "A una mano en polea"),
        (8, "Standing Calf Raise", 3, 10, 15, 45, "Opcional"),
        (9, "Hanging Leg Raise", 3, 10, 15, 45, None),
        (10, "Ab Crunch Machine", 3, 12, 15, 45, "O crunch declinado"),
        (11, "Pallof Press", 2, 12, 12, 45, "12 por lado"),
        (12, "Steady State Cardio", 1, 15, 15, 0, "15 min"),
    ]),
    (6, "Pierna (Isquios + Glúteo)", "hamstrings,glutes,calves", [
        (1, "Romanian Deadlift", 4, 6, 10, 150, "Descanso 2-3 min"),
        (2, "Hip Thrust", 3, 8, 12, 120, "O puente de glúteo con barra"),
        (3, "Leg Curl", 3, 10, 12, 90, "Acostado"),
        (4, "Seated Leg Curl", 3, 12, 15, 60, None),
        (5, "Leg Press", 2, 12, 12, 90, "Pies altos, o extensión de cuádriceps"),
        (6, "Hip Abduction Machine", 3, 15, 20, 60, None),
        (7, "Seated Calf Raise", 4, 12, 20, 60, None),
        (8, "LISS Cardio", 1, 15, 15, 0, "15 min suave"),
    ]),
]


def construir_payload(catalogo: dict) -> dict:
    """Arma el cuerpo de POST /routines resolviendo los ejercicios por nombre.

    `catalogo` mapea nombre en ingles -> id. Si falta alguno levanta
    KeyError con todos los que faltan juntos, para no descubrirlos de uno en
    uno.
    """
    faltantes = sorted({
        nombre
        for _, _, _, ejercicios in DIAS
        for _, nombre, *_ in ejercicios
        if nombre not in catalogo
    })
    if faltantes:
        raise KeyError(f"Faltan en el catalogo: {', '.join(faltantes)}")

    return {
        "name": NOMBRE,
        "split_type": SPLIT,
        "objective": OBJETIVO,
        "days_per_week": DIAS_POR_SEMANA,
        "days": [
            {
                "day_number": numero,
                "name": nombre_dia,
                "focus": foco,
                "exercises": [
                    {
                        "exercise_id": catalogo[nombre],
                        "order": orden,
                        "sets": series,
                        "reps_min": rmin,
                        "reps_max": rmax,
                        "rest_seconds": descanso,
                        "notes": notas,
                    }
                    for orden, nombre, series, rmin, rmax, descanso, notas in ejercicios
                ],
            }
            for numero, nombre_dia, foco, ejercicios in DIAS
        ],
    }


def cargar(http, activar=True):
    """Crea la rutina si no existe y la deja activa.

    `http` es cualquier cosa con .get/.post/.put que ya mande el token: el
    TestClient de las pruebas o un cliente contra produccion.
    """
    existentes = http.get("/routines").json()
    ya_esta = next((r for r in existentes if r["name"] == NOMBRE), None)
    if ya_esta:
        return {"creada": False, "routine_id": ya_esta["id"]}

    catalogo = {e["name"]: e["id"] for e in http.get("/exercises").json()}
    res = http.post("/routines", json=construir_payload(catalogo))
    if res.status_code != 201:
        raise RuntimeError(f"No se pudo crear la rutina: {res.status_code} {res.text}")
    rutina = res.json()

    # El dia 7 es descanso. POST /routines no acepta rest_weekdays, asi que
    # va en su propia llamada; sin esto la rutina queda sin dia de descanso
    # declarado y la app lo asume por omision.
    http.put(f"/routines/{rutina['id']}/schedule", json={"rest_weekdays": DESCANSA})

    if activar:
        http.put(f"/routines/{rutina['id']}/activate")

    return {"creada": True, "routine_id": rutina["id"]}


class _Cliente:
    """Adaptador minimo sobre requests para que `cargar` no sepa de URLs."""

    def __init__(self, base, token):
        import requests

        self._base = base.rstrip("/")
        self._s = requests.Session()
        self._s.headers["Authorization"] = f"Bearer {token}"

    def get(self, ruta):
        return self._s.get(self._base + ruta, timeout=30)

    def post(self, ruta, json=None):
        return self._s.post(self._base + ruta, json=json, timeout=30)

    def put(self, ruta, json=None):
        return self._s.put(self._base + ruta, json=json, timeout=30)


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--token", required=True, help="JWT de la cuenta destino")
    ap.add_argument("--url", default="https://app.jossfit.pro")
    ap.add_argument("--no-activar", action="store_true", help="no marcarla como activa")
    args = ap.parse_args()

    resultado = cargar(_Cliente(args.url, args.token), activar=not args.no_activar)
    if resultado["creada"]:
        total = sum(len(e) for _, _, _, e in DIAS)
        print(f"Rutina creada (id {resultado['routine_id']}): "
              f"{len(DIAS)} dias, {total} ejercicios.")
    else:
        print(f"Ya existia (id {resultado['routine_id']}). No se duplico nada.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
