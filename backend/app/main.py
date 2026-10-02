import os
from datetime import datetime, timedelta, date, timezone
from typing import Optional, List, Dict, Any

from fastapi import FastAPI, HTTPException, Depends, Query, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field
import jwt
import bcrypt
import psycopg
from psycopg.rows import dict_row
from dotenv import load_dotenv

raw_origins = os.getenv(
    "ALLOWED_ORIGINS", 
    "http://localhost:3000,http://127.0.0.1:3000"
)
allowed_origins = [o.strip() for o in raw_origins.split(",") if o.strip()]

# Load environment configuration
load_dotenv(override=True)

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL environment variable is not configured.")

SECRET_KEY = os.getenv("SECRET_KEY", "vectorsync_production_secret_key_change_me_later")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "480"))

app = FastAPI(title="VectorSync Production Engine", version="1.3.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins if allowed_origins else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer(auto_error=False)

def get_db():
    conn = psycopg.connect(DATABASE_URL)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()

# --- PASSWORD HASHING & VERIFICATION ---

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies against standard bcrypt hash; gracefully falls back to plain text match."""
    if not hashed_password:
        return False
    
    # Check if string starts with standard bcrypt format ($2a$, $2b$, or $2y$)
    if hashed_password.startswith(("$2a$", "$2b$", "$2y$")):
        try:
            return bcrypt.checkpw(
                plain_password.strip().encode("utf-8"),
                hashed_password.strip().encode("utf-8")
            )
        except Exception:
            return False
            
    # Fallback to plain text comparison
    return plain_password.strip() == hashed_password.strip()

# --- TOKEN & AUTH GUARDS (BOLA ELIMINATED) ---

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def get_current_user(
    auth: Optional[HTTPAuthorizationCredentials] = Depends(security),
    conn = Depends(get_db)
) -> dict:
    if not auth or not auth.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token is missing.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = jwt.decode(auth.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Malformed token payload.")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired session token.")

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute("""
            SELECT id, username, display_name, role, user_code, group_id
            FROM app_users WHERE id = %s;
        """, (int(user_id),))
        user = cur.fetchone()

    if not user:
        raise HTTPException(status_code=401, detail="User account no longer exists.")
    return user

def require_admin(current_user: dict = Depends(get_current_user)) -> dict:
    if current_user["role"] != "system":
        raise HTTPException(status_code=403, detail="Super-admin access required.")
    return current_user

def verify_group_authority(group_id: int, caller: dict, required_role: Optional[str], conn):
    """Bypasses for super-admin; otherwise verifies caller's active membership and role in target group."""
    if caller["role"] == "system":
        return caller

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute("""
            SELECT role_in_group, membership_status
            FROM group_memberships
            WHERE group_id = %s AND user_id = %s;
        """, (group_id, caller["id"]))
        membership = cur.fetchone()

    if not membership or membership["membership_status"] != "active":
        raise HTTPException(status_code=403, detail="Active membership in this group is required.")

    if required_role == "lead" and membership["role_in_group"] != "lead":
        raise HTTPException(status_code=403, detail="Group Lead authority required for this action.")

    return caller

# --- SCHEMAS ---

class LoginRequest(BaseModel):
    username: str
    password: str

class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=4)
    display_name: str = Field(..., min_length=2, max_length=100)
    user_code: str = Field(..., min_length=2, max_length=10)
    role: str = Field(default="user", pattern="^(system|user)$")
    group_id: Optional[int] = None
    role_in_group: Optional[str] = Field(default="member", pattern="^(lead|member)$")

