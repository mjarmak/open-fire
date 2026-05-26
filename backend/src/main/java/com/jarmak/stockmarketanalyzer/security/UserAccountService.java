package com.jarmak.stockmarketanalyzer.security;

import com.jarmak.stockmarketanalyzer.database.DatabaseService;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Map;
import java.util.Optional;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class UserAccountService {
  private static final String UNIQUE_VIOLATION = "23505";

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

  public UserTelegramSettings updateCurrentTelegramChatId(String chatId) {
    String normalizedChatId = chatId == null ? "" : chatId.trim();
    if (!StringUtils.hasText(normalizedChatId)) {
      throw new IllegalArgumentException("Telegram chat ID is required.");
    }

    try (
        Connection connection = databaseService.connection();
        PreparedStatement statement = connection.prepareStatement("""
            update users
            set telegram_chat_id = ?, updated_at = now()
            where lower(username) = lower(?)
            """)
    ) {
      statement.setString(1, normalizedChatId);
      statement.setString(2, currentUsername());
      if (statement.executeUpdate() == 0) {
        throw new UserRegistrationUnavailableException("Authenticated user was not found.");
      }
      return new UserTelegramSettings(normalizedChatId);
    } catch (SQLException exception) {
      throw new UserRegistrationUnavailableException("Could not save Telegram chat ID.", exception);
    }
  }

  public Map<String, String> allUserTelegramSettings() {
    Map<String, String> settings = new java.util.HashMap<>();
    try (
        Connection connection = databaseService.connection();
        PreparedStatement statement = connection.prepareStatement("select username, telegram_chat_id from users where telegram_chat_id is not null and telegram_chat_id <> ''")
    ) {
      try (ResultSet results = statement.executeQuery()) {
        while (results.next()) {
          settings.put(results.getString("username"), results.getString("telegram_chat_id"));
        }
      }
    } catch (SQLException exception) {
      throw new UserRegistrationUnavailableException("Could not load Telegram settings for all users.", exception);
    }
    return settings;
  }

  public Map<String, String> allUserTelegramSettingsForDcaEnabled() {
    Map<String, String> settings = new java.util.HashMap<>();
    try (
        Connection connection = databaseService.connection();
        PreparedStatement statement = connection.prepareStatement("""
            select username, telegram_chat_id
            from users
            where telegram_chat_id is not null
              and telegram_chat_id <> ''
              and coalesce(telegram_dca_enabled, false) = true
            """)
    ) {
      try (ResultSet results = statement.executeQuery()) {
        while (results.next()) {
          settings.put(results.getString("username"), results.getString("telegram_chat_id"));
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
            select telegram_dca_enabled, dca_reminder_note
            from users
            where lower(username) = lower(?)
            """)
    ) {
      statement.setString(1, username);
      try (ResultSet results = statement.executeQuery()) {
        if (results.next()) {
          return new UserDcaSettings(
              results.getBoolean("telegram_dca_enabled"),
              results.getString("dca_reminder_note")
          );
        }
        return new UserDcaSettings(false, "");
      }
    } catch (SQLException exception) {
      throw new UserRegistrationUnavailableException("Could not load DCA reminder settings.", exception);
    }
  }

  public UserDcaSettings updateCurrentDcaSettings(UserDcaSettings settings) {
    String normalizedNote = settings.reminderNote() == null ? "" : settings.reminderNote().trim();
    try (
        Connection connection = databaseService.connection();
        PreparedStatement statement = connection.prepareStatement("""
            update users
            set telegram_dca_enabled = ?, dca_reminder_note = ?, updated_at = now()
            where lower(username) = lower(?)
            """)
    ) {
      statement.setBoolean(1, settings.telegramDcaEnabled());
      statement.setString(2, normalizedNote);
      statement.setString(3, currentUsername());
      if (statement.executeUpdate() == 0) {
        throw new UserRegistrationUnavailableException("Authenticated user was not found.");
      }
      return new UserDcaSettings(settings.telegramDcaEnabled(), normalizedNote);
    } catch (SQLException exception) {
      throw new UserRegistrationUnavailableException("Could not save DCA reminder settings.", exception);
    }
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

  public record UserTelegramSettings(String chatId) {
  }

  public record UserDcaSettings(boolean telegramDcaEnabled, String reminderNote) {
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
