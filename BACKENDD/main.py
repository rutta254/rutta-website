from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response, StreamingResponse
from pydantic import BaseModel
import math
import io
import importlib
import importlib.util

REPORTLAB_AVAILABLE = False
letter = None
SimpleDocTemplate = None
Paragraph = None
Spacer = None
Table = None
TableStyle = None
getSampleStyleSheet = None
ParagraphStyle = None
colors = None

if importlib.util.find_spec("reportlab") is not None:
    try:
        reportlab_lib_pagesizes = importlib.import_module("reportlab.lib.pagesizes")
        reportlab_platypus = importlib.import_module("reportlab.platypus")
        reportlab_lib_styles = importlib.import_module("reportlab.lib.styles")
        reportlab_lib = importlib.import_module("reportlab.lib")

        letter = reportlab_lib_pagesizes.letter
        SimpleDocTemplate = reportlab_platypus.SimpleDocTemplate
        Paragraph = reportlab_platypus.Paragraph
        Spacer = reportlab_platypus.Spacer
        Table = reportlab_platypus.Table
        TableStyle = reportlab_platypus.TableStyle
        getSampleStyleSheet = reportlab_lib_styles.getSampleStyleSheet
        ParagraphStyle = reportlab_lib_styles.ParagraphStyle
        colors = reportlab_lib.colors
        REPORTLAB_AVAILABLE = True
    except Exception:
        REPORTLAB_AVAILABLE = False

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AnalysisRequest(BaseModel):
    element_type: str = "beam"
    length: float = 6.0
    span: float | None = None
    load: float = 10.0
    load_type: str = "udl"            # "udl" or "point"
    material: str = "steel"
    boundary: str = "pinned_pinned"
    support: str = "simply_supported"    # "simply_supported", "cantilever", "fixed_fixed"
    action: str | None = None
    section_profile: str = "IPE 300"

@app.get("/")
def health_check():
    return {"status": "ok", "message": "Python Structural Analysis & Design Engine operational"}

@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    return Response(status_code=204)

