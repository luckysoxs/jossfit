from datetime import datetime

from sqlalchemy import Integer, ForeignKey, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class PartnerClick(Base):
    __tablename__ = "partner_clicks"

    id: Mapped[int] = mapped_column(primary_key=True)
    partner_brand_id: Mapped[int] = mapped_column(ForeignKey("partner_brands.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    clicked_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    partner_brand = relationship("PartnerBrand")
    user = relationship("User")
