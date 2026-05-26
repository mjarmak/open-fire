package com.jarmak.stockmarketanalyzer.notification;

import com.jarmak.stockmarketanalyzer.config.AppProperties;
import com.jarmak.stockmarketanalyzer.security.UserAccountService;
import java.util.Optional;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

@Service
public class TelegramNotificationService {
  private static final Logger LOGGER = LoggerFactory.getLogger(TelegramNotificationService.class);

  private final AppProperties properties;
  private final UserAccountService userAccountService;
  private final RestClient restClient;

  public TelegramNotificationService(AppProperties properties, UserAccountService userAccountService, RestClient restClient) {
    this.properties = properties;
    this.userAccountService = userAccountService;
    this.restClient = restClient;
  }

  public boolean configured() {
    AppProperties.Telegram telegram = properties.telegram();
    return telegram != null
        && telegram.enabled()
        && StringUtils.hasText(telegram.botToken())
        && userAccountService.currentTelegramChatId().isPresent();
  }

  public NotificationResult send(String message) {
    AppProperties.Telegram telegram = properties.telegram();
    if (telegram == null || !telegram.enabled() || !StringUtils.hasText(telegram.botToken())) {
      return new NotificationResult(false, "Telegram is disabled or missing bot token.", false);
    }

    Optional<String> chatId = userAccountService.currentTelegramChatId();
    if (chatId.isEmpty()) {
      return new NotificationResult(false, "Add your Telegram chat ID before sending messages.", true);
    }
    return sendToChat(chatId.get(), message);
  }

  public NotificationResult sendToChat(String chatId, String message) {
    AppProperties.Telegram telegram = properties.telegram();
    if (telegram == null || !telegram.enabled() || !StringUtils.hasText(telegram.botToken())) {
      return new NotificationResult(false, "Telegram is disabled or missing bot token.", false);
    }
    if (!StringUtils.hasText(chatId)) {
      return new NotificationResult(false, "Add your Telegram chat ID before sending messages.", true);
    }

    MultiValueMap<String, String> body = new LinkedMultiValueMap<>();
    body.add("chat_id", chatId);
    body.add("text", message);
    body.add("parse_mode", "HTML");

    try {
      restClient.post()
          .uri("https://api.telegram.org/bot" + telegram.botToken() + "/sendMessage")
          .contentType(MediaType.APPLICATION_FORM_URLENCODED)
          .body(body)
          .retrieve()
          .toBodilessEntity();
      return new NotificationResult(true, "Telegram message sent.", false);
    } catch (org.springframework.web.client.RestClientResponseException exception) {
      LOGGER.error("Telegram send failed with status {} and response: {}", exception.getStatusCode(), exception.getResponseBodyAsString());
      String responseBody = exception.getResponseBodyAsString();
      String cleanMessage = "Telegram send failed: " + exception.getStatusText();
      if (responseBody != null) {
        if (responseBody.contains("chat not found")) {
          cleanMessage = "Telegram chat ID not found. Make sure you have started a chat with the bot (@" + telegram.botUsername() + ") first, and that your numeric chat ID is correct.";
        } else if (responseBody.contains("bot was blocked by the user")) {
          cleanMessage = "Telegram send failed: The bot was blocked. Please unblock the bot on Telegram.";
        }
      }
      return new NotificationResult(false, cleanMessage, false);
    } catch (RuntimeException exception) {
      LOGGER.error("Telegram send failed: {}", exception.getMessage(), exception);
      return new NotificationResult(false, "Telegram send failed. Check bot token, chat ID, and bot permissions.", false);
    }
  }

  public String providerName() {
    AppProperties.Telegram telegram = properties.telegram();
    if (telegram != null && StringUtils.hasText(telegram.botUsername())) {
      return "Telegram @" + telegram.botUsername();
    }
    return "Telegram";
  }

  public record NotificationResult(boolean sent, String message, boolean missingChatId) {
  }
}
