# Fitness Jos

Plataforma de entrenamiento, salud, rendimiento y ecosistema fitness.

## Stack

**Backend:** Python, FastAPI, PostgreSQL, SQLAlchemy, Alembic, JWT, bcrypt, Pydantic
**Frontend:** React, Vite, TailwindCSS, Axios, React Router, Recharts
**Infra:** Docker Compose, Railway-ready

## Funcionalidades

- Sistema de usuarios con registro, login JWT y perfil editable
- Registro de entrenamientos (ejercicio, sets, reps, peso, RPE)
- Generador inteligente de rutinas (PPL, Upper/Lower, Full Body, Bro Split)
- Algoritmo de progresion automatica de peso
- Estimacion de 1RM (Epley, Brzycki)
- Calculo de volumen semanal por musculo
- Deteccion de sobreentrenamiento
- Recomendacion de deload
- Mediciones corporales con graficas
- Registro de nutricion con macros diarios
- Seguimiento de sueno
- Control de suplementacion
- Objetivos fitness con progreso
- Dashboard de rendimiento con graficas
- Tienda John Leopard (enlace a johnleopard.com.mx/JOSSFIT)
- Modulo de Benefits con marcas asociadas
- Modo claro/oscuro con toggle
- Diseno mobile-first optimizado

## Correr Localmente

### Con Docker (recomendado)

```bash
cd fitness-app
docker-compose up --build
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000
- Swagger Docs: http://localhost:8000/docs

### Sin Docker

**Backend:**

```bash
cd fitness-app/backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

Crear `.env`:
```
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/fitness_jos
SECRET_KEY=tu-secret-key
```

```bash
uvicorn app.main:app --reload
```

**Frontend:**

```bash
cd fitness-app/frontend
npm install
npm run dev
```

## Deploy en Railway

### Backend

1. Crear nuevo proyecto en Railway
2. Agregar servicio PostgreSQL
3. Conectar repositorio Git (carpeta `backend/`)
4. Variables de entorno:
   - `DATABASE_URL` (auto-generado por Railway Postgres)
   - `SECRET_KEY` (generar string aleatorio)
5. Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`

### Frontend

1. Agregar nuevo servicio en Railway
2. Conectar carpeta `frontend/`
3. Build command: `npm install && npm run build`
4. Start command: `npx serve dist -s -l $PORT`
5. Variable: `VITE_API_URL` apuntando al backend

## API Endpoints

| Metodo | Ruta | Descripcion |
|--------|------|-------------|
| POST | /auth/register | Registro |
| POST | /auth/login | Login |
| GET/PUT | /users/me | Perfil |
| GET | /exercises | Biblioteca de ejercicios |
| POST/GET | /routines | Rutinas |
| POST/GET | /workouts | Entrenamientos |
| GET | /workouts/history | Historial |
| POST | /ai/generate-routine | Generar rutina inteligente |
| GET | /ai/1rm/{id} | Estimacion 1RM |
| GET | /ai/progression/{id} | Progresion de peso |
| GET | /ai/training-analysis | Analisis completo |
| POST/GET | /body-metrics | Mediciones |
| POST/GET | /nutrition | Nutricion |
| POST/GET | /sleep | Sueno |
| CRUD | /supplements | Suplementos |
| CRUD | /goals | Objetivos |
| GET | /dashboard/summary | Dashboard |
| GET | /store/products | Tienda |
| GET | /benefits/brands | Partners |

## Estructura

```
fitness-app/
├── backend/
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── models/       (15 modelos SQLAlchemy)
│   │   ├── schemas/       (Pydantic schemas)
│   │   ├── routers/       (14 routers)
│   │   ├── services/      (Algoritmos + seed data)
│   │   ├── ai/            (Generador de rutinas)
│   │   └── auth/          (JWT + bcrypt)
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── components/    (Layout + UI)
│   │   ├── pages/         (17 paginas)
│   │   ├── contexts/      (Auth + Theme)
│   │   └── services/      (Axios API)
│   ├── Dockerfile
│   └── package.json
├── docker-compose.yml
└── README.md
```
