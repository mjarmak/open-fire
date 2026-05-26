package com.jarmak.stockmarketanalyzer.database;

import com.jarmak.stockmarketanalyzer.config.AppProperties;
import jakarta.annotation.PostConstruct;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class DatabaseService {
  private static final Logger LOGGER = LoggerFactory.getLogger(DatabaseService.class);

  private final AppProperties properties;

  public DatabaseService(AppProperties properties) {
    this.properties = properties;
  }

  public Connection connection() throws SQLException {
    AppProperties.Database database = properties.database();
    return DriverManager.getConnection(database.url(), database.username(), database.password());
  }

  @PostConstruct
  void validateConnection() {
    if (properties.database() == null || !StringUtils.hasText(properties.database().url())) {
      throw new IllegalStateException("Database URL is required. Set POSTGRES_URL or SPRING_DATASOURCE_URL.");
    }
    if (!StringUtils.hasText(properties.database().username())) {
      throw new IllegalStateException("Database username is required. Set POSTGRES_USER or SPRING_DATASOURCE_USERNAME.");
    }

    try (Connection ignored = connection()) {
      LOGGER.info("Postgres persistence is enabled with JDBC URL {}.", properties.database().url());
    } catch (SQLException exception) {
      throw new IllegalStateException("Could not connect to configured Postgres database.", exception);
    }
  }
}
