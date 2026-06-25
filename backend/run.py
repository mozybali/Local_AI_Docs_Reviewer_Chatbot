"""Geliştirme sunucusunu başlatma betiği.

Alternatif olarak doğrudan şu komut da kullanılabilir:
    uvicorn app.main:app --reload
"""

import uvicorn

if __name__ == "__main__":
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
