"""
LTM-Pilot Backend

FastAPI backend for vault management tools.
"""

from dotenv import load_dotenv
load_dotenv()  # Load .env before any module reads os.getenv

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import ai, capabilities, hierarchy, tools

app = FastAPI(
    title="LTM-Pilot",
    description="Vault management tools for Long Term Memory",
    version="0.1.0",
)

# CORS for local development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tools.router, prefix="/api/tools", tags=["tools"])
app.include_router(hierarchy.router, prefix="/api/hierarchy", tags=["hierarchy"])
app.include_router(capabilities.router, prefix="/api/capabilities", tags=["capabilities"])
app.include_router(ai.router, prefix="/api/ai", tags=["ai"])


@app.get("/")
async def root():
    return {"message": "LTM-Pilot API", "version": "0.1.0"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
