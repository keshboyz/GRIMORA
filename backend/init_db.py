
from database import Base, engine

# Import all SQLAlchemy models so their tables are registered.
import models


def initialize_database():
    print("Checking GRIMORA database tables...")

    Base.metadata.create_all(bind=engine, checkfirst=True)

    print("Database table initialization completed.")
    print("Registered tables:")

    for table_name in sorted(Base.metadata.tables.keys()):
        print(f" - {table_name}")


if __name__ == "__main__":
    initialize_database()
