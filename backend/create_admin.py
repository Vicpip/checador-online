"""
Bootstrap the first admin user.

There is no signup endpoint by design (admins create every account via
POST /admin/usuarios). To create the very first admin, run this once after
migrations:

    python create_admin.py --nombre "Jane Doe" --email jane@company.com --password "change-me"
"""
import argparse

from database import SessionLocal
from models import Usuario
from utils.security import hash_password


def main():
    parser = argparse.ArgumentParser(description="Create the first admin user")
    parser.add_argument("--nombre", required=True)
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", required=True)
    args = parser.parse_args()

    db = SessionLocal()
    try:
        existente = db.query(Usuario).filter(Usuario.email == args.email).first()
        if existente:
            print(f"A user with email {args.email} already exists.")
            return
        usuario = Usuario(
            nombre=args.nombre,
            email=args.email,
            password_hash=hash_password(args.password),
            rol="admin",
        )
        db.add(usuario)
        db.commit()
        print(f"Admin user created: {args.email}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
