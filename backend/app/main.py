import os
import urllib.parse
from datetime import datetime, time
from typing import Optional
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from psycopg.rows import dict_row

from app.core.db import get_db
from app.schemas.project import ProjectCreate, ProjectStatusUpdate
from pydantic import BaseModel, Field

class CustomerCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    phone_number: str = Field(..., min_length=7, max_length=20)
    email: Optional[str] = Field(None, max_length=100)

load_dotenv()

app = FastAPI(
    title="VectorSync Production Engine",
    description="Multi-Partner Workflow & Production Engine",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

WORK_START = time(int(os.getenv("WORK_START_HOUR", 6)), 0, 0)
WORK_END = time(int(os.getenv("WORK_END_HOUR", 22)), 0, 0)

@app.middleware("http")
async def operational_hours_guard(request: Request, call_next):
    # Health checks, documentation, and admin overrides bypass the time gate
    if request.url.path in ["/", "/health", "/docs", "/openapi.json"] or request.url.path.startswith("/api/admin"):
        return await call_next(request)

    current_time = datetime.now().time()
    if not (WORK_START <= current_time <= WORK_END):
        raise HTTPException(
            status_code=403,
            detail="VectorSync operations are closed. Daily operational window is restricted."
        )
    return await call_next(request)

@app.get("/")
def read_root():
    return {
        "system": "VectorSync Core Engine",
        "status": "online",
        "docs": "/docs",
        "health": "/health"
    }

@app.get("/health")
def health_check():
    return {
        "status": "online",
        "system": "VectorSync Engine",
        "engine": "Python 3 / FastAPI"
    }

# --- 1. PROJECT CREATION ---
@app.post("/api/projects")
def create_project(payload: ProjectCreate, conn = Depends(get_db)):
    query = """
        INSERT INTO projects (
            customer_id, project_name, assigned_partner_id,
            committed_date, total_amount, advance_paid, asset_link
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        RETURNING id, customer_project_seq, created_at;
    """
    with conn.cursor() as cur:
        cur.execute(
            query,
            (
                payload.customer_id,
                payload.project_name,
                payload.assigned_partner_id,
                payload.committed_date,
                payload.total_amount,
                payload.advance_paid,
                payload.asset_link
            )
        )
        row = cur.fetchone()

    return {
        "message": "Project registered successfully",
        "project_id": row[0],
        "sequence": row[1]
    }

# --- 2. STATUS UPDATE & AUDIT LOGGING ---
@app.patch("/api/projects/{project_id}/status")
def update_project_status(project_id: int, payload: ProjectStatusUpdate, conn = Depends(get_db)):
    select_query = "SELECT status FROM projects WHERE id = %s;"
    update_query = """
        UPDATE projects 
        SET status = %s, updated_at = CURRENT_TIMESTAMP 
        WHERE id = %s;
    """
    log_query = """
        INSERT INTO project_logs (project_id, update_text, old_status, new_status)
        VALUES (%s, %s, %s, %s);
    """
    
    with conn.cursor() as cur:
        cur.execute(select_query, (project_id,))
        old_row = cur.fetchone()
        if not old_row:
            raise HTTPException(status_code=404, detail="Project not found")
        
        old_status = old_row[0]
        cur.execute(update_query, (payload.status, project_id))
        cur.execute(log_query, (project_id, payload.update_text, old_status, payload.status))

    return {
        "message": "Status updated and logged",
        "project_id": project_id,
        "old_status": old_status,
        "new_status": payload.status
    }

# --- 3. CORE ANALYTICAL & WORKFLOW QUERIES ---

@app.get("/api/dashboard/stats")
def get_dashboard_stats(conn = Depends(get_db)):
    query = "SELECT status, COUNT(*) AS count FROM projects GROUP BY status;"
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(query)
        rows = cur.fetchall()
    return {"stats": rows}

@app.get("/api/projects/today")
def get_today_schedule(conn = Depends(get_db)):
    query = """
        SELECT p.*, c.name AS customer_name, c.phone_number, pt.name AS partner_name
        FROM projects p
        JOIN customers c ON p.customer_id = c.id
        JOIN partners pt ON p.assigned_partner_id = pt.id
        WHERE p.committed_date = CURRENT_DATE AND p.status != 'Completed'
        ORDER BY p.id ASC;
    """
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(query)
        rows = cur.fetchall()
    return {"today_schedule": rows}

@app.get("/api/projects/backlog")
def get_backlog(conn = Depends(get_db)):
    query = """
        SELECT p.*, c.name AS customer_name, c.phone_number, pt.name AS partner_name
        FROM projects p
        JOIN customers c ON p.customer_id = c.id
        JOIN partners pt ON p.assigned_partner_id = pt.id
        WHERE p.committed_date < CURRENT_DATE AND p.status = 'Pending'
        ORDER BY p.committed_date ASC;
    """
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(query)
        rows = cur.fetchall()
    return {"backlog": rows}

@app.get("/api/customers/board")
def get_customer_board(conn = Depends(get_db)):
    query = """
        SELECT 
            c.customer_display_id, 
            c.name, 
            COUNT(p.id) AS total_orders, 
            COUNT(CASE WHEN p.status = 'Completed' THEN 1 END) AS completed_orders, 
            COUNT(CASE WHEN p.status = 'Pending' THEN 1 END) AS pending_orders 
        FROM customers c 
        LEFT JOIN projects p ON c.id = p.customer_id 
        GROUP BY c.id 
        ORDER BY c.id ASC;
    """
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(query)
        rows = cur.fetchall()
    return {"customers": rows}

# --- 4. ZERO-COST CLICK-TO-WHATSAPP GENERATOR ---
@app.get("/api/projects/{project_id}/whatsapp-link")
def generate_whatsapp_link(project_id: int, conn = Depends(get_db)):
    query = """
        SELECT p.project_name, p.status, p.asset_link, c.name AS customer_name, c.phone_number, pt.name AS partner_name
        FROM projects p
        JOIN customers c ON p.customer_id = c.id
        JOIN partners pt ON p.assigned_partner_id = pt.id
        WHERE p.id = %s;
    """
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(query, (project_id,))
        row = cur.fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Project not found")

    # Format phone digits
    clean_phone = "".join(filter(str.isdigit, row["phone_number"]))
    
    # Construct zero-cost message
    asset_info = f"\nAsset Link: {row['asset_link']}" if row['asset_link'] else ""
    message = (
        f"Hello {row['customer_name']},\n\n"
        f"Update regarding your project '{row['project_name']}':\n"
        f"Status: {row['status']}\n"
        f"Handled by: {row['partner_name']}"
        f"{asset_info}\n\n"
        f"Thank you for choosing us!"
    )
    
    encoded_message = urllib.parse.quote(message)
    wa_url = f"https://wa.me/{clean_phone}?text={encoded_message}"
    
    return {"whatsapp_url": wa_url, "preview_text": message}

# Add to imports / schema section
@app.get("/api/customers")
def get_customers(conn = Depends(get_db)):
    query = "SELECT id, customer_display_id, name, phone_number, email FROM customers ORDER BY name ASC;"
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(query)
        rows = cur.fetchall()
    return {"customers": rows}

@app.post("/api/customers")
def create_customer(payload: CustomerCreate, conn = Depends(get_db)):
    query = """
        INSERT INTO customers (name, phone_number, email)
        VALUES (%s, %s, %s)
        RETURNING id, customer_display_id, name, phone_number;
    """
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(query, (payload.name.strip(), payload.phone_number.strip(), payload.email.strip() if payload.email else None))
        customer = cur.fetchone()
    return {"message": "Customer registered", "customer": customer}