class UserEdit(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    display_name: str = Field(..., min_length=2, max_length=100)
    user_code: str = Field(..., min_length=2, max_length=10)
    role: str = Field(default="user", pattern="^(system|user)$")

class PasswordReset(BaseModel):
    new_password: str = Field(..., min_length=4)

class GroupCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    group_code: str = Field(..., min_length=2, max_length=10)
    description: Optional[str] = None

class GroupEdit(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    group_code: str = Field(..., min_length=2, max_length=10)
    description: Optional[str] = None

class CustomerCreate(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    phone_number: str = Field(..., min_length=8, max_length=20)
    email: Optional[str] = None
    user_code: str = Field(default="MKV", max_length=10)

class CustomerEdit(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    phone_number: str = Field(..., min_length=8, max_length=20)
    email: Optional[str] = None

class ProjectCreate(BaseModel):
    customer_id: int
    group_id: Optional[int] = None
    project_name: str = Field(..., min_length=3, max_length=255)
    status_note: Optional[str] = Field(default="Project accepted", max_length=255)
    committed_date: date
    total_amount: float = Field(default=0.0, ge=0.0)
    advance_paid: float = Field(default=0.0, ge=0.0)
    asset_link: Optional[str] = None

class StatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(Pending|In Progress|Completed|Postponed|Cancelled)$")
    status_note: Optional[str] = None
    update_text: str = Field(..., min_length=3)

class ProjectMasterEdit(BaseModel):
    project_name: str
    status_note: Optional[str] = None
    committed_date: date
    total_amount: float
    advance_paid: float
    status: str
    asset_link: Optional[str] = None

class JoinGroupRequest(BaseModel):
    group_id: int

class MembershipAction(BaseModel):
    action: str = Field(..., pattern="^(approve|reject)$")

class MemberRoleUpdate(BaseModel):
    role_in_group: str = Field(..., pattern="^(lead|member)$")

# --- AUTHENTICATION ---

@app.post("/api/auth/login")
def login(payload: LoginRequest, conn = Depends(get_db)):
    query = """
        SELECT u.id, u.username, u.password_hash, u.display_name, u.role, u.user_code, u.group_id
        FROM app_users u
        WHERE u.username = %s;
    """
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(query, (payload.username.strip(),))
        user = cur.fetchone()

        if not user or not verify_password(payload.password.strip(), user["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid username or password")

        # Fetch active group memberships
        cur.execute("""
            SELECT g.id, g.name, g.group_code, gm.role_in_group
            FROM group_memberships gm
            JOIN groups g ON gm.group_id = g.id
            WHERE gm.user_id = %s AND gm.membership_status = 'active';
        """, (user["id"],))
        user_groups = cur.fetchall()

    primary_group = user_groups[0] if user_groups else None
    token = create_access_token({"sub": str(user["id"]), "role": user["role"]})

    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": user["id"],
            "username": user["username"],
            "display_name": user["display_name"],
            "role": user["role"],
            "user_code": user["user_code"],
            "group_id": primary_group["id"] if primary_group else user["group_id"],
            "group_name": primary_group["name"] if primary_group else None,
            "groups": user_groups
        }
    }

# --- DASHBOARD METRICS ---

@app.get("/api/dashboard/stats")
def get_stats(
    user_id: Optional[str] = Query(None),
    is_admin: bool = Query(False),
    conn = Depends(get_db)
):
    parsed_id = None
    if user_id and user_id.strip() not in ("undefined", "null", ""):
        try:
            parsed_id = int(user_id)
        except ValueError:
            parsed_id = None

    params = []
    where_clause = ""

    if not is_admin and parsed_id:
        where_clause = """
            WHERE p.created_by_user_id = %s 
               OR p.group_id IN (
                   SELECT gm.group_id 
                   FROM group_memberships gm 
                   WHERE gm.user_id = %s AND gm.membership_status = 'active'
               )
        """
        params.extend([parsed_id, parsed_id])

    query = f"""
        SELECT 
            COALESCE(SUM(CASE WHEN LOWER(TRIM(p.status)) = 'pending' THEN 1 ELSE 0 END), 0) AS pending,
            COALESCE(SUM(CASE WHEN LOWER(TRIM(p.status)) = 'in progress' THEN 1 ELSE 0 END), 0) AS in_progress,
            COALESCE(SUM(CASE WHEN LOWER(TRIM(p.status)) = 'completed' THEN 1 ELSE 0 END), 0) AS completed,
            COALESCE(SUM(CASE WHEN LOWER(TRIM(p.status)) = 'postponed' THEN 1 ELSE 0 END), 0) AS postponed
        FROM projects p
        {where_clause};
    """
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(query, tuple(params))
        row = cur.fetchone() or {}

    stats = [
        {"status": "Pending", "count": int(row.get("pending", 0))},
        {"status": "In Progress", "count": int(row.get("in_progress", 0))},
        {"status": "Completed", "count": int(row.get("completed", 0))},
        {"status": "Postponed", "count": int(row.get("postponed", 0))},
    ]
    return {"stats": stats}

@app.get("/api/projects/schedule")
def get_schedule(user_id: Optional[str] = Query(None), is_admin: bool = Query(False), conn = Depends(get_db)):
    parsed_id = None
    if user_id and user_id.strip() not in ("undefined", "null", ""):
        try:
            parsed_id = int(user_id)
        except ValueError:
            parsed_id = None

    query = """
        SELECT 
            p.id, p.project_display_id, p.customer_id, p.group_id, p.project_name, 
            p.status, p.status_note, p.committed_date, p.postponed_date,
            p.total_amount, p.advance_paid, (p.total_amount - p.advance_paid) AS balance_due,
            p.payment_status, p.asset_link, p.created_by_user_id,
            u.display_name AS owner_name, u.username AS owner_username, u.user_code,
            c.customer_display_id, c.name AS customer_name, c.phone_number AS customer_phone
        FROM projects p
        JOIN customers c ON p.customer_id = c.id
        JOIN app_users u ON p.created_by_user_id = u.id
        WHERE p.committed_date = CURRENT_DATE 
          AND p.status NOT IN ('Completed', 'Cancelled')
    """
    params = []
    if not is_admin and parsed_id:
        query += """ AND (
            p.created_by_user_id = %s OR p.group_id IN (
                SELECT gm.group_id FROM group_memberships gm WHERE gm.user_id = %s AND gm.membership_status = 'active'
            )
        )"""
        params.extend([parsed_id, parsed_id])

    query += " ORDER BY p.id DESC;"
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(query, tuple(params))
        rows = cur.fetchall()
    return {"schedule": rows}

@app.get("/api/projects/backlog")
def get_backlog(user_id: Optional[str] = Query(None), is_admin: bool = Query(False), conn = Depends(get_db)):
    parsed_id = None
    if user_id and user_id.strip() not in ("undefined", "null", ""):
        try:
            parsed_id = int(user_id)
        except ValueError:
            parsed_id = None

    query = """
        SELECT 
            p.id, p.project_display_id, p.customer_id, p.group_id, p.project_name, 
            p.status, p.status_note, p.committed_date, p.postponed_date,
            p.total_amount, p.advance_paid, (p.total_amount - p.advance_paid) AS balance_due,
            p.payment_status, p.asset_link, p.created_by_user_id,
            u.display_name AS owner_name, u.username AS owner_username, u.user_code,
            c.customer_display_id, c.name AS customer_name, c.phone_number AS customer_phone
        FROM projects p
        JOIN customers c ON p.customer_id = c.id
        JOIN app_users u ON p.created_by_user_id = u.id
        WHERE p.committed_date < CURRENT_DATE 
          AND p.status IN ('Pending', 'In Progress')
    """
    params = []
    if not is_admin and parsed_id:
        query += """ AND (
            p.created_by_user_id = %s OR p.group_id IN (
                SELECT gm.group_id FROM group_memberships gm WHERE gm.user_id = %s AND gm.membership_status = 'active'
            )
        )"""
        params.extend([parsed_id, parsed_id])

    query += " ORDER BY p.committed_date ASC;"
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(query, tuple(params))
        rows = cur.fetchall()
    return {"backlog": rows}

@app.get("/api/projects/all")
def get_all_projects(
    status: Optional[str] = Query(None),
    user_id: Optional[str] = Query(None),
    customer_id: Optional[int] = Query(None),
    is_admin: bool = Query(False),
    conn = Depends(get_db)
):
    parsed_id = None
    if user_id and user_id.strip() not in ("undefined", "null", ""):
        try:
            parsed_id = int(user_id)
        except ValueError:
            parsed_id = None

    query = """
        SELECT 
            p.id, p.project_display_id, p.customer_id, p.group_id, p.project_name, 
            p.status, p.status_note, p.committed_date, p.postponed_date,
            p.total_amount, p.advance_paid, (p.total_amount - p.advance_paid) AS balance_due,
            p.payment_status, p.asset_link, p.created_by_user_id,
            u.display_name AS owner_name, u.username AS owner_username, u.user_code,
            c.customer_display_id, c.name AS customer_name, c.phone_number AS customer_phone
        FROM projects p
        JOIN customers c ON p.customer_id = c.id
        JOIN app_users u ON p.created_by_user_id = u.id
        WHERE 1=1
    """
    params = []
    if status:
        query += " AND LOWER(TRIM(p.status)) = LOWER(TRIM(%s))"
        params.append(status)
    if not is_admin and parsed_id:
        query += """ AND (
            p.created_by_user_id = %s OR p.group_id IN (
                SELECT gm.group_id FROM group_memberships gm WHERE gm.user_id = %s AND gm.membership_status = 'active'
            )
        )"""
        params.extend([parsed_id, parsed_id])
    if customer_id:
        query += " AND p.customer_id = %s"
        params.append(customer_id)

    query += " ORDER BY p.id DESC;"
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(query, tuple(params))
        rows = cur.fetchall()
    return {"projects": rows}

# --- CUSTOMERS ---

@app.get("/api/customers")
def get_customers(conn = Depends(get_db)):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute("SELECT * FROM customers ORDER BY id DESC;")
        rows = cur.fetchall()
    return {"customers": rows}

@app.get("/api/customers/board")
def get_customer_board(conn = Depends(get_db)):
    query = """
        SELECT 
            c.id, c.customer_display_id, c.user_code, c.name, c.phone_number, c.email,
            COUNT(p.id) AS total_orders,
            COUNT(CASE WHEN p.status = 'Completed' THEN 1 END) AS completed_orders,
            COUNT(CASE WHEN p.status IN ('Pending', 'In Progress') THEN 1 END) AS active_orders
        FROM customers c
        LEFT JOIN projects p ON c.id = p.customer_id
        GROUP BY c.id
        ORDER BY c.id DESC;
    """
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(query)
        rows = cur.fetchall()
    return {"board": rows}

@app.post("/api/customers")
def create_customer(
    payload: CustomerCreate,
    current_user: dict = Depends(get_current_user),
    conn = Depends(get_db)
):
    query = """
        INSERT INTO customers (name, phone_number, email, user_code)
        VALUES (%s, %s, %s, %s)
        RETURNING id, customer_display_id, user_code, name, phone_number, email;
    """
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(query, (
            payload.name.strip(),
            payload.phone_number.strip(),
            payload.email.strip() if payload.email else None,
            current_user["user_code"] or payload.user_code.strip().upper()
        ))
        customer = cur.fetchone()
    return {"message": "Customer created", "customer": customer}

# --- PROJECTS MUTATIONS ---

@app.post("/api/projects")
def create_project(
    payload: ProjectCreate,
    current_user: dict = Depends(get_current_user),
    conn = Depends(get_db)
):
    if payload.advance_paid <= 0:
        payment_status = "Unpaid"
    elif payload.advance_paid >= payload.total_amount and payload.total_amount > 0:
        payment_status = "Paid in Full"
    elif payload.advance_paid < (payload.total_amount * 0.5):
        payment_status = "Advance Paid"
    else:
        payment_status = "Partial Paid"

    note = payload.status_note.strip() if payload.status_note else "Project accepted"
    target_group = payload.group_id or current_user["group_id"]

    query = """
        INSERT INTO projects (
            customer_id, created_by_user_id, group_id, project_name, committed_date,
            total_amount, advance_paid, payment_status, asset_link, status_note
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        RETURNING id, project_display_id, customer_id, project_name, 
                  status, status_note, payment_status, committed_date;
    """
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(query, (
            payload.customer_id,
            current_user["id"],
            target_group,
            payload.project_name.strip(),
            payload.committed_date,
            payload.total_amount,
            payload.advance_paid,
            payment_status,
            payload.asset_link.strip() if payload.asset_link else None,
            note
        ))
        project = cur.fetchone()

        cur.execute(
            "INSERT INTO project_logs (project_id, update_text, new_status) VALUES (%s, %s, %s);",
            (project["id"], note, "Pending")
        )
    return {"message": "Project created", "project": project}

@app.patch("/api/projects/{project_id}/status")
def update_project_status(
    project_id: int, 
    payload: StatusUpdate,
    current_user: dict = Depends(get_current_user),
    conn = Depends(get_db)
):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute("SELECT id, status, group_id, created_by_user_id FROM projects WHERE id = %s;", (project_id,))
        project = cur.fetchone()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        # Caller must be author, super-admin, or active member in the group
        if current_user["role"] != "system" and project["created_by_user_id"] != current_user["id"]:
            if project["group_id"]:
                cur.execute("""
                    SELECT 1 FROM group_memberships 
                    WHERE user_id = %s AND group_id = %s AND membership_status = 'active';
                """, (current_user["id"], project["group_id"]))
                if not cur.fetchone():
                    raise HTTPException(status_code=403, detail="Unauthorized: You are not enrolled in this project's group.")
            else:
                raise HTTPException(status_code=403, detail="Unauthorized project access.")

        old_status = project["status"]
        update_query = "UPDATE projects SET status = %s"
        params = [payload.status]

        if payload.status_note:
            update_query += ", status_note = %s"
            params.append(payload.status_note.strip())

        update_query += " WHERE id = %s RETURNING id, status, status_note;"
        params.append(project_id)

        cur.execute(update_query, tuple(params))
        updated = cur.fetchone()

        cur.execute("""
            INSERT INTO project_logs (project_id, update_text, old_status, new_status)
            VALUES (%s, %s, %s, %s);
        """, (project_id, payload.update_text.strip(), old_status, payload.status))

    return {"message": "Status updated", "project": updated}

# --- GROUP COLLABORATION & GOVERNANCE ---

@app.get("/api/groups")
def get_groups(conn = Depends(get_db)):
    query = """
        SELECT g.id, g.name, g.group_code, g.description, 
               COUNT(gm.user_id) AS member_count
        FROM groups g
        LEFT JOIN group_memberships gm ON g.id = gm.group_id AND gm.membership_status = 'active'
        GROUP BY g.id, g.name, g.group_code, g.description
        ORDER BY g.id ASC;
    """
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(query)
        rows = cur.fetchall()
    return {"groups": rows}

@app.get("/api/user/{user_id}/groups")
def get_user_groups(user_id: int, conn = Depends(get_db)):
    query = """
        SELECT g.id, g.name, g.group_code, g.description,
               gm.membership_status, gm.role_in_group, gm.requested_at
        FROM group_memberships gm
        JOIN groups g ON gm.group_id = g.id
        WHERE gm.user_id = %s
        ORDER BY gm.membership_status ASC, g.name ASC;
    """
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(query, (user_id,))
        memberships = cur.fetchall()
    return {"groups": memberships}

@app.post("/api/groups/join")
def request_join_group(
    payload: JoinGroupRequest,
    current_user: dict = Depends(get_current_user),
    conn = Depends(get_db)
):
    query = """
        INSERT INTO group_memberships (user_id, group_id, membership_status, role_in_group)
        VALUES (%s, %s, 'pending', 'member')
        ON CONFLICT (user_id, group_id) DO UPDATE
        SET membership_status = 'pending'
        RETURNING id, group_id, membership_status;
    """
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(query, (current_user["id"], payload.group_id))
        req = cur.fetchone()
    return {"message": "Join request submitted. Awaiting Lead or Admin approval.", "request": req}

@app.delete("/api/groups/{group_id}/leave")
def leave_group(
    group_id: int,
    current_user: dict = Depends(get_current_user),
    conn = Depends(get_db)
):
    with conn.cursor(row_factory=dict_row) as cur:
        # Check if the leaving user is the sole lead
        cur.execute("""
            SELECT role_in_group FROM group_memberships 
            WHERE user_id = %s AND group_id = %s AND membership_status = 'active';
        """, (current_user["id"], group_id))
        mem = cur.fetchone()
        if not mem:
            raise HTTPException(status_code=404, detail="Membership record not found.")

        if mem["role_in_group"] == "lead":
            cur.execute("""
                SELECT COUNT(*) AS total_leads FROM group_memberships
                WHERE group_id = %s AND role_in_group = 'lead' AND membership_status = 'active';
            """, (group_id,))
            leads = cur.fetchone()["total_leads"]
            if leads <= 1:
                raise HTTPException(
                    status_code=400,
                    detail="Cannot leave group as the sole Lead. Appoint another member as Lead before exiting."
                )

        cur.execute("DELETE FROM group_memberships WHERE user_id = %s AND group_id = %s RETURNING id;", (current_user["id"], group_id))
        cur.execute("UPDATE app_users SET group_id = NULL WHERE id = %s AND group_id = %s;", (current_user["id"], group_id))

    return {"message": "You have left the group."}

@app.get("/api/groups/{group_id}/members")
def get_group_members(group_id: int, conn = Depends(get_db)):
    query = """
        SELECT u.id, u.username, u.display_name, u.user_code, gm.role_in_group, gm.approved_at
        FROM group_memberships gm
        JOIN app_users u ON gm.user_id = u.id
        WHERE gm.group_id = %s AND gm.membership_status = 'active'
        ORDER BY gm.role_in_group ASC, u.display_name ASC;
    """
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(query, (group_id,))
        members = cur.fetchall()
    return {"members": members}

@app.get("/api/groups/{group_id}/pending-requests")
def get_pending_requests(group_id: int, conn = Depends(get_db)):
    query = """
        SELECT gm.id, gm.user_id, gm.requested_at,
               u.username, u.display_name, u.user_code
        FROM group_memberships gm
        JOIN app_users u ON gm.user_id = u.id
        WHERE gm.group_id = %s AND gm.membership_status = 'pending'
        ORDER BY gm.requested_at ASC;
    """
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(query, (group_id,))
        requests = cur.fetchall()
    return {"requests": requests}

@app.patch("/api/groups/{group_id}/requests/{membership_id}")
def decide_membership_request(
    group_id: int, 
    membership_id: int, 
    payload: MembershipAction,
    current_user: dict = Depends(get_current_user),
    conn = Depends(get_db)
):
    verify_group_authority(group_id, current_user, required_role="lead", conn=conn)

    with conn.cursor(row_factory=dict_row) as cur:
        if payload.action == "approve":
            cur.execute("""
                UPDATE group_memberships
                SET membership_status = 'active', approved_by_user_id = %s, approved_at = CURRENT_TIMESTAMP
                WHERE id = %s AND group_id = %s
                RETURNING id, user_id;
            """, (current_user["id"], membership_id, group_id))
            rec = cur.fetchone()
            if rec:
                cur.execute("UPDATE app_users SET group_id = %s WHERE id = %s AND group_id IS NULL;", (group_id, rec["user_id"]))
        else:
            cur.execute("DELETE FROM group_memberships WHERE id = %s AND group_id = %s RETURNING id;", (membership_id, group_id))
            rec = cur.fetchone()

        if not rec:
            raise HTTPException(status_code=404, detail="Request record not found.")

    return {"message": f"Membership request {payload.action}d."}

@app.patch("/api/groups/{group_id}/members/{target_user_id}/role")
def update_member_role(
    group_id: int,
    target_user_id: int,
    payload: MemberRoleUpdate,
    current_user: dict = Depends(get_current_user),
    conn = Depends(get_db)
):
    verify_group_authority(group_id, current_user, required_role="lead", conn=conn)

    with conn.cursor(row_factory=dict_row) as cur:
        # Prevent demoting the last remaining lead
        if payload.role_in_group == "member":
            cur.execute("""
                SELECT COUNT(*) AS total_leads 
                FROM group_memberships 
                WHERE group_id = %s AND role_in_group = 'lead' AND membership_status = 'active';
            """, (group_id,))
            leads = cur.fetchone()["total_leads"]
            if leads <= 1:
                cur.execute("""
                    SELECT role_in_group FROM group_memberships WHERE group_id = %s AND user_id = %s;
                """, (group_id, target_user_id))
                target = cur.fetchone()
                if target and target["role_in_group"] == "lead":
                    raise HTTPException(status_code=400, detail="Cannot demote the sole remaining Lead of this group.")

        cur.execute("""
            UPDATE group_memberships
            SET role_in_group = %s
            WHERE group_id = %s AND user_id = %s AND membership_status = 'active'
            RETURNING id, role_in_group;
        """, (payload.role_in_group, group_id, target_user_id))
        updated = cur.fetchone()

        if not updated:
            raise HTTPException(status_code=404, detail="Active member not found in this group.")

    return {"message": f"Member role updated to '{payload.role_in_group}'.", "membership": updated}

@app.delete("/api/groups/{group_id}/members/{target_user_id}")
def remove_group_member(
    group_id: int,
    target_user_id: int,
    current_user: dict = Depends(get_current_user),
    conn = Depends(get_db)
):
    verify_group_authority(group_id, current_user, required_role="lead", conn=conn)

    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute("""
            SELECT role_in_group 
            FROM group_memberships 
            WHERE group_id = %s AND user_id = %s AND membership_status = 'active';
        """, (group_id, target_user_id))
        target_mem = cur.fetchone()
        if not target_mem:
            raise HTTPException(status_code=404, detail="Member not found in this group.")

        if target_mem["role_in_group"] == "lead":
            cur.execute("""
                SELECT COUNT(*) AS total_leads 
                FROM group_memberships 
                WHERE group_id = %s AND role_in_group = 'lead' AND membership_status = 'active';
            """, (group_id,))
            lead_count = cur.fetchone()["total_leads"]
            if lead_count <= 1:
                raise HTTPException(
                    status_code=400, 
                    detail="Cannot remove the sole Group Lead. Promote another member to Lead first."
                )

        cur.execute("DELETE FROM group_memberships WHERE group_id = %s AND user_id = %s;", (group_id, target_user_id))
        cur.execute("UPDATE app_users SET group_id = NULL WHERE id = %s AND group_id = %s;", (target_user_id, group_id))

    return {"message": "Member removed successfully from the group."}

# --- SYSTEM CONSOLE ENDPOINTS (ADMIN ONLY) ---

@app.get("/api/admin/users", dependencies=[Depends(require_admin)])
def get_admin_users(conn = Depends(get_db)):
    query = """
        SELECT 
            u.id, u.username, u.display_name, u.role, u.user_code, u.created_at,
            COALESCE(
                json_agg(
                    json_build_object(
                        'group_id', g.id,
                        'group_name', g.name,
                        'group_code', g.group_code,
                        'role_in_group', gm.role_in_group
                    )
                ) FILTER (WHERE gm.membership_status = 'active'),
                '[]'
            ) AS active_groups
        FROM app_users u
        LEFT JOIN group_memberships gm ON gm.user_id = u.id AND gm.membership_status = 'active'
        LEFT JOIN groups g ON gm.group_id = g.id
        GROUP BY u.id
        ORDER BY u.id ASC;
    """
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(query)
        rows = cur.fetchall()
    return {"users": rows}

@app.post("/api/admin/users", dependencies=[Depends(require_admin)])
def create_admin_user(payload: UserCreate, conn = Depends(get_db)):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute("SELECT id FROM app_users WHERE username = %s;", (payload.username.strip(),))
        if cur.fetchone():
            raise HTTPException(status_code=400, detail="Username is already taken.")

        cur.execute("SELECT id FROM app_users WHERE user_code = %s;", (payload.user_code.strip().upper(),))
        if cur.fetchone():
            raise HTTPException(status_code=400, detail=f"User code '{payload.user_code.upper()}' is already in use.")

        assigned_group = payload.group_id if payload.role == "user" else None

        # Hash password via bcrypt
        hashed_pw = bcrypt.hashpw(payload.password.strip().encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

        cur.execute("""
            INSERT INTO app_users (username, password_hash, display_name, role, user_code, group_id)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id, username, display_name, role, user_code;
        """, (
            payload.username.strip(),
            hashed_pw,
            payload.display_name.strip(),
            payload.role,
            payload.user_code.strip().upper(),
            assigned_group
        ))
        new_user = cur.fetchone()

        if assigned_group and payload.role == "user":
            chosen_role = payload.role_in_group or "member"
            cur.execute("""
                INSERT INTO group_memberships (user_id, group_id, membership_status, role_in_group, approved_at)
                VALUES (%s, %s, 'active', %s, CURRENT_TIMESTAMP)
                ON CONFLICT (user_id, group_id) DO UPDATE SET membership_status = 'active', role_in_group = EXCLUDED.role_in_group;
            """, (new_user["id"], assigned_group, chosen_role))

    return {"message": "User created successfully", "user": new_user}

@app.put("/api/admin/users/{user_id}", dependencies=[Depends(require_admin)])
def edit_user(user_id: int, payload: UserEdit, conn = Depends(get_db)):
    with conn.cursor(row_factory=dict_row) as cur:
        try:
            cur.execute("""
                UPDATE app_users 
                SET username = %s, display_name = %s, user_code = %s, role = %s
                WHERE id = %s
                RETURNING id, username, display_name, user_code, role;
            """, (
                payload.username.strip(),
                payload.display_name.strip(),
                payload.user_code.strip().upper(),
                payload.role,
                user_id
            ))
            updated = cur.fetchone()
            if not updated:
                raise HTTPException(status_code=404, detail="User not found")

            if payload.role == 'system':
                cur.execute("DELETE FROM group_memberships WHERE user_id = %s;", (user_id,))
                cur.execute("UPDATE app_users SET group_id = NULL WHERE id = %s;", (user_id,))
        except Exception:
            raise HTTPException(status_code=400, detail="Username or user code already in use.")

    return {"message": "User profile updated successfully", "user": updated}

@app.patch("/api/admin/users/{user_id}/reset-password", dependencies=[Depends(require_admin)])
def reset_password(user_id: int, payload: PasswordReset, conn = Depends(get_db)):
    hashed_pw = bcrypt.hashpw(payload.new_password.strip().encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute("UPDATE app_users SET password_hash = %s WHERE id = %s RETURNING id, username;", (hashed_pw, user_id))
        user = cur.fetchone()
        if not user:
            raise HTTPException(status_code=404, detail="User not found")
    return {"message": f"Password reset for @{user['username']}"}

@app.delete("/api/admin/users/{user_id}", dependencies=[Depends(require_admin)])
def delete_user(user_id: int, conn = Depends(get_db)):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute("SELECT id, username, role FROM app_users WHERE id = %s;", (user_id,))
        target = cur.fetchone()
        if not target:
            raise HTTPException(status_code=404, detail="User not found")
        if target["role"] == "system" or target["username"] == "sys_root":
            raise HTTPException(status_code=403, detail="System root account cannot be removed.")

        cur.execute("DELETE FROM app_users WHERE id = %s RETURNING id, username;", (user_id,))
        deleted = cur.fetchone()
    return {"message": f"User @{deleted['username']} deleted"}

@app.post("/api/admin/groups", dependencies=[Depends(require_admin)])
def create_group(payload: GroupCreate, conn = Depends(get_db)):
    with conn.cursor(row_factory=dict_row) as cur:
        try:
            cur.execute("""
                INSERT INTO groups (name, group_code, description)
                VALUES (%s, %s, %s)
                RETURNING id, name, group_code, description;
            """, (payload.name.strip(), payload.group_code.strip().upper(), payload.description.strip() if payload.description else None))
            group = cur.fetchone()
        except Exception:
            raise HTTPException(status_code=400, detail="Group name or code already exists.")
    return {"message": "Group created", "group": group}

@app.put("/api/admin/groups/{group_id}", dependencies=[Depends(require_admin)])
def edit_group(group_id: int, payload: GroupEdit, conn = Depends(get_db)):
    with conn.cursor(row_factory=dict_row) as cur:
        try:
            cur.execute("""
                UPDATE groups
                SET name = %s, group_code = %s, description = %s
                WHERE id = %s
                RETURNING id, name, group_code, description;
            """, (payload.name.strip(), payload.group_code.strip().upper(), payload.description.strip() if payload.description else None, group_id))
            updated = cur.fetchone()
            if not updated:
                raise HTTPException(status_code=404, detail="Group not found")
        except Exception:
            raise HTTPException(status_code=400, detail="Group name or code already in use.")
    return {"message": "Group updated", "group": updated}

@app.delete("/api/admin/groups/{group_id}", dependencies=[Depends(require_admin)])
def delete_group(group_id: int, conn = Depends(get_db)):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute("DELETE FROM groups WHERE id = %s RETURNING id, name;", (group_id,))
        deleted = cur.fetchone()
        if not deleted:
            raise HTTPException(status_code=404, detail="Group not found")
    return {"message": f"Group '{deleted['name']}' deleted"}

@app.put("/api/admin/customers/{customer_id}", dependencies=[Depends(require_admin)])
def edit_customer(customer_id: int, payload: CustomerEdit, conn = Depends(get_db)):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute("""
            UPDATE customers
            SET name = %s, phone_number = %s, email = %s
            WHERE id = %s
            RETURNING id, customer_display_id, name, phone_number, email;
        """, (payload.name.strip(), payload.phone_number.strip(), payload.email.strip() if payload.email else None, customer_id))
        updated = cur.fetchone()
        if not updated:
            raise HTTPException(status_code=404, detail="Customer not found")
    return {"message": "Customer updated", "customer": updated}

@app.delete("/api/admin/customers/{customer_id}", dependencies=[Depends(require_admin)])
def delete_customer(customer_id: int, conn = Depends(get_db)):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute("DELETE FROM customers WHERE id = %s RETURNING id, name;", (customer_id,))
        deleted = cur.fetchone()
        if not deleted:
            raise HTTPException(status_code=404, detail="Customer not found")
    return {"message": f"Customer '{deleted['name']}' deleted"}

@app.put("/api/admin/projects/{project_id}", dependencies=[Depends(require_admin)])
def admin_edit_project(project_id: int, payload: ProjectMasterEdit, conn = Depends(get_db)):
    if payload.advance_paid <= 0:
        payment_status = "Unpaid"
    elif payload.advance_paid >= payload.total_amount and payload.total_amount > 0:
        payment_status = "Paid in Full"
    elif payload.advance_paid < (payload.total_amount * 0.5):
        payment_status = "Advance Paid"
    else:
        payment_status = "Partial Paid"

    query = """
        UPDATE projects SET
            project_name = %s, status_note = %s, committed_date = %s,
            total_amount = %s, advance_paid = %s, payment_status = %s,
            status = %s, asset_link = %s
        WHERE id = %s
        RETURNING id, project_display_id, project_name, status_note, total_amount, advance_paid, payment_status, status;
    """
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute(query, (
            payload.project_name.strip(),
            payload.status_note.strip() if payload.status_note else "Project updated",
            payload.committed_date,
            payload.total_amount,
            payload.advance_paid,
            payment_status,
            payload.status,
            payload.asset_link.strip() if payload.asset_link else None,
            project_id
        ))
        updated = cur.fetchone()
        if not updated:
            raise HTTPException(status_code=404, detail="Project not found")

        cur.execute(
            "INSERT INTO project_logs (project_id, update_text, new_status) VALUES (%s, %s, %s);",
            (project_id, "System override on record attributes", payload.status)
        )
    return {"message": "Project record updated", "project": updated}

@app.delete("/api/admin/projects/{project_id}", dependencies=[Depends(require_admin)])
def delete_project(project_id: int, conn = Depends(get_db)):
    with conn.cursor(row_factory=dict_row) as cur:
        cur.execute("DELETE FROM projects WHERE id = %s RETURNING id, project_name;", (project_id,))
        deleted = cur.fetchone()
        if not deleted:
            raise HTTPException(status_code=404, detail="Project not found")
    return {"message": f"Project '{deleted['project_name']}' deleted"}