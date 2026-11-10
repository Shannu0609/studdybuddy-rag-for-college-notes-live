import logging
import os
import tempfile
from pathlib import Path
from types import SimpleNamespace

import pymupdf
import pytest
from fastapi.testclient import TestClient


@pytest.fixture(scope="module")
def test_client():
    with tempfile.TemporaryDirectory(ignore_cleanup_errors=True) as tmpdir:
        tmp_path = Path(tmpdir)
        os.environ["DATABASE_URL"] = f"sqlite:///{(tmp_path / 'test.db').as_posix()}"
        os.environ["UPLOAD_DIR"] = str(tmp_path / "uploads")
        os.environ["CHROMA_PERSIST_DIR"] = str(tmp_path / "chroma")
        os.environ["JWT_SECRET_KEY"] = "test-secret-key-for-pytest-only-12345"
        os.environ["GEMINI_API_KEY"] = ""

        from app.config import get_settings

        get_settings.cache_clear()

        from app.database.session import engine
        from main import create_app

        app = create_app()
        with TestClient(app) as client:
            yield client
        engine.dispose()


def _create_sample_pdf(pages_text: list[str]) -> bytes:
    doc = pymupdf.open()
    for text in pages_text:
        page = doc.new_page()
        if text:
            page.insert_text((72, 72), text, fontsize=11)
    pdf_bytes = doc.tobytes()
    doc.close()
    return pdf_bytes


