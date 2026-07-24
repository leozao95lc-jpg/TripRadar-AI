import smtplib
from email.mime.text import MIMEText

from modules.notifications.application.ports import NotificationSender
from shared.config import settings
from shared.logging import get_logger

logger = get_logger(__name__)


class EmailNotificationSender(NotificationSender):
    """Envia via SMTP — em dev aponta para o Mailhog do docker-compose; em produção,
    para o endpoint SMTP do Amazon SES."""

    def send(self, *, destination: str, subject: str, message: str) -> bool:
        email = MIMEText(message, "plain", "utf-8")
        email["Subject"] = subject
        email["From"] = settings.smtp_from_email
        email["To"] = destination

        try:
            with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as smtp:
                if settings.smtp_use_tls:
                    smtp.starttls()
                if settings.smtp_username and settings.smtp_password:
                    smtp.login(settings.smtp_username, settings.smtp_password)
                smtp.sendmail(settings.smtp_from_email, [destination], email.as_string())
            logger.info("email_sent", destination=destination, subject=subject)
            return True
        except OSError:
            logger.exception("email_send_failed", destination=destination)
            return False