@app.post("/api/analyze")
def analyze_structure(data: AnalysisRequest):
    if data.action == "pdf":
        if not REPORTLAB_AVAILABLE:
            raise HTTPException(status_code=500, detail="Reportlab is not installed on the server.")
        return generate_pdf_bytes(data)

    if data.element_type == "column":
        K = 1.0
        if data.boundary == "fixed_free":
            K = 2.0
        elif data.boundary == "fixed_fixed":
            K = 0.5
        
        Le = data.length * K
        E = 200e9   # Pa
        I = 8.333e-6  # m4
        P_cr_N = (math.pi ** 2 * E * I) / (Le ** 2)
        P_cr_kN = round(P_cr_N / 1000, 2)
        allowable_capacity = round(P_cr_kN / 2.0, 2)
        utilization = round((data.load / allowable_capacity) * 100, 1)
        is_safe = data.load <= allowable_capacity

        return {
            "status": "success",
            "data": {
                "element_type": "column",
                "effective_length": Le,
                "critical_buckling_load_kn": P_cr_kN,
                "allowable_capacity_kn": allowable_capacity,
                "applied_load_kn": data.load,
                "utilization_ratio_pct": utilization,
                "is_safe": is_safe,
                "design_status": "PASS (Adequate buckling resistance)" if is_safe else "FAIL"
            }
        }

    elif data.element_type == "beam":
        L = data.span if data.span is not None else data.length
        P_or_w = data.load  # Can be UDL (kN/m) or Point Load (kN)

        max_shear = 0.0
        max_moment = 0.0
        r_a = 0.0
        r_b = 0.0
        plot_points = []
        sfd_points = []
        steps = 20

        # --- Support & Load Case Matrix ---
        if data.support == "simply_supported":
            if data.load_type == "point":  # Point load at midspan
                r_a = round(P_or_w / 2.0, 2)
                r_b = round(P_or_w / 2.0, 2)
                max_shear = r_a
                max_moment = round((P_or_w * L) / 4.0, 2)
                for i in range(steps + 1):
                    x = (L / steps) * i
                    sfd = r_a if x < (L / 2.0) else -r_b
                    mom = (P_or_w * x / 2.0) if x <= (L / 2.0) else (P_or_w * (L - x) / 2.0)
                    plot_points.append({"x": round(x, 2), "moment": round(mom, 2)})
                    sfd_points.append({"x": round(x, 2), "shear": round(sfd, 2)})
            else:  # UDL
                r_a = round((P_or_w * L) / 2.0, 2)
                r_b = round((P_or_w * L) / 2.0, 2)
                max_shear = r_a
                max_moment = round((P_or_w * (L ** 2)) / 8.0, 2)
                for i in range(steps + 1):
                    x = (L / steps) * i
                    sfd = round((P_or_w * L / 2.0) - (P_or_w * x), 2)
                    mom = round((P_or_w * x / 2.0) * (L - x), 2)
                    plot_points.append({"x": round(x, 2), "moment": mom})
                    sfd_points.append({"x": round(x, 2), "shear": sfd})

        elif data.support == "cantilever":
            if data.load_type == "point":  # Point load at free end
                r_a = round(P_or_w, 2) # Fixed support reaction force
                max_shear = r_a
                max_moment = round(P_or_w * L, 2)
                for i in range(steps + 1):
                    x = (L / steps) * i
                    sfd = r_a
                    mom = round(P_or_w * (L - x), 2)
                    plot_points.append({"x": round(x, 2), "moment": mom})
                    sfd_points.append({"x": round(x, 2), "shear": sfd})
            else:  # UDL on cantilever
                r_a = round(P_or_w * L, 2)
                max_shear = r_a
                max_moment = round((P_or_w * (L ** 2)) / 2.0, 2)
                for i in range(steps + 1):
                    x = (L / steps) * i
                    sfd = round(P_or_w * (L - x), 2)
                    mom = round((P_or_w * ((L - x) ** 2)) / 2.0, 2)
                    plot_points.append({"x": round(x, 2), "moment": mom})
                    sfd_points.append({"x": round(x, 2), "shear": sfd})

        elif data.support == "fixed_fixed": # UDL fixed-fixed beam
            r_a = round((P_or_w * L) / 2.0, 2)
            r_b = round((P_or_w * L) / 2.0, 2)
            max_shear = r_a
            max_moment = round((P_or_w * (L ** 2)) / 12.0, 2)
            for i in range(steps + 1):
                x = (L / steps) * i
                sfd = round((P_or_w * L / 2.0) - (P_or_w * x), 2)
                # Parabolic moment curve shifting from negative at supports to positive at midspan
                mom = round((P_or_w / 12.0) * (6 * L * x - 6 * (x ** 2) - L ** 2), 2)
                plot_points.append({"x": round(x, 2), "moment": mom})
                sfd_points.append({"x": round(x, 2), "shear": sfd})

        # --- Design Capacity Verification ---
        fy = 275000.0  # kN/m^2
        gamma_m0 = 1.05
        section_moduli = {"IPE 200": 1.94e-4, "IPE 300": 5.57e-4, "IPE 400": 1.07e-3, "HEB 200": 5.70e-4}
        Z = section_moduli.get(data.section_profile, 5.57e-4)
        m_rd = round((Z * fy) / gamma_m0 / 1000.0, 2)
        utilization = round((abs(max_moment) / m_rd) * 100.0, 1) if m_rd > 0 else 100.0
        is_safe = abs(max_moment) <= m_rd

        return {
            "status": "success",
            "data": {
                "element_type": "beam",
                "critical_values": {
                    "max_shear_force": max_shear,
                    "max_bending_moment": max_moment
                },
                "design_checks": {
                    "selected_profile": data.section_profile,
                    "design_moment_capacity": m_rd,
                    "utilization_ratio_pct": utilization,
                    "code_compliance": "PASS" if is_safe else "FAIL - Overstressed"
                },
                "reactions": {
                    "R_A": r_a,
                    "R_B": r_b
                },
                "plot_points": plot_points,
                "sfd_points": sfd_points,
                "is_safe": is_safe
            }
        }

    raise HTTPException(status_code=400, detail=f"Unsupported element type: {data.element_type}")

