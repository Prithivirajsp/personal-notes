from datetime import date
from typing import Optional

from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy import Column, Integer, String, Boolean, Text
from sqlalchemy.orm import Session

from pydantic import BaseModel, Field

from database import Base, engine, get_db


# ============================================================
# DATABASE MODELS
# ============================================================

class Note(Base):
    __tablename__ = "notes"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=True)
    color = Column(String(50), nullable=True)
    pinned = Column(Boolean, default=False, nullable=False)


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    priority = Column(String(50), default="medium", nullable=False)
    due_date = Column(String(50), nullable=True)
    is_done = Column(Boolean, default=False, nullable=False)


class Book(Base):
    __tablename__ = "books"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    author = Column(String(255), nullable=True)
    status = Column(String(50), default="wanttoread", nullable=False)
    rating = Column(Integer, default=0, nullable=False)
    cover_color = Column(String(50), nullable=True)


class Event(Base):
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    event_date = Column(String(50), nullable=False)
    event_time = Column(String(50), nullable=True)
    category = Column(String(50), default="general", nullable=False)
    is_done = Column(Boolean, default=False, nullable=False)


Base.metadata.create_all(bind=engine)


# ============================================================
# FASTAPI
# ============================================================

app = FastAPI(
    title="Pinboard API",
    description="Personal Pinboard Notes, Tasks, Books and Scheduler API",
    version="1.0.0",
)


app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://prithivirajsp.github.io/personal-notes/"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# NOTE SCHEMAS
# ============================================================

class NoteCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    content: Optional[str] = None
    color: Optional[str] = "#FAF6EE"
    pinned: bool = False


class NoteUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    color: Optional[str] = None
    pinned: Optional[bool] = None


# ============================================================
# TASK SCHEMAS
# ============================================================

class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    priority: str = "medium"
    due_date: Optional[str] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    priority: Optional[str] = None
    due_date: Optional[str] = None
    is_done: Optional[bool] = None


# ============================================================
# BOOK SCHEMAS
# ============================================================

class BookCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    author: Optional[str] = None
    status: str = "wanttoread"
    rating: int = Field(default=0, ge=0, le=5)
    cover_color: Optional[str] = "#C97B84"


class BookUpdate(BaseModel):
    title: Optional[str] = None
    author: Optional[str] = None
    status: Optional[str] = None
    rating: Optional[int] = Field(default=None, ge=0, le=5)
    cover_color: Optional[str] = None


# ============================================================
# EVENT SCHEMAS
# ============================================================

class EventCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    event_date: str
    event_time: Optional[str] = None
    category: str = "general"


class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    event_date: Optional[str] = None
    event_time: Optional[str] = None
    category: Optional[str] = None
    is_done: Optional[bool] = None


# ============================================================
# VALIDATION
# ============================================================

VALID_PRIORITIES = {"low", "medium", "high"}

VALID_BOOK_STATUSES = {
    "wanttoread",
    "reading",
    "finished",
}


def validate_priority(priority: str):
    if priority not in VALID_PRIORITIES:
        raise HTTPException(
            status_code=400,
            detail="Priority must be low, medium, or high.",
        )


def validate_book_status(status: str):
    if status not in VALID_BOOK_STATUSES:
        raise HTTPException(
            status_code=400,
            detail="Status must be wanttoread, reading, or finished.",
        )


def validate_date(date_value: str):
    try:
        date.fromisoformat(date_value)
    except ValueError:
        raise HTTPException(
            status_code=400,
            detail="Date must be in YYYY-MM-DD format.",
        )


# ============================================================
# BASIC ROUTES
# ============================================================

@app.get("/")
def root():
    return {
        "message": "Pinboard API is running",
        "docs": "/docs",
    }


@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
    }


# ============================================================
# NOTES
# ============================================================

@app.get("/api/notes")
def get_notes(db: Session = Depends(get_db)):
    return (
        db.query(Note)
        .order_by(
            Note.pinned.desc(),
            Note.id.desc()
        )
        .all()
    )


@app.get("/api/notes/{note_id}")
def get_note(
    note_id: int,
    db: Session = Depends(get_db),
):
    note = db.query(Note).filter(Note.id == note_id).first()

    if not note:
        raise HTTPException(
            status_code=404,
            detail="Note not found",
        )

    return note


@app.post("/api/notes", status_code=201)
def create_note(
    note_data: NoteCreate,
    db: Session = Depends(get_db),
):
    note = Note(
        title=note_data.title.strip(),
        content=note_data.content,
        color=note_data.color,
        pinned=note_data.pinned,
    )

    db.add(note)
    db.commit()
    db.refresh(note)

    return note


@app.put("/api/notes/{note_id}")
def update_note(
    note_id: int,
    note_data: NoteUpdate,
    db: Session = Depends(get_db),
):
    note = db.query(Note).filter(Note.id == note_id).first()

    if not note:
        raise HTTPException(
            status_code=404,
            detail="Note not found",
        )

    data = note_data.model_dump(exclude_unset=True)

    for key, value in data.items():
        setattr(note, key, value)

    db.commit()
    db.refresh(note)

    return note


@app.delete("/api/notes/{note_id}")
def delete_note(
    note_id: int,
    db: Session = Depends(get_db),
):
    note = db.query(Note).filter(Note.id == note_id).first()

    if not note:
        raise HTTPException(
            status_code=404,
            detail="Note not found",
        )

    db.delete(note)
    db.commit()

    return {
        "message": "Note deleted successfully"
    }


