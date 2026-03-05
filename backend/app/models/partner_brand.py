from sqlalchemy import String, Boolean, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class PartnerBrand(Base):
    __tablename__ = "partner_brands"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(100))
    logo_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    discount_text: Mapped[str | None] = mapped_column(String(200), nullable=True)
    promo_code: Mapped[str | None] = mapped_column(String(50), nullable=True)
    external_url: Mapped[str] = mapped_column(String(500))
    category: Mapped[str] = mapped_column(String(50))
    active: Mapped[bool] = mapped_column(Boolean, default=True)
