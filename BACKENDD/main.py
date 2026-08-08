from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import math

app = FastAPI()

# Allow requests from your Vercel frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AnalysisRequest(BaseModel):
    element_type: str
    length: float = 6.0
    axial_load: float = 150.0
    boundary: str = "pinned_pinned"

@app.get("/")
def health_check():
    return {"status": "ok", "message": "Python Structural Engine operational"}

@app.post("/api/analyze")
def analyze_structure(data: AnalysisRequest):
    if data.element_type == "column":
        # Effective length factor K
        K = 1.0
        if data.boundary == "fixed_free":
            K = 2.0
        elif data.boundary == "fixed_fixed":
            K = 0.5
        
        Le = data.length * K
        E = 200e9   # Steel Young's Modulus (Pa)
        I = 8.333e-6  # Moment of Inertia (m4)

        # Euler Buckling Load Formula: P_cr = (pi^2 * E * I) / Le^2
        P_cr_N = (math.pi ** 2 * E * I) / (Le ** 2)
        P_cr_kN = round(P_cr_N / 1000, 2)

        return {
            "status": "success",
            "data": {
                "effective_length": Le,
                "critical_buckling_load_kn": P_cr_kN,
                "applied_load_kn": data.axial_load,
                "is_safe": data.axial_load < P_cr_kN
            }
        }

    return {"status": "error", "message": "Unknown element type"}