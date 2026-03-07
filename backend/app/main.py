from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes import parse, medications, schedule, logs, conflicts, analysis

app = FastAPI(
    title="re-medy API",
    description="AI-powered medication safety and adherence backend",
    version="0.1.0",
)

# CORS — allow local frontend dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount routers
app.include_router(parse.router, tags=["Parsing"])
app.include_router(medications.router, tags=["Medications"])
app.include_router(schedule.router, tags=["Schedule"])
app.include_router(logs.router, tags=["Logs"])
app.include_router(conflicts.router, tags=["Conflicts"])
app.include_router(analysis.router, tags=["Analysis"])


@app.get("/")
async def root():
    return {"status": "ok", "service": "MedSafe API"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
