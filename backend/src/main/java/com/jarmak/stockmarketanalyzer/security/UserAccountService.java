package com.jarmak.stockmarketanalyzer.security;

import com.jarmak.stockmarketanalyzer.database.DatabaseService;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class UserAccountService {
  private static final String UNIQUE_VIOLATION = "23505";
  public static final List<String> DEFAULT_TELEGRAM_ALERT_DAYS = List.of("MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN");
  public static final List<String> DEFAULT_TELEGRAM_DCA_DAYS = List.of("WED", "FRI");

  private final DatabaseService databaseService;
  private final PasswordEncoder passwordEncoder;

  public UserAccountService(DatabaseService databaseService, PasswordEncoder passwordEncoder) {
    this.databaseService = databaseService;
    this.passwordEncoder = passwordEncoder;
  }

  public UserAccount createUser(String username, String password) {
    String normalizedUsername = username.trim();
    try (Connection connection = databaseService.connection()) {
      try (PreparedStatement statement = connection.prepareStatement("""
          insert into users (username, password_hash, enabled, updated_at)
          values (?, ?, true, now())
          """)) {
        statement.setString(1, normalizedUsername);
        statement.setString(2, passwordEncoder.encode(password));
        statement.executeUpdate();
        return new UserAccount(normalizedUsername);
      }
    } catch (SQLException exception) {
      if (UNIQUE_VIOLATION.equals(exception.getSQLState())) {
        throw new DuplicateUsernameException("Username already exists.", exception);
      }
      throw new UserRegistrationUnavailableException("Could not create user.", exception);
    }
  }

  public Optional<String> currentTelegramChatId() {
    try (
        Connection connection = databaseService.connection();
        PreparedStatement statement = connection.prepareStatement("select telegram_chat_id from users where lower(username) = lower(?)")
    ) {
      statement.setString(1, currentUsername());
      try (ResultSet results = statement.executeQuery()) {
        if (!results.next()) {
          return Optional.empty();
        }
        String chatId = results.getString("telegram_chat_id");
        return StringUtils.hasText(chatId) ? Optional.of(chatId) : Optional.empty();
      }
    } catch (SQLException exception) {
      throw new UserRegistrationUnavailableException("Could not load Telegram chat ID.", exception);
    }
  }

  public UserTelegramSettings currentTelegramSettings() {
    try (
        Connection connection = databaseService.connection();
        PreparedStatement statement = connection.prepareStatement("select telegram_chat_id, telegram_alert_days from users where lower(username) = lower(?)")
    ) {
      statement.setString(1, currentUsername());
      try (ResultSet results = statement.executeQuery()) {
        if (!results.next()) {
          return new UserTelegramSettings("", DEFAULT_TELEGRAM_ALERT_DAYS);
        }
        String chatId = results.getString("telegram_chat_id");
        return new UserTelegramSettings(
            StringUtils.hasText(chatId) ? chatId : "",
            daysFromCsv(results.getString("telegram_alert_days"), DEFAULT_TELEGRAM_ALERT_DAYS)
        );
      }
    } catch (SQLException exception) {
      throw new UserRegistrationUnavailableException("Could not load Telegram settings.", exception);
    }
  }

  public UserTelegramSettings updateCurrentTelegramChatId(String chatId) {
    return updateCurrentTelegramSettings(chatId, DEFAULT_TELEGRAM_ALERT_DAYS);
  }

  public UserTelegramSettings updateCurrentTelegramSettings(String chatId, List<String> alertDays) {
    String normalizedChatId = chatId == null ? "" : chatId.trim();
    if (!StringUtils.hasText(normalizedChatId)) {
      throw new IllegalArgumentException("Telegram chat ID is required.");
    }
    String normalizedAlertDays = normalizeDays(alertDays, DEFAULT_TELEGRAM_ALERT_DAYS);

    try (
        Connection connection = databaseService.connection();
        PreparedStatement statement = connection.prepareStatement("""
            update users
            set telegram_chat_id = ?, telegram_alert_days = ?, updated_at = now()
            where lower(username) = lower(?)
            """)
    ) {
      statement.setString(1, normalizedChatId);
      statement.setString(2, normalizedAlertDays);
      statement.setString(3, currentUsername());
      if (statement.executeUpdate() == 0) {
        throw new UserRegistrationUnavailableException("Authenticated user was not found.");
      }
      return new UserTelegramSettings(normalizedChatId, daysFromCsv(normalizedAlertDays, DEFAULT_TELEGRAM_ALERT_DAYS));
    } catch (SQLException exception) {
      throw new UserRegistrationUnavailableException("Could not save Telegram settings.", exception);
    }
  }

  public Map<String, UserTelegramSchedule> allUserTelegramSettings() {
    Map<String, UserTelegramSchedule> settings = new java.util.HashMap<>();
    try (
        Connection connection = databaseService.connection();
        PreparedStatement statement = connection.prepareStatement("select username, telegram_chat_id, telegram_alert_days from users where telegram_chat_id is not null and telegram_chat_id <> ''")
    ) {
      try (ResultSet results = statement.executeQuery()) {
        while (results.next()) {
          settings.put(results.getString("username"), new UserTelegramSchedule(
              results.getString("telegram_chat_id"),
              daysFromCsv(results.getString("telegram_alert_days"), DEFAULT_TELEGRAM_ALERT_DAYS)
          ));
        }
      }
    } catch (SQLException exception) {
      throw new UserRegistrationUnavailableException("Could not load Telegram settings for all users.", exception);
    }
    return settings;
  }

  public Map<String, UserTelegramSchedule> allUserTelegramSettingsForDcaEnabled() {
    Map<String, UserTelegramSchedule> settings = new java.util.HashMap<>();
    try (
        Connection connection = databaseService.connection();
        PreparedStatement statement = connection.prepareStatement("""
            select username, telegram_chat_id, telegram_dca_days
            from users
            where telegram_chat_id is not null
              and telegram_chat_id <> ''
              and coalesce(telegram_dca_enabled, false) = true
            """)
    ) {
      try (ResultSet results = statement.executeQuery()) {
        while (results.next()) {
          settings.put(results.getString("username"), new UserTelegramSchedule(
              results.getString("telegram_chat_id"),
              daysFromCsv(results.getString("telegram_dca_days"), DEFAULT_TELEGRAM_DCA_DAYS)
          ));
        }
      }
    } catch (SQLException exception) {
      throw new UserRegistrationUnavailableException("Could not load Telegram DCA settings for all users.", exception);
    }
    return settings;
  }

  private String currentUsername() {
    Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
    if (authentication == null || !StringUtils.hasText(authentication.getName())) {
      throw new IllegalStateException("Authenticated user is required.");
    }
    return authentication.getName();
  }

  public record UserAccount(String username) {
  }

  public UserRetirementSettings getRetirementSettings() {
    return getRetirementSettingsForUser(currentUsername());
  }

  public UserRetirementSettings getRetirementSettingsForUser(String username) {
    try (
        Connection connection = databaseService.connection();
        PreparedStatement statement = connection.prepareStatement("select investing_start_date, desired_monthly_income, custom_return_rate, monthly_savings, other_savings, yearly_inflation_rate, safe_withdrawal_rate from users where lower(username) = lower(?)")
    ) {
      statement.setString(1, username);
      try (ResultSet results = statement.executeQuery()) {
        if (results.next()) {
          return new UserRetirementSettings(
              results.getString("investing_start_date"),
              results.getBigDecimal("desired_monthly_income"),
              results.getBigDecimal("custom_return_rate"),
              results.getBigDecimal("monthly_savings"),
              results.getBigDecimal("other_savings"),
              results.getBigDecimal("yearly_inflation_rate"),
              results.getBigDecimal("safe_withdrawal_rate")
          );
        }
        return new UserRetirementSettings(null, null, null, null, null, null, null);
      }
    } catch (SQLException exception) {
      throw new UserRegistrationUnavailableException("Could not load retirement settings.", exception);
    }
  }

  public UserRetirementSettings updateRetirementSettings(UserRetirementSettings settings) {
    try (
        Connection connection = databaseService.connection();
        PreparedStatement statement = connection.prepareStatement("""
            update users
            set investing_start_date = ?, desired_monthly_income = ?, custom_return_rate = ?, monthly_savings = ?, other_savings = ?, yearly_inflation_rate = ?, safe_withdrawal_rate = ?, updated_at = now()
            where lower(username) = lower(?)
            """)
    ) {
      statement.setString(1, settings.investingStartDate());
      statement.setBigDecimal(2, settings.desiredMonthlyIncome());
      statement.setBigDecimal(3, settings.customReturnRate());
      statement.setBigDecimal(4, settings.monthlySavings());
      statement.setBigDecimal(5, settings.otherSavings());
      statement.setBigDecimal(6, settings.yearlyInflationRate());
      statement.setBigDecimal(7, settings.safeWithdrawalRate());
      statement.setString(8, currentUsername());
      if (statement.executeUpdate() == 0) {
        throw new UserRegistrationUnavailableException("Authenticated user was not found.");
      }
      return settings;
    } catch (SQLException exception) {
      throw new UserRegistrationUnavailableException("Could not save retirement settings.", exception);
    }
  }

  public UserDcaSettings currentDcaSettings() {
    return getDcaSettingsForUser(currentUsername());
  }

  public UserDcaSettings getDcaSettingsForUser(String username) {
    try (
        Connection connection = databaseService.connection();
        PreparedStatement statement = connection.prepareStatement("""
            select telegram_dca_enabled, dca_reminder_note, telegram_dca_days
            from users
            where lower(username) = lower(?)
            """)
    ) {
      statement.setString(1, username);
      try (ResultSet results = statement.executeQuery()) {
        if (results.next()) {
          return new UserDcaSettings(
              results.getBoolean("telegram_dca_enabled"),
              results.getString("dca_reminder_note"),
              daysFromCsv(results.getString("telegram_dca_days"), DEFAULT_TELEGRAM_DCA_DAYS)
          );
        }
        return new UserDcaSettings(false, "", DEFAULT_TELEGRAM_DCA_DAYS);
      }
    } catch (SQLException exception) {
      throw new UserRegistrationUnavailableException("Could not load DCA reminder settings.", exception);
    }
  }

  public UserDcaSettings updateCurrentDcaSettings(UserDcaSettings settings) {
    String normalizedNote = settings.reminderNote() == null ? "" : settings.reminderNote().trim();
    String normalizedDays = normalizeDays(settings.reminderDays(), DEFAULT_TELEGRAM_DCA_DAYS);
    try (
        Connection connection = databaseService.connection();
        PreparedStatement statement = connection.prepareStatement("""
            update users
            set telegram_dca_enabled = ?, dca_reminder_note = ?, telegram_dca_days = ?, updated_at = now()
            where lower(username) = lower(?)
            """)
    ) {
      statement.setBoolean(1, settings.telegramDcaEnabled());
      statement.setString(2, normalizedNote);
      statement.setString(3, normalizedDays);
      statement.setString(4, currentUsername());
      if (statement.executeUpdate() == 0) {
        throw new UserRegistrationUnavailableException("Authenticated user was not found.");
      }
      return new UserDcaSettings(settings.telegramDcaEnabled(), normalizedNote, daysFromCsv(normalizedDays, DEFAULT_TELEGRAM_DCA_DAYS));
    } catch (SQLException exception) {
      throw new UserRegistrationUnavailableException("Could not save DCA reminder settings.", exception);
    }
  }

  private String normalizeDays(List<String> days, List<String> defaultDays) {
    List<String> source = days == null ? defaultDays : days;
    return source.stream()
        .map(this::normalizeDay)
        .filter(StringUtils::hasText)
        .distinct()
        .collect(Collectors.joining(","));
  }

  private List<String> daysFromCsv(String csv, List<String> defaultDays) {
    if (csv == null) {
      return defaultDays;
    }
    if (!StringUtils.hasText(csv)) {
      return List.of();
    }
    return Arrays.stream(csv.split(","))
        .map(this::normalizeDay)
        .filter(StringUtils::hasText)
        .distinct()
        .toList();
  }

  private String normalizeDay(String day) {
    if (!StringUtils.hasText(day)) {
      return "";
    }
    String normalized = day.trim().toUpperCase(java.util.Locale.ROOT);
    if (normalized.length() > 3) {
      normalized = normalized.substring(0, 3);
    }
    return DEFAULT_TELEGRAM_ALERT_DAYS.contains(normalized) ? normalized : "";
  }

  public record UserRetirementSettings(
      String investingStartDate,
      java.math.BigDecimal desiredMonthlyIncome,
      java.math.BigDecimal customReturnRate,
      java.math.BigDecimal monthlySavings,
      java.math.BigDecimal otherSavings,
      java.math.BigDecimal yearlyInflationRate,
      java.math.BigDecimal safeWithdrawalRate
  ) {
  }

  public record UserTelegramSettings(String chatId, List<String> alertDays) {
    public UserTelegramSettings(String chatId) {
      this(chatId, DEFAULT_TELEGRAM_ALERT_DAYS);
    }
  }

  public record UserTelegramSchedule(String chatId, List<String> days) {
  }

  public record UserDcaSettings(boolean telegramDcaEnabled, String reminderNote, List<String> reminderDays) {
    public UserDcaSettings(boolean telegramDcaEnabled, String reminderNote) {
      this(telegramDcaEnabled, reminderNote, DEFAULT_TELEGRAM_DCA_DAYS);
    }
  }

  public static class DuplicateUsernameException extends RuntimeException {
    public DuplicateUsernameException(String message, Throwable cause) {
      super(message, cause);
    }
  }

  public static class UserRegistrationUnavailableException extends RuntimeException {
    public UserRegistrationUnavailableException(String message) {
      super(message);
    }

    public UserRegistrationUnavailableException(String message, Throwable cause) {
      super(message, cause);
    }
  }
}
