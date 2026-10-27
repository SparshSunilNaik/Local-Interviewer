"""Initial local data schema."""

from alembic import op
from app.db.base import Base

revision = "0001_initial"
down_revision = None


def upgrade():
    bind = op.get_bind()
    Base.metadata.create_all(bind=bind)


def downgrade():
    bind = op.get_bind()
    Base.metadata.drop_all(bind=bind)
