"""Başlangıçta yarıda kalmış doküman kurtarma testleri.

İşleme kuyruğu süreç içi (`BackgroundTasks`) olduğundan, sunucu yeniden
başladığında `uploaded`/`processing` durumundaki dokümanların görevi bir daha
çalışmaz. `recover_stale_documents` bu kayıtları `error` durumuna alır ki
kullanıcı arayüzde sonsuza dek "İşleniyor" görmesin (bkz. `app.main.lifespan`).
"""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models.document import Document
from app.models.user import User
from app.services.document_service import recover_stale_documents


@pytest.fixture()
def session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )
    Base.metadata.create_all(engine)
    TestingSession = sessionmaker(bind=engine, future=True)
    db = TestingSession()

    db.add(User(id=1, email="u1@x.com", hashed_password="x", role="user"))
    for doc_id, doc_status in (
        (1, "uploaded"),
        (2, "processing"),
        (3, "ready"),
        (4, "error"),
    ):
        db.add(Document(
            id=doc_id, user_id=1, filename=f"f{doc_id}",
            original_filename=f"f{doc_id}.pdf", file_type="pdf",
            file_path=f"/uploads/f{doc_id}.pdf", status=doc_status,
        ))
    db.commit()

    yield db
    db.close()


def test_stale_documents_are_marked_error(session):
    count = recover_stale_documents(session)
    assert count == 2

    statuses = {d.id: d.status for d in session.query(Document).all()}
    assert statuses[1] == "error"  # uploaded -> error
    assert statuses[2] == "error"  # processing -> error
    assert statuses[3] == "ready"  # dokunulmaz
    assert statuses[4] == "error"  # zaten error

    # Kurtarılan kayıtlara kullanıcıya gösterilebilir bir mesaj yazılır.
    recovered = session.get(Document, 2)
    assert recovered.error_msg
    assert "yeniden" in recovered.error_msg


def test_recovery_is_idempotent(session):
    assert recover_stale_documents(session) == 2
    assert recover_stale_documents(session) == 0