def test_full_rag_workflow_and_user_isolation(test_client, monkeypatch, caplog):
    # 1. Health check
    res = test_client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "ok"

    # 2. Register Alice & Bob
    reg_a = test_client.post(
        "/auth/register",
        json={
            "full_name": "Alice Student",
            "email": "alice@college.edu",
            "password": "Password123!",
            "confirm_password": "Password123!",
        },
    )
    assert reg_a.status_code == 201
    token_a = reg_a.json()["access_token"]
    headers_a = {"Authorization": f"Bearer {token_a}"}

    # Duplicate registration blocked
    dup = test_client.post(
        "/auth/register",
        json={
            "full_name": "Alice Duplicate",
            "email": "alice@college.edu",
            "password": "Password123!",
            "confirm_password": "Password123!",
        },
    )
    assert dup.status_code == 409

    # Login Alice
    login_a = test_client.post(
        "/auth/login",
        json={"email": "alice@college.edu", "password": "Password123!"},
    )
    assert login_a.status_code == 200
    assert test_client.get("/auth/me", headers=headers_a).json()["email"] == "alice@college.edu"

    # Register Bob
    reg_b = test_client.post(
        "/auth/register",
        json={
            "full_name": "Bob Student",
            "email": "bob@college.edu",
            "password": "Password123!",
            "confirm_password": "Password123!",
        },
    )
    assert reg_b.status_code == 201
    headers_b = {"Authorization": f"Bearer {reg_b.json()['access_token']}"}

    # 3. Validate PDF rejection cases
    bad_ext = test_client.post(
        "/documents/upload",
        headers=headers_a,
        files={"file": ("notes.txt", b"hello world", "text/plain")},
    )
    assert bad_ext.status_code == 400

    bad_sig = test_client.post(
        "/documents/upload",
        headers=headers_a,
        files={"file": ("fake.pdf", b"not actually a pdf", "application/pdf")},
    )
    assert bad_sig.status_code == 400

    corrupted_pdf = test_client.post(
        "/documents/upload",
        headers=headers_a,
        files={"file": ("corrupt.pdf", b"%PDF-1.4\ncorrupted-binary-stream", "application/pdf")},
    )
    assert corrupted_pdf.status_code == 422

    blank_pdf = _create_sample_pdf([""])
    empty_text_pdf = test_client.post(
        "/documents/upload",
        headers=headers_a,
        files={"file": ("blank.pdf", blank_pdf, "application/pdf")},
    )
    assert empty_text_pdf.status_code == 422

    # 4. Upload two valid PDFs to verify multi-document & scoped selection
    ml_pdf = _create_sample_pdf(
        [
            (
                "Lecture 1: The Perceptron Algorithm.\n"
                "A perceptron is a linear binary classifier invented by Frank Rosenblatt. "
                "It computes a weighted sum of input features plus a bias term and applies a step activation function. "
                "During training, weights are updated whenever the predicted label differs from the true label."
            ),
            (
                "Lecture 2: Deep Learning and Backpropagation.\n"
                "Deep learning stacks multiple nonlinear hidden layers to learn hierarchical representations. "
                "Backpropagation computes gradients of the loss with respect to network weights using the chain rule."
            ),
        ]
    )
    up1 = test_client.post(
        "/documents/upload",
        headers=headers_a,
        files={"file": ("ml_notes.pdf", ml_pdf, "application/pdf")},
    )
    assert up1.status_code == 201
    doc1 = up1.json()
    assert doc1["status"] == "processed"
    assert doc1["page_count"] == 2
    assert doc1["chunk_count"] >= 2
    doc1_id = doc1["id"]

    os_pdf = _create_sample_pdf(
        [
            (
                "Operating Systems Lecture 4: Virtual Memory and Paging.\n"
                "Paging divides virtual address space into fixed-size pages mapped to physical frames via a page table. "
                "The Translation Lookaside Buffer (TLB) caches recent virtual-to-physical page translations."
            )
        ]
    )
    up2 = test_client.post(
        "/documents/upload",
        headers=headers_a,
        files={"file": ("os_notes.pdf", os_pdf, "application/pdf")},
    )
    assert up2.status_code == 201
    doc2_id = up2.json()["id"]

    # 5. Verify strict user isolation (Bob cannot list, read, query, or delete Alice's doc)
    assert test_client.get("/documents", headers=headers_b).json() == []
    assert test_client.get(f"/documents/{doc1_id}", headers=headers_b).status_code == 404
    assert test_client.delete(f"/documents/{doc1_id}", headers=headers_b).status_code == 404
    bob_ask = test_client.post(
        "/chat/ask",
        headers=headers_b,
        json={"question": "Explain the perceptron algorithm.", "document_ids": [doc1_id]},
    )
    assert bob_ask.status_code == 404

    # 6. Verify out-of-scope query returns grounded insufficient-context reply without calling LLM
    oos = test_client.post(
        "/chat/ask",
        headers=headers_a,
        json={"question": "What is the recipe for chocolate soufflé?", "document_ids": [doc1_id]},
    )
    assert oos.status_code == 200
    assert "do not contain sufficient information" in oos.json()["assistant_message"]["content"].lower()
    assert oos.json()["assistant_message"]["sources"] == []

    # 7. Verify missing GEMINI_API_KEY raises 503 for in-scope query (never fakes AI answer)
    no_key = test_client.post(
        "/chat/ask",
        headers=headers_a,
        json={"question": "Explain the perceptron algorithm.", "document_ids": [doc1_id]},
    )
    assert no_key.status_code == 503

    # 8. Test full GeminiLLMService client invocation + RAG retrieval with a mock genai.Client
    captured = {}

    class FakeModels:
        def generate_content(self, *, model, contents, config):
            captured["model"] = model
            captured["contents"] = contents
            captured["system_instruction"] = config.system_instruction
            return SimpleNamespace(
                text=(
                    "The perceptron is a linear binary classifier that computes a weighted sum "
                    "plus a bias term and updates weights on misclassification [ml_notes.pdf, p. 1]."
                )
            )

    class FakeGenaiClient:
        def __init__(self, api_key, **_kwargs):
            captured["api_key"] = api_key
            self.models = FakeModels()

    from app.config import get_settings
    from app.rag import llm_service

    monkeypatch.setenv("GEMINI_API_KEY", "unit-test-gemini-key")
    get_settings.cache_clear()
    monkeypatch.setattr(llm_service.genai, "Client", FakeGenaiClient)

    ask_res = test_client.post(
        "/chat/ask",
        headers=headers_a,
        json={"question": "Explain the perceptron algorithm.", "document_ids": [doc1_id]},
    )
    assert ask_res.status_code == 200
    ask_json = ask_res.json()
    conv_id = ask_json["conversation_id"]
    assert captured["api_key"] == "unit-test-gemini-key"
    assert "ml_notes.pdf" in captured["contents"]
    assert "Page: 1" in captured["contents"]
    assert "STRICTLY" in captured["system_instruction"] or "ONLY" in captured["system_instruction"]
    assert len(ask_json["assistant_message"]["sources"]) >= 1
    assert ask_json["assistant_message"]["sources"][0]["document_name"] == "ml_notes.pdf"

    # Follow-up overview question across both selected PDFs
    summary_res = test_client.post(
        "/chat/ask",
        headers=headers_a,
        json={
            "question": "Summarize this chapter and give important exam questions.",
            "conversation_id": conv_id,
            "document_ids": [doc1_id, doc2_id],
        },
    )
    assert summary_res.status_code == 200
    assert "TLB" in captured["contents"] or "Perceptron" in captured["contents"]

    # Reset cached settings after test
    monkeypatch.setenv("GEMINI_API_KEY", "")
    get_settings.cache_clear()

    # 9. Verify dashboard stats, chat history, search, clear, and deletion
    stats = test_client.get("/dashboard/stats", headers=headers_a).json()
    assert stats["processed_documents"] == 2
    assert stats["total_questions_asked"] >= 3
    assert stats["total_conversations"] >= 2

    hist = test_client.get("/chat/history", headers=headers_a, params={"search": "perceptron"}).json()
    assert any(c["id"] == conv_id for c in hist)

    detail = test_client.get(f"/chat/{conv_id}", headers=headers_a).json()
    assert len(detail["messages"]) == 4

    clr = test_client.post(f"/chat/{conv_id}/clear", headers=headers_a)
    assert clr.status_code == 200
    assert test_client.get(f"/chat/{conv_id}", headers=headers_a).json()["messages"] == []

    del_conv = test_client.delete(f"/chat/{conv_id}", headers=headers_a)
    assert del_conv.status_code == 200
    assert test_client.get(f"/chat/{conv_id}", headers=headers_a).status_code == 404

    del_doc1 = test_client.delete(f"/documents/{doc1_id}", headers=headers_a)
    assert del_doc1.status_code == 200
    assert test_client.get(f"/documents/{doc1_id}", headers=headers_a).status_code == 404

    # 10. Profile update, password change, and forgot/reset password flow
    prof = test_client.patch(
        "/auth/profile",
        headers=headers_a,
        json={"full_name": "Alice Updated", "theme_preference": "light"},
    )
    assert prof.status_code == 200
    assert prof.json()["full_name"] == "Alice Updated"
    assert prof.json()["theme_preference"] == "light"

    with caplog.at_level(logging.WARNING, logger="app.services.auth_service"):
        fp = test_client.post("/auth/forgot-password", json={"email": "bob@college.edu"})
        assert fp.status_code == 200
        token_line = [
            rec.message
            for rec in caplog.records
            if "Password reset token for bob@college.edu:" in rec.message
        ]
        assert len(token_line) == 1
        raw_token = token_line[0].split("Password reset token for bob@college.edu: ")[1].split(
            " (URL:"
        )[0]

    rp = test_client.post(
        "/auth/reset-password",
        json={
            "token": raw_token,
            "new_password": "NewPassword999!",
            "confirm_password": "NewPassword999!",
        },
    )
    assert rp.status_code == 200

    assert (
        test_client.post(
            "/auth/login", json={"email": "bob@college.edu", "password": "Password123!"}
        ).status_code
        == 401
    )
    assert (
        test_client.post(
            "/auth/login", json={"email": "bob@college.edu", "password": "NewPassword999!"}
        ).status_code
        == 200
    )

    # 11. Account deletion removes user and rejects subsequent login
    del_acc = test_client.request(
        "DELETE",
        "/auth/account",
        headers=headers_b,
        json={"password": "NewPassword999!"},
    )
    assert del_acc.status_code == 200
    assert (
        test_client.post(
            "/auth/login", json={"email": "bob@college.edu", "password": "NewPassword999!"}
        ).status_code
        == 401
    )
