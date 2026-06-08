package com.jarmak.stockmarketanalyzer.feedback;

import com.jarmak.stockmarketanalyzer.config.AppProperties;
import com.jarmak.stockmarketanalyzer.database.DatabaseService;
import com.jarmak.stockmarketanalyzer.notification.TelegramNotificationService;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Optional;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class FeedbackService {
  public static final int MAX_FEEDBACK_LENGTH = 512;

  private static final DateTimeFormatter TELEGRAM_TIME_FORMATTER = DateTimeFormatter
      .ofPattern("yyyy-MM-dd HH:mm:ss z")
      .withZone(ZoneId.systemDefault());

  private final DatabaseService databaseService;
  private final TelegramNotificationService telegramNotificationService;
  private final AppProperties properties;

  public FeedbackService(
      DatabaseService databaseService,
      TelegramNotificationService telegramNotificationService,
      AppProperties properties
  ) {
    this.databaseService = databaseService;
    this.telegramNotificationService = telegramNotificationService;
    this.properties = properties;
  }

  public FeedbackSubmission submit(String message) {
    String username = currentUsername();
    String normalizedMessage = normalizeMessage(message);

    try (Connection connection = databaseService.connection()) {
      long feedbackId = saveFeedback(connection, username, normalizedMessage);
      boolean telegramSent = sendTelegramNotification(username, normalizedMessage);
      if (telegramSent) {
        markTelegramSent(connection, feedbackId);
      }
      return new FeedbackSubmission(
          feedbackId,
          telegramSent,
          telegramSent ? "Feedback sent. Thank you." : "Feedback saved. Owner Telegram chat is not configured yet."
      );
    } catch (SQLException exception) {
      throw new FeedbackUnavailableException("Could not save feedback.", exception);
    }
  }

  private long saveFeedback(Connection connection, String username, String message) throws SQLException {
    try (PreparedStatement statement = connection.prepareStatement("""
        insert into feedback_messages (username, message)
        values (?, ?)
        """, Statement.RETURN_GENERATED_KEYS)) {
      statement.setString(1, username);
      statement.setString(2, message);
      statement.executeUpdate();
      try (ResultSet keys = statement.getGeneratedKeys()) {
        if (keys.next()) {
          return keys.getLong(1);
        }
      }
    }
    throw new FeedbackUnavailableException("Could not save feedback.");
  }

  private boolean sendTelegramNotification(String username, String message) {
    Optional<String> chatId = feedbackRecipientChatId();
    if (chatId.isEmpty()) {
      return false;
    }

    String telegramMessage = """
        <b>OpenFIRE feedback</b>
        <b>From:</b> %s
        <b>Received:</b> %s

        %s
        """.formatted(
        escapeHtml(username),
        escapeHtml(TELEGRAM_TIME_FORMATTER.format(Instant.now())),
        escapeHtml(message)
    );
    return telegramNotificationService.sendToChat(chatId.get(), telegramMessage).sent();
  }

  private Optional<String> feedbackRecipientChatId() {
    AppProperties.Telegram telegram = properties.telegram();
    if (telegram == null || !StringUtils.hasText(telegram.ownerChatId())) {
      return Optional.empty();
    }
    return Optional.of(telegram.ownerChatId().trim());
  }

  private void markTelegramSent(Connection connection, long feedbackId) throws SQLException {
    try (PreparedStatement statement = connection.prepareStatement("""
        update feedback_messages
        set telegram_sent = true
        where id = ?
        """)) {
      statement.setLong(1, feedbackId);
      statement.executeUpdate();
    }
  }

  private String normalizeMessage(String message) {
    String normalized = message == null ? "" : message.trim();
    if (!StringUtils.hasText(normalized)) {
      throw new IllegalArgumentException("Feedback message is required.");
    }
    if (normalized.length() > MAX_FEEDBACK_LENGTH) {
      throw new IllegalArgumentException("Feedback message must be 512 characters or less.");
    }
    return normalized;
  }

  private String currentUsername() {
    Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
    if (authentication == null || !StringUtils.hasText(authentication.getName())) {
      throw new IllegalStateException("Authenticated user is required.");
    }
    return authentication.getName();
  }

  private String escapeHtml(String text) {
    return text == null ? "" : text
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;");
  }

  public record FeedbackSubmission(long id, boolean telegramSent, String message) {
  }

  public static class FeedbackUnavailableException extends RuntimeException {
    public FeedbackUnavailableException(String message) {
      super(message);
    }

    public FeedbackUnavailableException(String message, Throwable cause) {
      super(message, cause);
    }
  }
}
