package com.jarmak.stockmarketanalyzer.database;

import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.jarmak.stockmarketanalyzer.config.AppProperties;
import org.junit.jupiter.api.Test;

class DatabaseServiceTest {
  @Test
  void requiresJdbcUrlOnStartup() {
    DatabaseService service = new DatabaseService(properties("", "admin"));

    assertThatThrownBy(service::validateConnection)
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Database URL is required");
  }

  @Test
  void requiresUsernameOnStartup() {
    DatabaseService service = new DatabaseService(properties("jdbc:postgresql://localhost:5439/stock_analyzer", ""));

    assertThatThrownBy(service::validateConnection)
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Database username is required");
  }

  @Test
  void failsStartupWhenConnectionCannotBeOpened() {
    DatabaseService service = new DatabaseService(properties("jdbc:postgresql://localhost:1/stock_analyzer", "admin"));

    assertThatThrownBy(service::validateConnection)
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("Could not connect to configured Postgres database");
  }

  private AppProperties properties(String url, String username) {
    return new AppProperties(
        new AppProperties.Security("admin", "salt", "hash"),
        null,
        new AppProperties.Database(url, username, "password"),
        null,
        null
    );
  }
}
