import httpx

from modules.notifications.application.ports import NotificationSender
from shared.config import settings
from shared.logging import get_logger

logger = get_logger(__name__)


class WhatsAppNotificationSender(NotificationSender):
    """Envia via WhatsApp Cloud API (Meta), o canal nativo priorizado na revisão
    estratégica para o público brasileiro (ver docs/08-revisao-estrategica-latam.md).
    Sem credenciais configuradas, registra e retorna False — não derruba o processo,
    só não entrega por este canal (o e-mail continua funcionando normalmente).

    A criação/gestão de alertas por bot de menu estruturado no WhatsApp (canal de
    entrada, não só de saída) é a extensão natural deste adapter e ainda não foi
    implementada nesta fase — ver TODO em `docs/02-mvp-roadmap.md`.
    """

    def send(self, *, destination: str, subject: str, message: str) -> bool:
        if not settings.whatsapp_cloud_api_token or not settings.whatsapp_phone_number_id:
            logger.warning("whatsapp_not_configured", destination=destination)
            return False

        url = f"{settings.whatsapp_api_base_url}/{settings.whatsapp_phone_number_id}/messages"
        payload = {
            "messaging_product": "whatsapp",
            "to": destination,
            "type": "text",
            "text": {"body": f"*{subject}*\n\n{message}"},
        }
        headers = {"Authorization": f"Bearer {settings.whatsapp_cloud_api_token}"}

        try:
            response = httpx.post(url, json=payload, headers=headers, timeout=10)
            response.raise_for_status()
            logger.info("whatsapp_sent", destination=destination)
            return True
        except httpx.HTTPError:
            logger.exception("whatsapp_send_failed", destination=destination)
            return False