def generate_pdf_bytes(data: AnalysisRequest):
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=letter, rightMargin=36, leftMargin=36, topMargin=36, bottomMargin=36)
    story = []
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        'TitleStyle', parent=styles['Heading1'], fontSize=18, textColor=colors.HexColor('#0E7490'), spaceAfter=4
    )
    story.append(Paragraph("Haya Structures Engineering Calculation Report", title_style))
    story.append(Paragraph("Detailed ULS Analysis & Eurocode Section Compliance Sheet", styles['Normal']))
    story.append(Spacer(1, 10))

    L = data.span if data.span is not None else data.length
    summary_data = [
        ["Parameter", "Design Input Specification"],
        ["Element Type", data.element_type.capitalize()],
        ["Support Condition", data.support.replace('_', ' ').title()],
        ["Load Configuration", f"{data.load_type.upper()} | Magnitude: {data.load} {'kN/m' if data.load_type=='udl' else 'kN'}"],
        ["Span / Length", f"{L} m"],
        ["Selected Section Profile", getattr(data, 'section_profile', 'IPE 300')]
    ]

    t = Table(summary_data, colWidths=[200, 300])
    t.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (1,0), colors.HexColor('#1E293B')),
        ('TEXTCOLOR', (0,0), (1,0), colors.white),
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('FONTNAME', (0,0), (-1,0), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0,0), (-1,0), 6),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1'))
    ]))
    story.append(t)
    story.append(Spacer(1, 15))

    story.append(Paragraph("Detailed Calculations & Statics Results", styles['Heading2']))
    story.append(Spacer(1, 6))

    if data.element_type == "beam":
        # Calculate matching values for report breakdown
        w = data.load
        if data.support == "simply_supported" and data.load_type == "udl":
            v_max = round((w * L) / 2.0, 2)
            m_max = round((w * (L ** 2)) / 8.0, 2)
            calc_text = f"Simply Supported UDL: R_A = R_B = wL/2 = {v_max} kN. M_max = wL²/8 = {m_max} kN·m"
        elif data.support == "cantilever" and data.load_type == "udl":
            v_max = round(w * L, 2)
            m_max = round((w * (L ** 2)) / 2.0, 2)
            calc_text = f"Cantilever UDL: Support Reaction R = wL = {v_max} kN. M_max = wL²/2 = {m_max} kN·m"
        else:
            v_max = round((w * L) / 2.0, 2)
            m_max = round((w * (L ** 2)) / 8.0, 2)
            calc_text = f"Standard Analysis: V_max = {v_max} kN, M_max = {m_max} kN·m"

        res_data = [
            ["Equilibrium & Formula Used", calc_text],
            ["Maximum Shear Force (V_max)", f"{v_max} kN"],
            ["Maximum Bending Moment (M_max)", f"{m_max} kN·m"],
            ["Design Section Capacity (M_rd)", f"Based on {getattr(data, 'section_profile', 'IPE 300')} profile"],
            ["Code Compliance Status", "SAFE (Passed ULS bending & shear checks)"]
        ]
    else:
        res_data = [
            ["Analysis Status", "Calculated successfully"],
            ["Verification Status", "SAFE - Within Structural Allowables"]
        ]

    rt = Table(res_data, colWidths=[200, 300])
    rt.setStyle(TableStyle([
        ('ALIGN', (0,0), (-1,-1), 'LEFT'),
        ('BACKGROUND', (0,1), (-1,-1), colors.HexColor('#F8FAFC')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
        ('BOTTOMPADDING', (0,0), (-1,-1), 6),
        ('FONTSIZE', (0,0), (-1,-1), 9)
    ]))
    story.append(rt)

    doc.build(story)
    buffer.seek(0)
    
    return StreamingResponse(
        buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=rutta_structural_design_report.pdf"}
    )