# ============================================================
# TASKS
# ============================================================

@app.get("/api/tasks")
def get_tasks(db: Session = Depends(get_db)):
    return (
        db.query(Task)
        .order_by(Task.id.desc())
        .all()
    )


@app.get("/api/tasks/{task_id}")
def get_task(
    task_id: int,
    db: Session = Depends(get_db),
):
    task = db.query(Task).filter(Task.id == task_id).first()

    if not task:
        raise HTTPException(
            status_code=404,
            detail="Task not found",
        )

    return task


@app.post("/api/tasks", status_code=201)
def create_task(
    task_data: TaskCreate,
    db: Session = Depends(get_db),
):
    validate_priority(task_data.priority)

    task = Task(
        title=task_data.title.strip(),
        description=task_data.description,
        priority=task_data.priority,
        due_date=task_data.due_date,
        is_done=False,
    )

    db.add(task)
    db.commit()
    db.refresh(task)

    return task


@app.put("/api/tasks/{task_id}")
def update_task(
    task_id: int,
    task_data: TaskUpdate,
    db: Session = Depends(get_db),
):
    task = db.query(Task).filter(Task.id == task_id).first()

    if not task:
        raise HTTPException(
            status_code=404,
            detail="Task not found",
        )

    data = task_data.model_dump(exclude_unset=True)

    if "priority" in data:
        validate_priority(data["priority"])

    for key, value in data.items():
        setattr(task, key, value)

    db.commit()
    db.refresh(task)

    return task


@app.delete("/api/tasks/{task_id}")
def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
):
    task = db.query(Task).filter(Task.id == task_id).first()

    if not task:
        raise HTTPException(
            status_code=404,
            detail="Task not found",
        )

    db.delete(task)
    db.commit()

    return {
        "message": "Task deleted successfully"
    }


# ============================================================
# BOOKS
# ============================================================

@app.get("/api/books")
def get_books(db: Session = Depends(get_db)):
    return (
        db.query(Book)
        .order_by(Book.id.desc())
        .all()
    )


@app.get("/api/books/{book_id}")
def get_book(
    book_id: int,
    db: Session = Depends(get_db),
):
    book = db.query(Book).filter(Book.id == book_id).first()

    if not book:
        raise HTTPException(
            status_code=404,
            detail="Book not found",
        )

    return book


@app.post("/api/books", status_code=201)
def create_book(
    book_data: BookCreate,
    db: Session = Depends(get_db),
):
    validate_book_status(book_data.status)

    book = Book(
        title=book_data.title.strip(),
        author=book_data.author,
        status=book_data.status,
        rating=book_data.rating,
        cover_color=book_data.cover_color,
    )

    db.add(book)
    db.commit()
    db.refresh(book)

    return book


@app.put("/api/books/{book_id}")
def update_book(
    book_id: int,
    book_data: BookUpdate,
    db: Session = Depends(get_db),
):
    book = db.query(Book).filter(Book.id == book_id).first()

    if not book:
        raise HTTPException(
            status_code=404,
            detail="Book not found",
        )

    data = book_data.model_dump(exclude_unset=True)

    if "status" in data:
        validate_book_status(data["status"])

    for key, value in data.items():
        setattr(book, key, value)

    db.commit()
    db.refresh(book)

    return book


@app.delete("/api/books/{book_id}")
def delete_book(
    book_id: int,
    db: Session = Depends(get_db),
):
    book = db.query(Book).filter(Book.id == book_id).first()

    if not book:
        raise HTTPException(
            status_code=404,
            detail="Book not found",
        )

    db.delete(book)
    db.commit()

    return {
        "message": "Book deleted successfully"
    }


# ============================================================
# EVENTS
# ============================================================

@app.get("/api/events")
def get_events(db: Session = Depends(get_db)):
    return (
        db.query(Event)
        .order_by(
            Event.event_date.asc(),
            Event.id.asc()
        )
        .all()
    )


@app.get("/api/events/{event_id}")
def get_event(
    event_id: int,
    db: Session = Depends(get_db),
):
    event = db.query(Event).filter(Event.id == event_id).first()

    if not event:
        raise HTTPException(
            status_code=404,
            detail="Event not found",
        )

    return event


@app.post("/api/events", status_code=201)
def create_event(
    event_data: EventCreate,
    db: Session = Depends(get_db),
):
    validate_date(event_data.event_date)

    event = Event(
        title=event_data.title.strip(),
        description=event_data.description,
        event_date=event_data.event_date,
        event_time=event_data.event_time,
        category=event_data.category,
        is_done=False,
    )

    db.add(event)
    db.commit()
    db.refresh(event)

    return event


@app.put("/api/events/{event_id}")
def update_event(
    event_id: int,
    event_data: EventUpdate,
    db: Session = Depends(get_db),
):
    event = db.query(Event).filter(Event.id == event_id).first()

    if not event:
        raise HTTPException(
            status_code=404,
            detail="Event not found",
        )

    data = event_data.model_dump(exclude_unset=True)

    if "event_date" in data:
        validate_date(data["event_date"])

    for key, value in data.items():
        setattr(event, key, value)

    db.commit()
    db.refresh(event)

    return event


@app.delete("/api/events/{event_id}")
def delete_event(
    event_id: int,
    db: Session = Depends(get_db),
):
    event = db.query(Event).filter(Event.id == event_id).first()

    if not event:
        raise HTTPException(
            status_code=404,
            detail="Event not found",
        )

    db.delete(event)
    db.commit()

    return {
        "message": "Event deleted successfully"
    }
